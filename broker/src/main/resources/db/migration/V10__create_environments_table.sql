-- Create environments master table for configurable environment management
CREATE TABLE environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    production BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    row_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_environments_display_order ON environments(display_order, name);

-- Seed from existing deployments
INSERT INTO environments (name)
SELECT DISTINCT environment FROM deployments
ON CONFLICT (name) DO NOTHING;
