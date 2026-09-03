-- A consumer's declared dependency on a provider.
--
-- Until now an HTTP consumer/provider relationship only existed retrospectively, as a
-- side effect of recording a verification, so a consumer that had never verified was
-- indistinguishable from an unrelated application. Messaging already declared its
-- dependencies up front via contract_topics; this gives HTTP the same footing.
CREATE TABLE dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    consumer_version VARCHAR(64) NOT NULL,
    provider_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL,
    declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dependencies UNIQUE (consumer_id, consumer_version, provider_id)
);

-- can-i-deploy resolves a provider's declared consumers on every check.
CREATE INDEX idx_dependencies_provider ON dependencies(provider_id);
