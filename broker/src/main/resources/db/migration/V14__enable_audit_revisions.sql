-- Envers revision tracking table
CREATE TABLE revinfo (
    rev SERIAL PRIMARY KEY,
    revtstmp BIGINT NOT NULL
);

-- Envers audit tables for each audited entity
CREATE TABLE applications_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    name VARCHAR(128),
    description TEXT,
    owner VARCHAR(100),
    main_branch VARCHAR(128),
    repository_url VARCHAR(2048),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE contracts_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    application_id UUID,
    version VARCHAR(64),
    contract_name VARCHAR(256),
    content TEXT,
    content_type VARCHAR(100),
    branch VARCHAR(128),
    content_hash VARCHAR(64),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE verifications_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    provider_id UUID,
    provider_version VARCHAR(64),
    consumer_id UUID,
    consumer_version VARCHAR(64),
    status VARCHAR(20),
    details TEXT,
    branch VARCHAR(128),
    verified_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE webhooks_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    application_id UUID,
    event_type VARCHAR(64),
    url VARCHAR(2048),
    headers JSONB,
    body_template TEXT,
    enabled BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE git_import_sources_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    application_name VARCHAR(255),
    repository_url VARCHAR(2048),
    branch VARCHAR(255),
    contracts_directory VARCHAR(1024),
    auth_type VARCHAR(32),
    username VARCHAR(255),
    encrypted_token TEXT,
    sync_enabled BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    last_synced_commit VARCHAR(64),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE maven_import_sources_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    repository_url VARCHAR(2048),
    group_id VARCHAR(255),
    artifact_id VARCHAR(255),
    username VARCHAR(255),
    encrypted_password TEXT,
    sync_enabled BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    last_synced_version VARCHAR(128),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE environments_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    name VARCHAR(64),
    description TEXT,
    display_order INT,
    production BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE deployments_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    application_id UUID,
    environment VARCHAR(64),
    version VARCHAR(64),
    deployed_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

CREATE TABLE version_tags_aud (
    id UUID NOT NULL,
    rev INT NOT NULL REFERENCES revinfo(rev),
    revtype SMALLINT,
    application_id UUID,
    version VARCHAR(64),
    tag VARCHAR(128),
    created_at TIMESTAMPTZ,
    PRIMARY KEY (id, rev)
);

-- API-level audit log for tracking all mutating REST operations
CREATE TABLE api_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    principal VARCHAR(255) NOT NULL,
    action VARCHAR(32) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(255),
    request_summary TEXT,
    response_status INT,
    ip_address VARCHAR(45),
    trace_id VARCHAR(64)
);

CREATE INDEX idx_api_audit_timestamp ON api_audit_log(timestamp DESC);
CREATE INDEX idx_api_audit_principal ON api_audit_log(principal);
CREATE INDEX idx_api_audit_resource ON api_audit_log(resource_type, resource_id);

-- ROLLBACK:
-- DROP TABLE IF EXISTS api_audit_log;
-- DROP TABLE IF EXISTS version_tags_aud;
-- DROP TABLE IF EXISTS deployments_aud;
-- DROP TABLE IF EXISTS environments_aud;
-- DROP TABLE IF EXISTS maven_import_sources_aud;
-- DROP TABLE IF EXISTS git_import_sources_aud;
-- DROP TABLE IF EXISTS webhooks_aud;
-- DROP TABLE IF EXISTS verifications_aud;
-- DROP TABLE IF EXISTS contracts_aud;
-- DROP TABLE IF EXISTS applications_aud;
-- DROP TABLE IF EXISTS revinfo;
