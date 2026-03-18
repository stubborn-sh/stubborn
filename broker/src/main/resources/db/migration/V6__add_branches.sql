ALTER TABLE applications ADD COLUMN main_branch VARCHAR(128) DEFAULT 'main';

ALTER TABLE contracts ADD COLUMN branch VARCHAR(128);

ALTER TABLE verifications ADD COLUMN branch VARCHAR(128);

CREATE INDEX idx_contracts_branch ON contracts (application_id, branch);
CREATE INDEX idx_verifications_branch ON verifications (provider_id, branch);
