import {
  User,
  Workspace,
  Membership,
  Session,
  Subscription,
  Device,
  ChecklistTemplate,
  InspectionRecord,
  UsageCounter,
  AuditEvent,
  BillingCustomer,
  ProcessedBillingEvent,
  IDatabaseAdapter,
} from './types';

interface LocalStorageState {
  users: Record<string, User>;
  workspaces: Record<string, Workspace>;
  memberships: Record<string, Membership>;
  sessions: Record<string, Session>;
  billing_customers: Record<string, BillingCustomer>;
  subscriptions: Record<string, Subscription>;
  processed_events: Record<string, ProcessedBillingEvent>;
  devices: Record<string, Device>;
  templates: Record<string, ChecklistTemplate>;
  inspections: Record<string, InspectionRecord>;
  usage_counters: Record<string, UsageCounter>;
  audit_events: AuditEvent[];
}

export class LocalDatabaseAdapter implements IDatabaseAdapter {
  private data: LocalStorageState = {
    users: {},
    workspaces: {},
    memberships: {},
    sessions: {},
    billing_customers: {},
    subscriptions: {},
    processed_events: {},
    devices: {},
    templates: {},
    inspections: {},
    usage_counters: {},
    audit_events: [],
  };

  constructor() {
    this.reset();
  }

  reset() {
    this.data = {
      users: {},
      workspaces: {},
      memberships: {},
      sessions: {},
      billing_customers: {},
      subscriptions: {},
      processed_events: {},
      devices: {},
      templates: {},
      inspections: {},
      usage_counters: {},
      audit_events: [],
    };
  }

  // --- Users & Sessions ---

  async getUserByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    const user = Object.values(this.data.users).find((u) => u.email === lower);
    return user ? { ...user } : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const user = this.data.users[id];
    return user ? { ...user } : null;
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

    const membership: Membership = {
      id: membershipId,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'owner',
      created_at: now,
    };

    this.data.users[userId] = user;
    this.data.workspaces[workspaceId] = workspace;
    this.data.memberships[membershipId] = membership;

