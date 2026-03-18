CREATE TABLE deployments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id   UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    environment      VARCHAR(64) NOT NULL,
    version          VARCHAR(64) NOT NULL,
    deployed_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    row_version      BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_deployments_app_env UNIQUE (application_id, environment)
);

CREATE INDEX idx_deployments_environment ON deployments (environment);
CREATE INDEX idx_deployments_application_id ON deployments (application_id);
