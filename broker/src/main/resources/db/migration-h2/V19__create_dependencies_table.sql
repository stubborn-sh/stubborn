-- H2 counterpart of db/migration/V19__create_dependencies_table.sql, used by the demo
-- profile. RANDOM_UUID() and TIMESTAMP WITH TIME ZONE stand in for gen_random_uuid()
-- and TIMESTAMPTZ, matching the other migrations in this directory.
CREATE TABLE dependencies (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    consumer_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    consumer_version VARCHAR(64) NOT NULL,
    provider_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL,
    declared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dependencies UNIQUE (consumer_id, consumer_version, provider_id)
);

CREATE INDEX idx_dependencies_provider ON dependencies(provider_id);
