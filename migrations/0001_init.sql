-- DeviceTry Cloudflare D1 Database Schema
-- Migration 0001: Initial Schema for Pro Subscribers, Billing, Workspaces & Audits

-- 1. Users table (Pro subscribers only)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Workspaces table (one workspace per Pro user)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  branding_company_name TEXT,
  branding_logo_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

-- 3. Memberships table (for access control)
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner', -- 'owner' | 'member'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_unique ON memberships(workspace_id, user_id);

-- 4. Sessions table (signed session tokens for subscriber authentication)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 5. Billing Customers (Stripe Customer associations)
CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  stripe_account_id TEXT, -- UK live or test account
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_billing_stripe_customer ON billing_customers(stripe_customer_id);

-- 6. Subscriptions (Authoritative server-side status: active, canceled, past_due, trialing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT UNIQUE NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'active' | 'canceled' | 'past_due' | 'incomplete'
  current_period_start INTEGER NOT NULL,
  current_period_end INTEGER NOT NULL,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 7. Processed Billing Events (Idempotency table to avoid duplicate or out-of-order webhook processing)
CREATE TABLE IF NOT EXISTS processed_billing_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  payload_summary TEXT
);

-- 8. Devices table (Inventory tracking up to 200 items per workspace)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model_identifier TEXT,
  serial_number TEXT,
  assigned_to TEXT,
  category TEXT DEFAULT 'laptop', -- 'laptop' | 'desktop' | 'peripherals' | 'display' | 'other'
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_devices_workspace ON devices(workspace_id);

-- 9. Inspection Checklist Templates (up to 25 custom templates per workspace)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tests_config TEXT NOT NULL, -- JSON array of test keys
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_workspace ON templates(workspace_id);

-- 10. Inspections table (compact structured results, up to 1,000 retained)
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  device_id TEXT,
  device_label TEXT,
  operator_name TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  summary_status TEXT NOT NULL, -- 'passed' | 'warning' | 'failed'
  tests_results TEXT NOT NULL, -- JSON compact results
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inspections_workspace_created ON inspections(workspace_id, created_at DESC);

-- 11. Usage Counters (monthly quotas: 200 new cloud inspections per billing period)
CREATE TABLE IF NOT EXISTS usage_counters (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  period_key TEXT NOT NULL, -- 'YYYY-MM'
  inspections_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_workspace_period ON usage_counters(workspace_id, period_key);

-- 12. Minimal Audit Events
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL, -- 'signin' | 'subscribe' | 'export' | 'delete_account'
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id, created_at DESC);
