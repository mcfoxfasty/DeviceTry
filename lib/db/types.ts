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

export * from './schema';

export interface BillingCustomer {
  id: string;
  workspace_id: string;
  stripe_customer_id: string;
  stripe_account_id?: string | null;
  created_at: number;
}

export interface ProcessedBillingEvent {
  event_id: string;
  event_type: string;
  processed_at: number;
  payload_summary?: string | null;
}

export interface IDatabaseAdapter {
  // User & Auth
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUserWithWorkspace(params: {
    email: string;
    passwordHash: string;
    name: string;
    companyName?: string;
  }): Promise<{ user: User; workspace: Workspace }>;
  createSession(userId: string, tokenHash: string, userAgent?: string): Promise<Session>;
  getSessionByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteUserAndWorkspace(userId: string): Promise<boolean>;

  // Workspace
  getWorkspaceById(id: string): Promise<Workspace | null>;
  getWorkspaceByUserId(userId: string): Promise<Workspace | null>;
  updateWorkspaceBranding(
    workspaceId: string,
    branding: { companyName?: string | null; logoUrl?: string | null }
  ): Promise<Workspace | null>;

  // Billing & Subscriptions
  getBillingCustomer(workspaceId: string): Promise<BillingCustomer | null>;
  getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | null>;
  upsertBillingCustomer(params: {
    workspace_id: string;
    stripe_customer_id: string;
    stripe_account_id?: string | null;
  }): Promise<BillingCustomer>;
  getSubscription(workspaceId: string): Promise<Subscription | null>;
  upsertSubscription(sub: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription>;
  recordBillingEvent(eventId: string, eventType: string, summary?: string): Promise<void>;
  isBillingEventProcessed(eventId: string): Promise<boolean>;

  // Inspections
  createInspection(
    workspaceId: string,
    data: Omit<InspectionRecord, 'id' | 'workspace_id' | 'created_at'>
  ): Promise<{ success: boolean; record?: InspectionRecord; error?: string }>;
  getInspections(
    workspaceId: string,
    limit?: number,
    offset?: number
  ): Promise<{ items: InspectionRecord[]; total: number }>;
  getInspectionById(workspaceId: string, id: string): Promise<InspectionRecord | null>;
  deleteInspection(workspaceId: string, id: string): Promise<boolean>;

  // Devices (Inventory)
  getDevices(workspaceId: string): Promise<Device[]>;
  createDevice(
    workspaceId: string,
    data: Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; device?: Device; error?: string }>;
  updateDevice(
    workspaceId: string,
    deviceId: string,
    data: Partial<Omit<Device, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>
  ): Promise<Device | null>;
  deleteDevice(workspaceId: string, deviceId: string): Promise<boolean>;

  // Templates
  getTemplates(workspaceId: string): Promise<ChecklistTemplate[]>;
  createTemplate(
    workspaceId: string,
    data: Omit<ChecklistTemplate, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; template?: ChecklistTemplate; error?: string }>;
  deleteTemplate(workspaceId: string, templateId: string): Promise<boolean>;

  // Audits & Exports
  recordAuditEvent(
    workspaceId: string,
    userId: string | null,
    action: string,
    details?: string
  ): Promise<void>;
  exportWorkspaceData(workspaceId: string): Promise<{
    workspace: Workspace | null;
    subscription: Subscription | null;
    devices: Device[];
    templates: ChecklistTemplate[];
    inspections: InspectionRecord[];
    exportedAt: string;
  }>;
}
