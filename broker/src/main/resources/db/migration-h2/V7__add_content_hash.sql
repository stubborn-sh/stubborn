ALTER TABLE contracts ADD COLUMN content_hash VARCHAR(64);

CREATE INDEX idx_contracts_content_hash ON contracts (application_id, content_hash);
