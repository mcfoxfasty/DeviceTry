import {
  User,
  Workspace,
  Membership,
  Session,
  Subscription,
  Device,
  ChecklistTemplate,
  InspectionRecord,
  BillingCustomer,
  IDatabaseAdapter,
} from './types';

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  run(): Promise<{ success: boolean; meta?: unknown }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[]; success: boolean }[]>;
}

export class D1DatabaseAdapter implements IDatabaseAdapter {
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.d1 = d1;
  }

  // --- Users & Sessions ---

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.d1
      .prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
      .bind(email.toLowerCase())
      .first<User>();
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.d1
      .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
      .bind(id)
      .first<User>();
  }

  async createUserWithWorkspace(params: {
    email: string;
    passwordHash: string;
    name: string;
    companyName?: string;
  }): Promise<{ user: User; workspace: Workspace }> {
    const now = Date.now();
    const userId = 'usr_' + crypto.randomUUID();
    const workspaceId = 'ws_' + crypto.randomUUID();
    const membershipId = 'mem_' + crypto.randomUUID();

    const user: User = {
      id: userId,
      email: params.email.toLowerCase(),
      password_hash: params.passwordHash,
      name: params.name,
      created_at: now,
      updated_at: now,
    };

    const workspace: Workspace = {
      id: workspaceId,
      owner_id: userId,
      name: params.companyName || `${params.name}'s Workspace`,
      branding_company_name: params.companyName || null,
      branding_logo_url: null,
      created_at: now,
      updated_at: now,
    };

    await this.d1.batch([
      this.d1
        .prepare(
          'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(user.id, user.email, user.password_hash || null, user.name, user.created_at, user.updated_at),
      this.d1
        .prepare(
          'INSERT INTO workspaces (id, owner_id, name, branding_company_name, branding_logo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          workspace.id,
          workspace.owner_id,
          workspace.name,
          workspace.branding_company_name,
          workspace.branding_logo_url,
          workspace.created_at,
          workspace.updated_at
        ),
      this.d1
        .prepare(
          'INSERT INTO memberships (id, workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(membershipId, workspaceId, userId, 'owner', now),
    ]);

    return { user, workspace };
  }

  async createSession(userId: string, tokenHash: string, userAgent?: string): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: 'ses_' + crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: now + 30 * 24 * 60 * 60 * 1000, // 30 days
      created_at: now,
      user_agent: userAgent || null,
    };

    await this.d1
      .prepare(
        'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(
        session.id,
        session.user_id,
        session.token_hash,
        session.expires_at,
        session.created_at,
        session.user_agent
      )
      .run();

    return session;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null> {
    const now = Date.now();
    const session = await this.d1
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1')
      .bind(tokenHash, now)
      .first<Session>();

    if (!session) return null;

    const user = await this.getUserById(session.user_id);
    if (!user) return null;

    return { session, user };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.d1
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
  }

  async deleteUserAndWorkspace(userId: string): Promise<boolean> {
    const ws = await this.getWorkspaceByUserId(userId);
    if (ws) {
      await this.d1.batch([
        this.d1.prepare('DELETE FROM users WHERE id = ?').bind(userId),
        this.d1.prepare('DELETE FROM workspaces WHERE id = ?').bind(ws.id),
      ]);
      return true;
    }
    await this.d1.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    return true;
  }

  // --- Workspaces ---

  async getWorkspaceById(id: string): Promise<Workspace | null> {
    return await this.d1
      .prepare('SELECT * FROM workspaces WHERE id = ? LIMIT 1')
      .bind(id)
      .first<Workspace>();
  }

  async getWorkspaceByUserId(userId: string): Promise<Workspace | null> {
    return await this.d1
      .prepare(
        'SELECT w.* FROM workspaces w JOIN memberships m ON w.id = m.workspace_id WHERE m.user_id = ? LIMIT 1'
      )
      .bind(userId)
      .first<Workspace>();
  }

  async updateWorkspaceBranding(
    workspaceId: string,
    branding: { companyName?: string | null; logoUrl?: string | null }
  ): Promise<Workspace | null> {
    const now = Date.now();
    await this.d1
      .prepare(
        'UPDATE workspaces SET branding_company_name = ?, branding_logo_url = ?, updated_at = ? WHERE id = ?'
      )
      .bind(branding.companyName || null, branding.logoUrl || null, now, workspaceId)
      .run();

    return await this.getWorkspaceById(workspaceId);
  }

  // --- Billing & Subscriptions ---

  async getBillingCustomer(workspaceId: string): Promise<BillingCustomer | null> {
    return await this.d1
      .prepare('SELECT * FROM billing_customers WHERE workspace_id = ? LIMIT 1')
      .bind(workspaceId)
      .first<BillingCustomer>();
  }

  async getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    return await this.d1
      .prepare('SELECT * FROM billing_customers WHERE stripe_customer_id = ? LIMIT 1')
      .bind(stripeCustomerId)
      .first<BillingCustomer>();
  }

  async upsertBillingCustomer(params: {
    workspace_id: string;
    stripe_customer_id: string;
    stripe_account_id?: string | null;
  }): Promise<BillingCustomer> {
    const now = Date.now();
    const existing = await this.getBillingCustomer(params.workspace_id);
    if (existing) {
      await this.d1
        .prepare(
          'UPDATE billing_customers SET stripe_customer_id = ?, stripe_account_id = ? WHERE workspace_id = ?'
        )
        .bind(params.stripe_customer_id, params.stripe_account_id || null, params.workspace_id)
        .run();
      return {
        ...existing,
        stripe_customer_id: params.stripe_customer_id,
        stripe_account_id: params.stripe_account_id || null,
      };
    }

    const id = 'bc_' + crypto.randomUUID();
    const item: BillingCustomer = {
      id,
      workspace_id: params.workspace_id,
      stripe_customer_id: params.stripe_customer_id,
      stripe_account_id: params.stripe_account_id || null,
      created_at: now,
    };

    await this.d1
      .prepare(
        'INSERT INTO billing_customers (id, workspace_id, stripe_customer_id, stripe_account_id, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(item.id, item.workspace_id, item.stripe_customer_id, item.stripe_account_id, item.created_at)
      .run();

    return item;
  }

  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    return await this.d1
      .prepare('SELECT * FROM subscriptions WHERE workspace_id = ? LIMIT 1')
      .bind(workspaceId)
      .first<Subscription>();
  }

  async upsertSubscription(
    sub: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Subscription> {
    const now = Date.now();
    const existing = await this.getSubscription(sub.workspace_id);

    if (existing) {
      await this.d1
        .prepare(
          'UPDATE subscriptions SET stripe_subscription_id = ?, stripe_price_id = ?, status = ?, current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?, updated_at = ? WHERE workspace_id = ?'
        )
        .bind(
          sub.stripe_subscription_id,
          sub.stripe_price_id,
          sub.status,
          sub.current_period_start,
          sub.current_period_end,
          sub.cancel_at_period_end,
          now,
          sub.workspace_id
        )
        .run();

      return {
        ...existing,
        ...sub,
        updated_at: now,
      };
    }

    const item: Subscription = {
      id: 'sub_' + crypto.randomUUID(),
      ...sub,
      created_at: now,
      updated_at: now,
    };

    await this.d1
      .prepare(
        'INSERT INTO subscriptions (id, workspace_id, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        item.id,
        item.workspace_id,
        item.stripe_subscription_id,
        item.stripe_price_id,
        item.status,
        item.current_period_start,
        item.current_period_end,
        item.cancel_at_period_end,
        item.created_at,
        item.updated_at
      )
      .run();

    return item;
  }

  async recordBillingEvent(eventId: string, eventType: string, summary?: string): Promise<void> {
    const now = Date.now();
    await this.d1
      .prepare(
        'INSERT OR IGNORE INTO processed_billing_events (event_id, event_type, processed_at, payload_summary) VALUES (?, ?, ?, ?)'
      )
      .bind(eventId, eventType, now, summary || null)
      .run();
  }

  async isBillingEventProcessed(eventId: string): Promise<boolean> {
    const found = await this.d1
      .prepare('SELECT event_id FROM processed_billing_events WHERE event_id = ? LIMIT 1')
      .bind(eventId)
      .first<{ event_id: string }>();
    return !!found;
  }

  // --- Inspections ---

  async createInspection(
    workspaceId: string,
    data: Omit<InspectionRecord, 'id' | 'workspace_id' | 'created_at'>
  ): Promise<{ success: boolean; record?: InspectionRecord; error?: string }> {
    // Quota check: max 200 per month
    const periodKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const counter = await this.d1
      .prepare('SELECT inspections_count FROM usage_counters WHERE workspace_id = ? AND period_key = ?')
      .bind(workspaceId, periodKey)
      .first<{ inspections_count: number }>();

    const currentCount = counter?.inspections_count || 0;
    if (currentCount >= 200) {
      return {
        success: false,
        error: 'Monthly quota reached: 200 cloud inspection reports per billing period. Reports can still be saved and printed locally.',
      };
    }

    const now = Date.now();
    const id = 'insp_' + crypto.randomUUID();
    const record: InspectionRecord = {
      id,
      workspace_id: workspaceId,
      device_id: data.device_id || null,
      device_label: data.device_label || null,
      operator_name: data.operator_name || null,
      locale: data.locale || 'en',
      summary_status: data.summary_status,
      tests_results: data.tests_results,
      notes: data.notes || null,
      created_at: now,
    };

    await this.d1.batch([
      this.d1
        .prepare(
          'INSERT INTO inspections (id, workspace_id, device_id, device_label, operator_name, locale, summary_status, tests_results, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          record.id,
          record.workspace_id,
          record.device_id,
          record.device_label,
          record.operator_name,
          record.locale,
          record.summary_status,
          JSON.stringify(record.tests_results),
          record.notes,
          record.created_at
        ),
      this.d1
        .prepare(
          'INSERT INTO usage_counters (id, workspace_id, period_key, inspections_count, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(workspace_id, period_key) DO UPDATE SET inspections_count = inspections_count + 1, updated_at = ?'
        )
        .bind('uc_' + crypto.randomUUID(), workspaceId, periodKey, now, now),
    ]);

    return { success: true, record };
  }

  async getInspections(
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: InspectionRecord[]; total: number }> {
    const totalRow = await this.d1
      .prepare('SELECT COUNT(*) as count FROM inspections WHERE workspace_id = ?')
      .bind(workspaceId)
      .first<{ count: number }>();

    const rows = await this.d1
      .prepare(
        'SELECT * FROM inspections WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      )
      .bind(workspaceId, limit, offset)
      .all<Record<string, unknown>>();

    const items: InspectionRecord[] = (rows.results || []).map((r) => ({
      id: r.id as string,
      workspace_id: r.workspace_id as string,
      device_id: (r.device_id as string) || null,
      device_label: (r.device_label as string) || null,
      operator_name: (r.operator_name as string) || null,
      locale: (r.locale as string) || 'en',
      summary_status: r.summary_status as InspectionRecord['summary_status'],
      tests_results: typeof r.tests_results === 'string' ? JSON.parse(r.tests_results) : (r.tests_results as InspectionRecord['tests_results']),
      notes: (r.notes as string) || null,
      created_at: Number(r.created_at),
    }));

    return { items, total: totalRow?.count || 0 };
  }

  async getInspectionById(workspaceId: string, id: string): Promise<InspectionRecord | null> {
    const r = await this.d1
      .prepare('SELECT * FROM inspections WHERE workspace_id = ? AND id = ? LIMIT 1')
      .bind(workspaceId, id)
      .first<Record<string, unknown>>();

    if (!r) return null;

    return {
      id: r.id as string,
      workspace_id: r.workspace_id as string,
      device_id: (r.device_id as string) || null,
      device_label: (r.device_label as string) || null,
      operator_name: (r.operator_name as string) || null,
      locale: (r.locale as string) || 'en',
      summary_status: r.summary_status as InspectionRecord['summary_status'],
      tests_results: typeof r.tests_results === 'string' ? JSON.parse(r.tests_results) : (r.tests_results as InspectionRecord['tests_results']),
      notes: (r.notes as string) || null,
      created_at: Number(r.created_at),
    };
  }

  async deleteInspection(workspaceId: string, id: string): Promise<boolean> {
    const res = await this.d1
      .prepare('DELETE FROM inspections WHERE workspace_id = ? AND id = ?')
      .bind(workspaceId, id)
      .run();
    return res.success;
  }

  // --- Devices ---

  async getDevices(workspaceId: string): Promise<Device[]> {
    const rows = await this.d1
      .prepare('SELECT * FROM devices WHERE workspace_id = ? ORDER BY created_at DESC')
      .bind(workspaceId)
      .all<Device>();
    return rows.results || [];
  }

  async createDevice(
    workspaceId: string,
    data: Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    const countRow = await this.d1
      .prepare('SELECT COUNT(*) as count FROM devices WHERE workspace_id = ?')
      .bind(workspaceId)
      .first<{ count: number }>();

    if ((countRow?.count || 0) >= 200) {
      return { success: false, error: 'Device inventory limit reached (200 devices maximum).' };
    }

    const now = Date.now();
    const device: Device = {
      id: 'dev_' + crypto.randomUUID(),
      workspace_id: workspaceId,
      name: data.name,
      model_identifier: data.model_identifier || null,
      serial_number: data.serial_number || null,
      assigned_to: data.assigned_to || null,
      category: data.category || 'laptop',
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    };

    await this.d1
      .prepare(
        'INSERT INTO devices (id, workspace_id, name, model_identifier, serial_number, assigned_to, category, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        device.id,
        device.workspace_id,
        device.name,
        device.model_identifier,
        device.serial_number,
        device.assigned_to,
        device.category,
        device.notes,
        device.created_at,
        device.updated_at
      )
      .run();

    return { success: true, device };
  }

  async updateDevice(
    workspaceId: string,
    deviceId: string,
    data: Partial<Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
  ): Promise<Device | null> {
    const now = Date.now();
    const existing = await this.d1
      .prepare('SELECT * FROM devices WHERE workspace_id = ? AND id = ? LIMIT 1')
      .bind(workspaceId, deviceId)
      .first<Device>();

    if (!existing) return null;

    const updated: Device = {
      ...existing,
      ...data,
      updated_at: now,
    };

    await this.d1
      .prepare(
        'UPDATE devices SET name = ?, model_identifier = ?, serial_number = ?, assigned_to = ?, category = ?, notes = ?, updated_at = ? WHERE workspace_id = ? AND id = ?'
      )
      .bind(
        updated.name,
        updated.model_identifier || null,
        updated.serial_number || null,
        updated.assigned_to || null,
        updated.category,
        updated.notes || null,
        now,
        workspaceId,
        deviceId
      )
      .run();

    return updated;
  }

  async deleteDevice(workspaceId: string, deviceId: string): Promise<boolean> {
    const res = await this.d1
      .prepare('DELETE FROM devices WHERE workspace_id = ? AND id = ?')
      .bind(workspaceId, deviceId)
      .run();
    return res.success;
  }

  // --- Templates ---

  async getTemplates(workspaceId: string): Promise<ChecklistTemplate[]> {
    const rows = await this.d1
      .prepare('SELECT * FROM templates WHERE workspace_id = ? ORDER BY created_at DESC')
      .bind(workspaceId)
      .all<Record<string, unknown>>();

    return (rows.results || []).map((r) => ({
      id: r.id as string,
      workspace_id: r.workspace_id as string,
      title: r.title as string,
      description: (r.description as string) || null,
      tests_config: typeof r.tests_config === 'string' ? JSON.parse(r.tests_config) : (r.tests_config as string[]),
      created_at: Number(r.created_at),
      updated_at: Number(r.updated_at),
    }));
  }

  async createTemplate(
    workspaceId: string,
    data: Omit<ChecklistTemplate, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; template?: ChecklistTemplate; error?: string }> {
    const countRow = await this.d1
      .prepare('SELECT COUNT(*) as count FROM templates WHERE workspace_id = ?')
      .bind(workspaceId)
      .first<{ count: number }>();

    if ((countRow?.count || 0) >= 25) {
      return { success: false, error: 'Template limit reached (25 templates maximum per workspace).' };
    }

    const now = Date.now();
    const template: ChecklistTemplate = {
      id: 'tpl_' + crypto.randomUUID(),
      workspace_id: workspaceId,
      title: data.title,
      description: data.description || null,
      tests_config: data.tests_config,
      created_at: now,
      updated_at: now,
    };

    await this.d1
      .prepare(
        'INSERT INTO templates (id, workspace_id, title, description, tests_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        template.id,
        template.workspace_id,
        template.title,
        template.description,
        JSON.stringify(template.tests_config),
        template.created_at,
        template.updated_at
      )
      .run();

    return { success: true, template };
  }

  async deleteTemplate(workspaceId: string, templateId: string): Promise<boolean> {
    const res = await this.d1
      .prepare('DELETE FROM templates WHERE workspace_id = ? AND id = ?')
      .bind(workspaceId, templateId)
      .run();
    return res.success;
  }

  // --- Audits & Export ---

  async recordAuditEvent(
    workspaceId: string,
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void> {
    const now = Date.now();
    await this.d1
      .prepare(
        'INSERT INTO audit_events (id, workspace_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind('aud_' + crypto.randomUUID(), workspaceId, userId || null, action, details || null, now)
      .run();
  }

  async exportWorkspaceData(workspaceId: string) {
    const [workspace, subscription, devices, templates, inspectionsData] = await Promise.all([
      this.getWorkspaceById(workspaceId),
      this.getSubscription(workspaceId),
      this.getDevices(workspaceId),
      this.getTemplates(workspaceId),
      this.getInspections(workspaceId, 1000, 0),
    ]);

    return {
      workspace,
      subscription,
      devices,
      templates,
      inspections: inspectionsData.items,
      exportedAt: new Date().toISOString(),
    };
  }
}
