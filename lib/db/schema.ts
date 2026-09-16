export interface User {
  id: string;
  email: string;
  password_hash?: string;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  branding_company_name?: string | null;
  branding_logo_url?: string | null;
  created_at: number;
  updated_at: number;
}

export interface Membership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at: number;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  user_agent?: string | null;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: number;
  created_at: number;
  updated_at: number;
}

export interface Device {
  id: string;
  workspace_id: string;
  name: string;
  model_identifier?: string | null;
  serial_number?: string | null;
  assigned_to?: string | null;
  category: 'laptop' | 'desktop' | 'peripherals' | 'display' | 'other';
  notes?: string | null;
  created_at: number;
  updated_at: number;
}

export interface ChecklistTemplate {
  id: string;
  workspace_id: string;
  title: string;
  description?: string | null;
  tests_config: string[]; // JSON array of test keys: 'mic' | 'webcam' | 'keyboard' | 'mouse' | 'speakers' | 'display' | 'gamepad' | 'battery'
  created_at: number;
  updated_at: number;
}

export interface InspectionRecord {
  id: string;
  workspace_id: string;
  device_id?: string | null;
  device_label?: string | null;
  operator_name?: string | null;
  locale: string;
  summary_status: 'passed' | 'warning' | 'failed' | 'inconclusive';
  tests_results: Record<string, {
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported' | 'skipped';
    classification: 'browser' | 'user' | 'inconclusive' | 'unsupported' | 'skipped';
    details?: string;
    metrics?: Record<string, unknown>;
  }>;
  notes?: string | null;
  created_at: number;
}

export interface UsageCounter {
  id: string;
  workspace_id: string;
  period_key: string; // 'YYYY-MM'
  inspections_count: number;
  updated_at: number;
}

export interface AuditEvent {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  action: string;
  details?: string | null;
  created_at: number;
}
