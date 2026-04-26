CREATE TABLE git_import_sources (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    application_name VARCHAR(255) NOT NULL,
    repository_url VARCHAR(2048) NOT NULL,
    branch VARCHAR(255) NOT NULL DEFAULT 'main',
    contracts_directory VARCHAR(1024) NOT NULL DEFAULT 'src/test/resources/contracts/',
    auth_type VARCHAR(32) DEFAULT 'NONE',
    username VARCHAR(255),
    encrypted_token TEXT,
    sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_synced_commit VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_git_import_sources_repo_app ON git_import_sources(repository_url, application_name);
CREATE INDEX idx_git_import_sources_sync ON git_import_sources(sync_enabled);
