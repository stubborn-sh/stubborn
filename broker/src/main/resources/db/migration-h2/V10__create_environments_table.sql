CREATE TABLE environments (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    production BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_environments_display_order ON environments(display_order, name);

-- Seed from existing deployments (H2 compatible: use MERGE instead of ON CONFLICT)
MERGE INTO environments (name)
SELECT DISTINCT environment FROM deployments;
