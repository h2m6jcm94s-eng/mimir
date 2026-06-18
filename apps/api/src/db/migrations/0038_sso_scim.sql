CREATE TYPE sso_provider_kind AS ENUM ('saml', 'oidc', 'scim');
CREATE TYPE sso_provider_status AS ENUM ('active', 'inactive');

CREATE TABLE sso_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind sso_provider_kind NOT NULL,
  name varchar(255) NOT NULL,
  status sso_provider_status NOT NULL DEFAULT 'inactive',
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_sso_provider_tenant_id ON sso_provider(tenant_id);
CREATE INDEX idx_sso_provider_tenant_kind ON sso_provider(tenant_id, kind);

ALTER TABLE sso_provider ENABLE ROW LEVEL SECURITY;

CREATE POLICY sso_provider_tenant_isolation ON sso_provider
  USING (tenant_id = (current_setting('app.tenant_id'::text, true))::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON sso_provider TO mimir_app;

CREATE TABLE scim_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES sso_provider(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  token_hash varchar(255) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_scim_token_tenant_id ON scim_token(tenant_id);
CREATE INDEX idx_scim_token_provider_id ON scim_token(provider_id);
CREATE INDEX idx_scim_token_hash ON scim_token(token_hash);

-- SCIM tokens are looked up before a tenant context exists (the bearer token itself
-- identifies the tenant). The table still carries tenant_id as the scoping key and is
-- protected by application-layer checks, but it intentionally does not use RLS so the
-- lookup can succeed before app.tenant_id is set. This mirrors the design of
-- external_identity.
GRANT SELECT, INSERT, UPDATE, DELETE ON scim_token TO mimir_app;

-- SCIM lifecycle needs to activate/deactivate tenant memberships without destroying
-- the underlying account.
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
