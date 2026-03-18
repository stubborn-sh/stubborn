CREATE TABLE applications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    owner       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version     BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_applications_name ON applications (name);
CREATE INDEX idx_applications_owner ON applications (owner);
