import fs from 'fs';
import path from 'path';
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
} from './schema';

interface StorageSchema {
  users: User[];
  workspaces: Workspace[];
  memberships: Membership[];
  sessions: Session[];
  subscriptions: Subscription[];
  processedEvents: { eventId: string; eventType: string; processedAt: number; summary?: string }[];
  devices: Device[];
  templates: ChecklistTemplate[];
  inspections: InspectionRecord[];
  usageCounters: UsageCounter[];
  auditEvents: AuditEvent[];
}

const LOCAL_STORAGE_FILE = path.join(process.cwd(), '.devtry-storage.json');

class DatabaseAdapter {
  private memoryCache: StorageSchema | null = null;

  private loadStorage(): StorageSchema {
    if (this.memoryCache) {
      return this.memoryCache;
    }

    try {
      if (fs.existsSync(LOCAL_STORAGE_FILE)) {
        const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8');
        this.memoryCache = JSON.parse(raw);
        return this.memoryCache!;
      }
    } catch {
      // fallback to initial state
    }

    this.memoryCache = {
      users: [],
      workspaces: [],
      memberships: [],
      sessions: [],
      subscriptions: [],
      processedEvents: [],
      devices: [],
      templates: [],
      inspections: [],
      usageCounters: [],
      auditEvents: [],
    };
    return this.memoryCache;
  }

