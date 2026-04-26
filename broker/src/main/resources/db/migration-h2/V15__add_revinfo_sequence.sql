-- Hibernate Envers expects a 'revinfo_seq' sequence for revision ID generation.
CREATE SEQUENCE IF NOT EXISTS revinfo_seq START WITH 1 INCREMENT BY 50;
