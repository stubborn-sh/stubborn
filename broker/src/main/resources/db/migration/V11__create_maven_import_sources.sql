CREATE TABLE maven_import_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_url VARCHAR(2048) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    encrypted_password TEXT,
    sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_synced_version VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_maven_import_sources_repo_coords ON maven_import_sources(repository_url, group_id, artifact_id);
CREATE INDEX idx_maven_import_sources_sync ON maven_import_sources(sync_enabled) WHERE sync_enabled = TRUE;
