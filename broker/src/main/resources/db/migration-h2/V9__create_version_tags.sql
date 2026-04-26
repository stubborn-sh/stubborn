CREATE TABLE version_tags (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version VARCHAR(64) NOT NULL,
    tag VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_version_tags UNIQUE (application_id, version, tag)
);

CREATE INDEX idx_version_tags_app_tag ON version_tags(application_id, tag);
