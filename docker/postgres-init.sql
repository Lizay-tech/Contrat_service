-- Runs once on first PostgreSQL container start (as the superuser).
-- Creates a NON-superuser application role that OWNS the service database so
-- that Row Level Security is actually enforced for the service (superusers, and
-- without FORCE also owners, bypass RLS — we use FORCE + a non-superuser role).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educa') THEN
    CREATE ROLE educa WITH LOGIN PASSWORD 'educa' NOSUPERUSER CREATEDB;
  END IF;
END $$;

SELECT 'CREATE DATABASE educa_contrat_service OWNER educa'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'educa_contrat_service')\gexec

GRANT ALL PRIVILEGES ON DATABASE educa_contrat_service TO educa;
