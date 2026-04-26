CREATE TABLE applications (
    id          UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    owner       VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version     BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_applications_name ON applications (name);
CREATE INDEX idx_applications_owner ON applications (owner);