    return { user: { ...user }, workspace: { ...workspace } };
  }

  async createSession(userId: string, tokenHash: string, userAgent?: string): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: 'ses_' + crypto.randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: now + 30 * 24 * 60 * 60 * 1000,
      created_at: now,
      user_agent: userAgent || null,
    };

    this.data.sessions[session.id] = session;
    return { ...session };
  }

  async getSessionByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null> {
    const now = Date.now();
    const session = Object.values(this.data.sessions).find(
      (s) => s.token_hash === tokenHash && s.expires_at > now
    );
    if (!session) return null;

    const user = this.data.users[session.user_id];
    if (!user) return null;

    return { session: { ...session }, user: { ...user } };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    const session = Object.values(this.data.sessions).find((s) => s.token_hash === tokenHash);
    if (session) {
      delete this.data.sessions[session.id];
    }
  }

  async deleteUserAndWorkspace(userId: string): Promise<boolean> {
    const ws = await this.getWorkspaceByUserId(userId);
    if (ws) {
      delete this.data.workspaces[ws.id];
      // remove devices, templates, inspections
      for (const d of Object.values(this.data.devices)) {
        if (d.workspace_id === ws.id) delete this.data.devices[d.id];
      }
      for (const t of Object.values(this.data.templates)) {
        if (t.workspace_id === ws.id) delete this.data.templates[t.id];
      }
      for (const i of Object.values(this.data.inspections)) {
        if (i.workspace_id === ws.id) delete this.data.inspections[i.id];
      }
      for (const m of Object.values(this.data.memberships)) {
        if (m.workspace_id === ws.id) delete this.data.memberships[m.id];
      }
      for (const s of Object.values(this.data.subscriptions)) {
        if (s.workspace_id === ws.id) delete this.data.subscriptions[s.id];
      }
    }
    delete this.data.users[userId];
    return true;
  }

  // --- Workspaces ---

  async getWorkspaceById(id: string): Promise<Workspace | null> {
    const ws = this.data.workspaces[id];
    return ws ? { ...ws } : null;
  }

  async getWorkspaceByUserId(userId: string): Promise<Workspace | null> {
    const membership = Object.values(this.data.memberships).find((m) => m.user_id === userId);
    if (!membership) return null;
    const ws = this.data.workspaces[membership.workspace_id];
    return ws ? { ...ws } : null;
  }

  async updateWorkspaceBranding(
    workspaceId: string,
    branding: { companyName?: string | null; logoUrl?: string | null }
  ): Promise<Workspace | null> {
    const ws = this.data.workspaces[workspaceId];
    if (!ws) return null;

    ws.branding_company_name = branding.companyName !== undefined ? branding.companyName : ws.branding_company_name;
    ws.branding_logo_url = branding.logoUrl !== undefined ? branding.logoUrl : ws.branding_logo_url;
    ws.updated_at = Date.now();

    return { ...ws };
  }

  // --- Billing & Subscriptions ---

  async getBillingCustomer(workspaceId: string): Promise<BillingCustomer | null> {
    const bc = Object.values(this.data.billing_customers).find((c) => c.workspace_id === workspaceId);
    return bc ? { ...bc } : null;
  }

  async getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null> {
    const bc = Object.values(this.data.billing_customers).find(
      (c) => c.stripe_customer_id === stripeCustomerId
    );
    return bc ? { ...bc } : null;
  }

  async upsertBillingCustomer(params: {
    workspace_id: string;
    stripe_customer_id: string;
    stripe_account_id?: string | null;
  }): Promise<BillingCustomer> {
    const existing = await this.getBillingCustomer(params.workspace_id);
    if (existing) {
      existing.stripe_customer_id = params.stripe_customer_id;
      existing.stripe_account_id = params.stripe_account_id || null;
      this.data.billing_customers[existing.id] = existing;
      return { ...existing };
    }

    const id = 'bc_' + crypto.randomUUID();
    const item: BillingCustomer = {
      id,
      workspace_id: params.workspace_id,
      stripe_customer_id: params.stripe_customer_id,
      stripe_account_id: params.stripe_account_id || null,
      created_at: Date.now(),
    };
    this.data.billing_customers[id] = item;
    return { ...item };
  }

  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    const sub = Object.values(this.data.subscriptions).find((s) => s.workspace_id === workspaceId);
    return sub ? { ...sub } : null;
  }

  async upsertSubscription(
    sub: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Subscription> {
    const existing = Object.values(this.data.subscriptions).find(
      (s) => s.workspace_id === sub.workspace_id
    );

    const now = Date.now();
    if (existing) {
      const updated: Subscription = {
        ...existing,
        ...sub,
        updated_at: now,
      };
      this.data.subscriptions[existing.id] = updated;
      return { ...updated };
    }

    const id = 'sub_' + crypto.randomUUID();
    const item: Subscription = {
      id,
      ...sub,
      created_at: now,
      updated_at: now,
    };
    this.data.subscriptions[id] = item;
    return { ...item };
  }

  async recordBillingEvent(eventId: string, eventType: string, summary?: string): Promise<void> {
    this.data.processed_events[eventId] = {
      event_id: eventId,
      event_type: eventType,
      processed_at: Date.now(),
      payload_summary: summary || null,
    };
  }

  async isBillingEventProcessed(eventId: string): Promise<boolean> {
    return !!this.data.processed_events[eventId];
  }

  // --- Inspections ---

  async createInspection(
    workspaceId: string,
    data: Omit<InspectionRecord, 'id' | 'workspace_id' | 'created_at'>
  ): Promise<{ success: boolean; record?: InspectionRecord; error?: string }> {
    const periodKey = new Date().toISOString().slice(0, 7);
    const counterKey = `${workspaceId}_${periodKey}`;
    const currentCount = this.data.usage_counters[counterKey]?.inspections_count || 0;

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

    this.data.inspections[id] = record;
    this.data.usage_counters[counterKey] = {
      id: counterKey,
      workspace_id: workspaceId,
      period_key: periodKey,
      inspections_count: currentCount + 1,
      updated_at: now,
    };

    return { success: true, record: { ...record } };
  }

  async getInspections(
    workspaceId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: InspectionRecord[]; total: number }> {
    const list = Object.values(this.data.inspections)
      .filter((i) => i.workspace_id === workspaceId)
      .sort((a, b) => b.created_at - a.created_at);

    const items = list.slice(offset, offset + limit).map((i) => ({ ...i }));
    return { items, total: list.length };
  }

  async getInspectionById(workspaceId: string, id: string): Promise<InspectionRecord | null> {
    const item = this.data.inspections[id];
    if (item && item.workspace_id === workspaceId) {
      return { ...item };
    }
    return null;
  }

  async deleteInspection(workspaceId: string, id: string): Promise<boolean> {
    const item = this.data.inspections[id];
    if (item && item.workspace_id === workspaceId) {
      delete this.data.inspections[id];
      return true;
    }
    return false;
  }

  // --- Devices ---

  async getDevices(workspaceId: string): Promise<Device[]> {
    return Object.values(this.data.devices)
      .filter((d) => d.workspace_id === workspaceId)
      .sort((a, b) => b.created_at - a.created_at)
      .map((d) => ({ ...d }));
  }

  async createDevice(
    workspaceId: string,
    data: Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    const existingCount = Object.values(this.data.devices).filter((d) => d.workspace_id === workspaceId).length;
    if (existingCount >= 200) {
      return { success: false, error: 'Device inventory limit reached (200 devices maximum).' };
    }

    const now = Date.now();
    const id = 'dev_' + crypto.randomUUID();
    const device: Device = {
      id,
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

    this.data.devices[id] = device;
    return { success: true, device: { ...device } };
  }

  async updateDevice(
    workspaceId: string,
    deviceId: string,
    data: Partial<Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
  ): Promise<Device | null> {
    const device = this.data.devices[deviceId];
    if (!device || device.workspace_id !== workspaceId) return null;

    const updated: Device = {
      ...device,
      ...data,
      updated_at: Date.now(),
    };
    this.data.devices[deviceId] = updated;
    return { ...updated };
  }

  async deleteDevice(workspaceId: string, deviceId: string): Promise<boolean> {
    const device = this.data.devices[deviceId];
    if (device && device.workspace_id === workspaceId) {
      delete this.data.devices[deviceId];
      return true;
    }
    return false;
  }

  // --- Templates ---

  async getTemplates(workspaceId: string): Promise<ChecklistTemplate[]> {
    return Object.values(this.data.templates)
      .filter((t) => t.workspace_id === workspaceId)
      .sort((a, b) => b.created_at - a.created_at)
      .map((t) => ({ ...t }));
  }

  async createTemplate(
    workspaceId: string,
    data: Omit<ChecklistTemplate, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; template?: ChecklistTemplate; error?: string }> {
    const existingCount = Object.values(this.data.templates).filter((t) => t.workspace_id === workspaceId).length;
    if (existingCount >= 25) {
      return { success: false, error: 'Template limit reached (25 templates maximum per workspace).' };
    }

    const now = Date.now();
    const id = 'tpl_' + crypto.randomUUID();
    const template: ChecklistTemplate = {
      id,
      workspace_id: workspaceId,
      title: data.title,
      description: data.description || null,
      tests_config: data.tests_config,
      created_at: now,
      updated_at: now,
    };

    this.data.templates[id] = template;
    return { success: true, template: { ...template } };
  }

  async deleteTemplate(workspaceId: string, templateId: string): Promise<boolean> {
    const template = this.data.templates[templateId];
    if (template && template.workspace_id === workspaceId) {
      delete this.data.templates[templateId];
      return true;
    }
    return false;
  }

  // --- Audits & Export ---

  async recordAuditEvent(
    workspaceId: string,
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void> {
    this.data.audit_events.push({
      id: 'aud_' + crypto.randomUUID(),
      workspace_id: workspaceId,
      user_id: userId || null,
      action,
      details: details || null,
      created_at: Date.now(),
    });
  }

  async exportWorkspaceData(workspaceId: string) {
    const workspace = await this.getWorkspaceById(workspaceId);
    const subscription = await this.getSubscription(workspaceId);
    const devices = await this.getDevices(workspaceId);
    const templates = await this.getTemplates(workspaceId);
    const inspectionsData = await this.getInspections(workspaceId, 1000, 0);

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
