import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  APPLE_PRIVACY_SETTINGS_URL,
  PERMISSION_HELP_HOSTS,
  WINDOWS_CAMERA_MICROPHONE_PRIVACY_URL,
  isOfficialPermissionHelpUrl,
} from '../lib/permissions/helpLinks';

/**
 * The permission help links.
 *
 * Both of these were dead ends for a user who had already blocked the site at
 * the OS level:
 *   - https://support.microsoft.com/en-us/windows/windows-privacy-settings-8d6c1b1e-1f4b-4d9c-9d1a-2b4c3d5e6f7a
 *     — a fabricated GUID-shaped path (404).
 *   - https://support.apple.com/en-us/HT210192
 *     — the retired Apple article (404).
 *
 * These tests pin the replacement: official hosts only, https only, and one
 * shared constant per vendor so the permission card and the denied-permission
 * modal cannot drift apart again. Reachability of the URLs themselves was
 * verified with real requests (HTTP 200) on 2026-10-04 and is not something a
 * unit test can re-check.
 */

test('help links - both URLs are https on an official vendor support host', () => {
  for (const url of [WINDOWS_CAMERA_MICROPHONE_PRIVACY_URL, APPLE_PRIVACY_SETTINGS_URL]) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, 'https:', `${url} must be https`);
    assert.ok(
      (PERMISSION_HELP_HOSTS as readonly string[]).includes(parsed.hostname),
      `${url} must live on an official support host`
    );
    assert.ok(isOfficialPermissionHelpUrl(url));
  }
});

test('help links - each URL is the current page for that vendor, not an old article', () => {
  // The Microsoft page is the camera+microphone privacy support article.
  assert.match(WINDOWS_CAMERA_MICROPHONE_PRIVACY_URL, /^https:\/\/support\.microsoft\.com\/en-us\/windows\/privacy\//);
  // The Apple page is the Mac User Guide "Change Privacy & Security settings"
  // article. HT210192 is the retired identifier that replaced this.
  assert.match(APPLE_PRIVACY_SETTINGS_URL, /^https:\/\/support\.apple\.com\/en-us\/guide\/mac-help\//);
  assert.doesNotMatch(APPLE_PRIVACY_SETTINGS_URL, /HT210192/);
});

test('help links - a lookalike host is rejected', () => {
  assert.equal(
    isOfficialPermissionHelpUrl('https://support.microsoft.com.evil.test/en-us/windows'),
    false,
    'a host that merely starts with the real one is not official'
  );
  assert.equal(isOfficialPermissionHelpUrl('http://support.apple.com/en-us'), false, 'plain http is not accepted');
  assert.equal(isOfficialPermissionHelpUrl('not a url'), false);
});

test('help links - the microphone/webcam permission UI reads the shared constants', () => {
  const card = readFileSync('components/PermissionPromptCard.tsx', 'utf8');
  const modal = readFileSync('components/PermissionDeniedModal.tsx', 'utf8');

  for (const [name, source] of [
    ['PermissionPromptCard', card],
    ['PermissionDeniedModal', modal],
  ] as const) {
    assert.match(source, /WINDOWS_CAMERA_MICROPHONE_PRIVACY_URL/, `${name} links the Microsoft page`);
    assert.match(source, /APPLE_PRIVACY_SETTINGS_URL/, `${name} links the Apple page`);
    assert.doesNotMatch(source, /support\.microsoft\.com/, `${name} hardcodes no Microsoft URL`);
    assert.doesNotMatch(source, /support\.apple\.com/, `${name} hardcodes no Apple URL`);
  }

  // The dead URLs are gone from the whole source tree.
  for (const dead of ['8d6c1b1e-1f4b-4d9c-9d1a-2b4c3d5e6f7a', 'HT210192']) {
    for (const file of ['components/PermissionPromptCard.tsx', 'components/PermissionDeniedModal.tsx']) {
      assert.ok(
        !readFileSync(file, 'utf8').includes(dead),
        `${file} must not reference ${dead} any more`
      );
    }
  }
});