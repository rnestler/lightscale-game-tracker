\getenv db_name DB_NAME
\getenv db_user DB_USER
\getenv db_password DB_PASSWORD

SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name') AS create_database \gset
\if :create_database
CREATE DATABASE :"db_name";
\else
\echo 'Database already exists, keeping it.'
\endif

SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user') AS create_user \gset
\if :create_user
CREATE USER :"db_user" WITH PASSWORD :'db_password';
\else
\echo 'User already exists, setting its password from .env.'
ALTER USER :"db_user" WITH PASSWORD :'db_password';
\endif

GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO :"db_user";
\connect :"db_name"
GRANT ALL ON SCHEMA public TO :"db_user";
SELECT format('ALTER TABLE public.%I OWNER TO %I', tablename, :'db_user') FROM pg_tables WHERE schemaname = 'public' AND tableowner <> :'db_user' \gexec

