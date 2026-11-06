CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
  id text PRIMARY KEY, name text NOT NULL, archived boolean NOT NULL DEFAULT false,
  website text NOT NULL DEFAULT '', profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, name text NOT NULL, email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('Super Administrator','Editor','Approver')),
  businesses text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'Active',
  password_hash text, mfa_enabled boolean NOT NULL DEFAULT false, mfa_secret jsonb, mfa_pending_secret jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret jsonb;
-- This deployment uses email/password sign-in; clear any prior MFA enrollment data.
UPDATE users SET mfa_enabled=false,mfa_secret=NULL,mfa_pending_secret=NULL WHERE mfa_enabled OR mfa_secret IS NOT NULL OR mfa_pending_secret IS NOT NULL;
CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id), title text NOT NULL DEFAULT '',
  platform text NOT NULL CHECK (platform IN ('LinkedIn','Facebook','Instagram')),
  category text NOT NULL DEFAULT '', format text NOT NULL DEFAULT 'Image', scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'Draft', image text NOT NULL DEFAULT '', variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb, sources jsonb NOT NULL DEFAULT '[]'::jsonb, approver text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE TABLE IF NOT EXISTS approvals (
  id bigserial PRIMARY KEY, post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS social_accounts (
  id text PRIMARY KEY, name text NOT NULL, business_id text REFERENCES businesses(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('LinkedIn','Facebook','Instagram')), url text NOT NULL DEFAULT '',
  personal boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'Disconnected', last_connected text NOT NULL DEFAULT 'Never connected',
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS last_error text NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS provider_post_id text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS provider_account_id text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS publish_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS provider_post_url text NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_publish_error text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY, name text NOT NULL, business_id text REFERENCES businesses(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('Image','Video','Font','Logo')), url text NOT NULL,
  dimensions text NOT NULL DEFAULT '', file_type text NOT NULL DEFAULT '', processing text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS research_sources (
  id bigserial PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL, url text NOT NULL, published_at timestamptz, checked_at timestamptz NOT NULL DEFAULT now(),
  summary text NOT NULL DEFAULT '', source_type text NOT NULL DEFAULT 'web'
);
CREATE TABLE IF NOT EXISTS website_snapshots (
  id bigserial PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  url text NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), content_hash text NOT NULL DEFAULT '',
  extracted_text text NOT NULL DEFAULT '', suggestions jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS generated_assets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, business_id text REFERENCES businesses(id) ON DELETE SET NULL,
  kind text NOT NULL, provider text NOT NULL, prompt text NOT NULL, status text NOT NULL DEFAULT 'pending',
  result jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS security_audit_events (
  id bigserial PRIMARY KEY, actor_id text REFERENCES users(id) ON DELETE SET NULL,
  event text NOT NULL, request_key text NOT NULL DEFAULT '', details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_created_idx ON security_audit_events(created_at DESC);
CREATE TABLE IF NOT EXISTS oauth_states (
  state text PRIMARY KEY, account_id text NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, redirect_uri text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS redirect_uri text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS automation_runs (
  id bigserial PRIMARY KEY, business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  run_key text NOT NULL UNIQUE, status text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz, result jsonb NOT NULL DEFAULT '{}'::jsonb, error text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS post_metrics (
  post_id text PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  platform text NOT NULL, stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS account_metrics (
  account_id text PRIMARY KEY REFERENCES social_accounts(id) ON DELETE CASCADE,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb, fetched_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS posts_business_date_idx ON posts(business_id, scheduled_at);
CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
CREATE INDEX IF NOT EXISTS posts_publish_due_idx ON posts(scheduled_at) WHERE status='Scheduled';
CREATE INDEX IF NOT EXISTS research_business_idx ON research_sources(business_id, checked_at DESC);

-- New installations start with no sample businesses or social accounts. Configure real workspaces in the app.