  private saveStorage(): void {
    if (!this.memoryCache) return;
    try {
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(this.memoryCache, null, 2), 'utf-8');
    } catch {
      // In read-only serverless filesystems, memory cache maintains state for the request
    }
  }

  // --- Users & Workspaces ---
  async getUserByEmail(email: string): Promise<User | null> {
    const store = this.loadStorage();
    return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    const store = this.loadStorage();
    return store.users.find((u) => u.id === id) || null;
  }

  async createUserWithWorkspace(params: {
    email: string;
    passwordHash?: string;
    name: string;
    companyName?: string;
  }): Promise<{ user: User; workspace: Workspace }> {
    const store = this.loadStorage();
    const now = Date.now();

    const user: User = {
      id: 'usr_' + Math.random().toString(36).substring(2, 11),
      email: params.email.toLowerCase(),
      password_hash: params.passwordHash,
      name: params.name,
      created_at: now,
      updated_at: now,
    };

    const workspace: Workspace = {
      id: 'wks_' + Math.random().toString(36).substring(2, 11),
      owner_id: user.id,
      name: params.companyName ? `${params.companyName} Workspace` : `${params.name}'s Workspace`,
      branding_company_name: params.companyName || null,
      branding_logo_url: null,
      created_at: now,
      updated_at: now,
    };

    const membership: Membership = {
      id: 'mem_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
      created_at: now,
    };

    store.users.push(user);
    store.workspaces.push(workspace);
    store.memberships.push(membership);
    this.saveStorage();

    return { user, workspace };
  }

  async getWorkspaceForUser(userId: string): Promise<Workspace | null> {
    const store = this.loadStorage();
    const membership = store.memberships.find((m) => m.user_id === userId);
    if (!membership) return null;
    return store.workspaces.find((w) => w.id === membership.workspace_id) || null;
  }

  async updateWorkspaceBranding(
    workspaceId: string,
    branding: { companyName?: string; logoUrl?: string }
  ): Promise<Workspace | null> {
    const store = this.loadStorage();
    const workspace = store.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;

    if (branding.companyName !== undefined) workspace.branding_company_name = branding.companyName;
    if (branding.logoUrl !== undefined) workspace.branding_logo_url = branding.logoUrl;
    workspace.updated_at = Date.now();
    this.saveStorage();
    return workspace;
  }

  // --- Sessions ---
  async createSession(userId: string, tokenHash: string, userAgent?: string): Promise<Session> {
    const store = this.loadStorage();
    const session: Session = {
      id: 'ses_' + Math.random().toString(36).substring(2, 11),
      user_id: userId,
      token_hash: tokenHash,
      expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      created_at: Date.now(),
      user_agent: userAgent || null,
    };
    store.sessions.push(session);
    this.saveStorage();
    return session;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const store = this.loadStorage();
    const session = store.sessions.find((s) => s.token_hash === tokenHash);
    if (!session) return null;
    if (session.expires_at < Date.now()) {
      // expired
      this.deleteSessionByTokenHash(tokenHash);
      return null;
    }
    return session;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    const store = this.loadStorage();
    store.sessions = store.sessions.filter((s) => s.token_hash !== tokenHash);
    this.saveStorage();
  }

  // --- Subscriptions & Billing ---
  async getSubscription(workspaceId: string): Promise<Subscription | null> {
    const store = this.loadStorage();
    return store.subscriptions.find((s) => s.workspace_id === workspaceId) || null;
  }

  async upsertSubscription(sub: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
    const store = this.loadStorage();
    const now = Date.now();
    let existing = store.subscriptions.find((s) => s.workspace_id === sub.workspace_id);

    if (existing) {
      existing.stripe_subscription_id = sub.stripe_subscription_id;
      existing.stripe_price_id = sub.stripe_price_id;
      existing.status = sub.status;
      existing.current_period_start = sub.current_period_start;
      existing.current_period_end = sub.current_period_end;
      existing.cancel_at_period_end = sub.cancel_at_period_end;
      existing.updated_at = now;
    } else {
      existing = {
        ...sub,
        id: 'sub_' + Math.random().toString(36).substring(2, 11),
        created_at: now,
        updated_at: now,
      };
      store.subscriptions.push(existing);
    }

    this.saveStorage();
    return existing;
  }

  async isBillingEventProcessed(eventId: string): Promise<boolean> {
    const store = this.loadStorage();
    return store.processedEvents.some((e) => e.eventId === eventId);
  }

  async recordBillingEvent(eventId: string, eventType: string, summary?: string): Promise<void> {
    const store = this.loadStorage();
    if (!store.processedEvents.some((e) => e.eventId === eventId)) {
      store.processedEvents.push({
        eventId,
        eventType,
        processedAt: Date.now(),
        summary,
      });
      this.saveStorage();
    }
  }

  // --- Quotas & Usage ---
  async getUsage(workspaceId: string): Promise<{
    currentMonthCount: number;
    maxMonthlyLimit: number;
    totalRetained: number;
    maxRetainedLimit: number;
    devicesCount: number;
    maxDevicesLimit: number;
    templatesCount: number;
    maxTemplatesLimit: number;
  }> {
    const store = this.loadStorage();
    const periodKey = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
    const counter = store.usageCounters.find((c) => c.workspace_id === workspaceId && c.period_key === periodKey);
    const totalRetained = store.inspections.filter((i) => i.workspace_id === workspaceId).length;
    const devicesCount = store.devices.filter((d) => d.workspace_id === workspaceId).length;
    const templatesCount = store.templates.filter((t) => t.workspace_id === workspaceId).length;

    return {
      currentMonthCount: counter ? counter.inspections_count : 0,
      maxMonthlyLimit: 200,
      totalRetained,
      maxRetainedLimit: 1000,
      devicesCount,
      maxDevicesLimit: 200,
      templatesCount,
      maxTemplatesLimit: 25,
    };
  }

  // --- Inspections ---
  async getInspections(workspaceId: string, limit = 50, offset = 0): Promise<{ items: InspectionRecord[]; total: number }> {
    const store = this.loadStorage();
    const filtered = store.inspections
      .filter((i) => i.workspace_id === workspaceId)
      .sort((a, b) => b.created_at - a.created_at);

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  async createInspection(
    workspaceId: string,
    data: Omit<InspectionRecord, 'id' | 'workspace_id' | 'created_at'>
  ): Promise<{ success: boolean; record?: InspectionRecord; error?: string }> {
    const store = this.loadStorage();
    const usage = await this.getUsage(workspaceId);

    if (usage.currentMonthCount >= usage.maxMonthlyLimit) {
      return { success: false, error: 'Monthly quota reached (200 inspections/month). Contact support or upgrade.' };
    }
    if (usage.totalRetained >= usage.maxRetainedLimit) {
      return { success: false, error: 'Maximum retention limit reached (1,000 records). Please delete older inspections to make room.' };
    }

    const now = Date.now();
    const periodKey = new Date().toISOString().substring(0, 7);
    const record: InspectionRecord = {
      ...data,
      id: 'insp_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspaceId,
      created_at: now,
    };

    store.inspections.push(record);

    // atomic quota increment
    let counter = store.usageCounters.find((c) => c.workspace_id === workspaceId && c.period_key === periodKey);
    if (!counter) {
      counter = {
        id: 'cnt_' + Math.random().toString(36).substring(2, 11),
        workspace_id: workspaceId,
        period_key: periodKey,
        inspections_count: 1,
        updated_at: now,
      };
      store.usageCounters.push(counter);
    } else {
      counter.inspections_count += 1;
      counter.updated_at = now;
    }

    this.saveStorage();
    return { success: true, record };
  }

  async deleteInspection(workspaceId: string, inspectionId: string): Promise<boolean> {
    const store = this.loadStorage();
    const initialLen = store.inspections.length;
    store.inspections = store.inspections.filter((i) => !(i.id === inspectionId && i.workspace_id === workspaceId));
    const deleted = store.inspections.length < initialLen;
    if (deleted) this.saveStorage();
    return deleted;
  }

  // --- Devices Inventory ---
  async getDevices(workspaceId: string): Promise<Device[]> {
    const store = this.loadStorage();
    return store.devices.filter((d) => d.workspace_id === workspaceId).sort((a, b) => b.created_at - a.created_at);
  }

  async createDevice(
    workspaceId: string,
    data: Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; device?: Device; error?: string }> {
    const store = this.loadStorage();
    const existingCount = store.devices.filter((d) => d.workspace_id === workspaceId).length;
    if (existingCount >= 200) {
      return { success: false, error: 'Maximum device inventory limit (200 devices) reached.' };
    }

    const now = Date.now();
    const device: Device = {
      ...data,
      id: 'dev_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspaceId,
      created_at: now,
      updated_at: now,
    };

    store.devices.push(device);
    this.saveStorage();
    return { success: true, device };
  }

  async deleteDevice(workspaceId: string, deviceId: string): Promise<boolean> {
    const store = this.loadStorage();
    const initialLen = store.devices.length;
    store.devices = store.devices.filter((d) => !(d.id === deviceId && d.workspace_id === workspaceId));
    const deleted = store.devices.length < initialLen;
    if (deleted) this.saveStorage();
    return deleted;
  }

  // --- Checklist Templates ---
  async getTemplates(workspaceId: string): Promise<ChecklistTemplate[]> {
    const store = this.loadStorage();
    return store.templates.filter((t) => t.workspace_id === workspaceId).sort((a, b) => b.created_at - a.created_at);
  }

  async createTemplate(
    workspaceId: string,
    data: Omit<ChecklistTemplate, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; template?: ChecklistTemplate; error?: string }> {
    const store = this.loadStorage();
    const count = store.templates.filter((t) => t.workspace_id === workspaceId).length;
    if (count >= 25) {
      return { success: false, error: 'Maximum custom templates limit (25) reached.' };
    }

    const now = Date.now();
    const template: ChecklistTemplate = {
      ...data,
      id: 'tpl_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspaceId,
      created_at: now,
      updated_at: now,
    };

    store.templates.push(template);
    this.saveStorage();
    return { success: true, template };
  }

  async deleteTemplate(workspaceId: string, templateId: string): Promise<boolean> {
    const store = this.loadStorage();
    const initialLen = store.templates.length;
    store.templates = store.templates.filter((t) => !(t.id === templateId && t.workspace_id === workspaceId));
    const deleted = store.templates.length < initialLen;
    if (deleted) this.saveStorage();
    return deleted;
  }

  // --- Audit & Compliance ---
  async recordAuditEvent(workspaceId: string, userId: string | null, action: string, details?: string): Promise<void> {
    const store = this.loadStorage();
    store.auditEvents.push({
      id: 'aud_' + Math.random().toString(36).substring(2, 11),
      workspace_id: workspaceId,
      user_id: userId,
      action,
      details,
      created_at: Date.now(),
    });
    this.saveStorage();
  }

  // --- Export & Right to be Forgotten (Account Deletion) ---
  async exportWorkspaceData(workspaceId: string): Promise<{
    workspace: Workspace | null;
    devices: Device[];
    templates: ChecklistTemplate[];
    inspections: InspectionRecord[];
    exportTimestamp: string;
  }> {
    const store = this.loadStorage();
    const workspace = store.workspaces.find((w) => w.id === workspaceId) || null;
    const devices = store.devices.filter((d) => d.workspace_id === workspaceId);
    const templates = store.templates.filter((t) => t.workspace_id === workspaceId);
    const inspections = store.inspections.filter((i) => i.workspace_id === workspaceId);

    return {
      workspace,
      devices,
      templates,
      inspections,
      exportTimestamp: new Date().toISOString(),
    };
  }

  async deleteAccountAndData(userId: string): Promise<boolean> {
    const store = this.loadStorage();
    const membership = store.memberships.find((m) => m.user_id === userId);
    const workspaceId = membership?.workspace_id;

    if (workspaceId) {
      store.devices = store.devices.filter((d) => d.workspace_id !== workspaceId);
      store.templates = store.templates.filter((t) => t.workspace_id !== workspaceId);
      store.inspections = store.inspections.filter((i) => i.workspace_id !== workspaceId);
      store.usageCounters = store.usageCounters.filter((c) => c.workspace_id !== workspaceId);
      store.subscriptions = store.subscriptions.filter((s) => s.workspace_id !== workspaceId);
      store.workspaces = store.workspaces.filter((w) => w.id !== workspaceId);
      store.memberships = store.memberships.filter((m) => m.workspace_id !== workspaceId);
      store.auditEvents = store.auditEvents.filter((a) => a.workspace_id !== workspaceId);
    }

    store.sessions = store.sessions.filter((s) => s.user_id !== userId);
    store.users = store.users.filter((u) => u.id !== userId);
    this.saveStorage();
    return true;
  }
}

export const db = new DatabaseAdapter();
