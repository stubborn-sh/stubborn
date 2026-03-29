-- Hibernate Envers expects a 'revinfo_seq' sequence for revision ID generation.
-- V14 used SERIAL which creates 'revinfo_rev_seq' instead.
-- Create the expected sequence and re-wire the column default.
CREATE SEQUENCE revinfo_seq START WITH 1 INCREMENT BY 50;

-- Sync the sequence to current max rev value (if any rows exist)
SELECT setval('revinfo_seq', COALESCE((SELECT MAX(rev) FROM revinfo), 0) + 1, false);

-- Switch column default from SERIAL sequence to Envers-managed sequence
ALTER TABLE revinfo ALTER COLUMN rev SET DEFAULT nextval('revinfo_seq');

-- ROLLBACK:
-- ALTER TABLE revinfo ALTER COLUMN rev SET DEFAULT nextval('revinfo_rev_seq');
-- DROP SEQUENCE IF EXISTS revinfo_seq;
