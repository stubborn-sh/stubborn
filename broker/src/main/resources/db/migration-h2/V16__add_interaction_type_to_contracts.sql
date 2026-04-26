ALTER TABLE contracts ADD COLUMN interaction_type VARCHAR(20) NOT NULL DEFAULT 'HTTP';
ALTER TABLE contracts_aud ADD COLUMN interaction_type VARCHAR(20);
