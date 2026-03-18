CREATE TABLE contracts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id   UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    version          VARCHAR(64) NOT NULL,
    contract_name    VARCHAR(256) NOT NULL,
    content          TEXT NOT NULL,
    content_type     VARCHAR(100) NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    row_version      BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_contracts_app_version_name UNIQUE (application_id, version, contract_name)
);

CREATE INDEX idx_contracts_application_id ON contracts (application_id);
CREATE INDEX idx_contracts_app_version ON contracts (application_id, version);
