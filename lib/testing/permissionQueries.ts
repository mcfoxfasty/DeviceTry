/**
 * Permission state queries — read-only, honest, and fully distinguishable.
 *
 * The previous implementation collapsed three different outcomes into one
 * verdict: if nothing was denied it reported `passed`, including the case
 * where EVERY query failed and nothing at all was learned. Five states are
 * tracked separately here:
 *
 *   granted     — query() resolved with state "granted"
 *   prompt      — query() resolved with state "prompt" (NOT granted, NOT blocked)
 *   denied      — query() resolved with state "denied"
 *   unqueryable — this browser does not implement that permission name
 *   error       — query() itself threw (rejected promise, or threw synchronously)
 *
 * READ-ONLY CONTRACT: this module never calls getUserMedia, never requests a
 * permission, and never triggers a prompt. `query()` is the only call made.
 *
 * SUMMARY HONESTY: `summarizePermissionQuery` can never return "passed" on
 * its own. With nothing queryable it reports unsupported/inconclusive and says
 * why; with partial coverage it discloses exactly how many names were checked
 * and how many remain unknown.
 */

export type PermissionQueryState = 'granted' | 'prompt' | 'denied' | 'unqueryable' | 'error';

export interface PermissionQuerySpec {
  /** Permissions API descriptor name, e.g. "microphone". */
  name: string;
  label: string;
}

/** The names this tool reads. Ordered: the two that matter most come first. */
export const PERMISSION_QUERIES: readonly PermissionQuerySpec[] = [
  { name: 'microphone', label: 'Microphone' },
  { name: 'camera', label: 'Camera' },
  { name: 'clipboard-read', label: 'Clipboard Read' },
  { name: 'clipboard-write', label: 'Clipboard Write' },
  { name: 'notifications', label: 'Notifications' },
  { name: 'geolocation', label: 'Geolocation' },
  { name: 'persistent-storage', label: 'Persistent Storage' },
  { name: 'midi', label: 'MIDI Access' },
] as const;

export interface PermissionRow extends PermissionQuerySpec {
  state: PermissionQueryState;
  /** Populated for `error` rows — the reason that query produced no state. */
  detail?: string;
}

export interface PermissionSummaryCounts {
  granted: number;
  prompt: number;
  denied: number;
  unqueryable: number;
  error: number;
  checked: number;
  total: number;
}

export interface PermissionSummary {
  status: 'unsupported' | 'inconclusive' | 'warning' | 'measured';
  details: string;
  counts: PermissionSummaryCounts;
  /** Names that produced a real state — everything else stayed unknown. */
  checkedNames: string[];
  unknownNames: string[];
}

export type QueryPermissionFn = (descriptor: { name: string }) => Promise<{ state: string }>;

/** Detect a usable navigator.permissions.query without calling it. */
export function hasQueryablePermissionsApi(nav: unknown): boolean {
  const candidate = nav as { permissions?: { query?: unknown } } | null | undefined;
  return typeof candidate?.permissions?.query === 'function';
}

/**
 * Query every permission name. Never throws: a rejected query becomes an
 * `error` row, and an unsupported name becomes an `unqueryable` row. Both are
 * honest "we did not learn this" outcomes, never a silent success.
 */
export async function runPermissionQueries(
  query: QueryPermissionFn,
  specs: readonly PermissionQuerySpec[] = PERMISSION_QUERIES
): Promise<PermissionRow[]> {
  const rows: PermissionRow[] = [];
  for (const spec of specs) {
    try {
      const status = await query({ name: spec.name });
      const state = String(status?.state ?? '');
      if (state === 'granted' || state === 'prompt' || state === 'denied') {
        rows.push({ ...spec, state });
      } else {
        // A resolved status with an unrecognised state is not evidence.
        rows.push({ ...spec, state: 'error', detail: `browser reported an unrecognised state "${state}"` });
      }
    } catch (err) {
      rows.push({
        ...spec,
        state: 'error',
        detail: err instanceof Error && err.message ? err.message : 'query() rejected',
      });
    }
  }
  return rows;
}

export function countPermissionStates(rows: readonly PermissionRow[]): PermissionSummaryCounts {
  const counts: PermissionSummaryCounts = {
    granted: 0,
    prompt: 0,
    denied: 0,
    unqueryable: 0,
    error: 0,
    checked: 0,
    total: rows.length,
  };
  for (const row of rows) {
    counts[row.state] += 1;
    if (row.state === 'granted' || row.state === 'prompt' || row.state === 'denied') counts.checked += 1;
  }
  return counts;
}

/**
 * Turn rows into a verdict. There is deliberately no "passed": a read-only
 * state query cannot certify that any hardware works, and a run that learned
 * nothing must never look like a clean bill of health.
 */
export function summarizePermissionQuery(rows: readonly PermissionRow[], apiAvailable = true): PermissionSummary {
  const counts = countPermissionStates(rows);
  const checkedNames = rows
    .filter((row) => row.state === 'granted' || row.state === 'prompt' || row.state === 'denied')
    .map((row) => row.label);
  const unknownNames = rows
    .filter((row) => row.state === 'unqueryable' || row.state === 'error')
    .map((row) => row.label);

  const blocked = rows.filter((row) => row.state === 'denied').map((row) => row.label);
  const pending = rows.filter((row) => row.state === 'prompt').map((row) => row.label);

  if (!apiAvailable) {
    return {
      status: 'unsupported',
      details:
        'navigator.permissions.query() is not available in this browser, so no permission state could be read. ' +
        'Nothing is known about your microphone, camera, or other permissions — open the failing tool and use its prompt instead.',
      counts,
      checkedNames,
      unknownNames,
    };
  }

  if (counts.checked === 0) {
    const reason =
      counts.error > 0
        ? `${counts.error} of ${counts.total} queries failed and ${counts.unqueryable} are not implemented by this browser`
        : `this browser does not implement any of the ${counts.total} permission names queried`;
    return {
      status: 'inconclusive',
      details:
        `No permission could be queried — ${reason}. ` +
        'This is not a pass: no state was read, so nothing here can confirm or deny anything.',
      counts,
      checkedNames,
      unknownNames,
    };
  }

  const coverage =
    unknownNames.length > 0
      ? ` Checked ${counts.checked} of ${counts.total}; unknown: ${unknownNames.join(', ')}.`
      : ` All ${counts.total} names returned a state.`;

  if (blocked.length > 0) {
    return {
      status: 'warning',
      details:
        `Blocked: ${blocked.join(', ')}. ` +
        `A blocked permission will stop the matching tool until you change it in the address-bar site settings.${coverage}`,
      counts,
      checkedNames,
      unknownNames,
    };
  }

  const grantedText = counts.granted > 0 ? `Granted: ${counts.granted}.` : '';
  const promptText = pending.length > 0 ? ` Not yet decided: ${pending.join(', ')}.` : '';
  return {
    // "measured", not "passed": these are the states the browser reports, and
    // a reported state is not proof that capture hardware works.
    status: 'measured',
    details:
      `${grantedText}${promptText || 'No permission is blocked.'} ` +
      `These are the states this browser reports, not a hardware test — a granted state does not prove a microphone or camera delivers sound or video.${coverage}`,
    counts,
    checkedNames,
    unknownNames,
  };
}
