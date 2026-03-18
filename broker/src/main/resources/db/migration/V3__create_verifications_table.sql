CREATE TABLE verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    provider_version    VARCHAR(64) NOT NULL,
    consumer_id         UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    consumer_version    VARCHAR(64) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    details             TEXT,
    verified_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    row_version         BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_verifications_provider_consumer UNIQUE (provider_id, provider_version, consumer_id, consumer_version)
);

CREATE INDEX idx_verifications_provider ON verifications (provider_id, provider_version);
CREATE INDEX idx_verifications_consumer ON verifications (consumer_id);
