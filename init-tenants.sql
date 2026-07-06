-- Creamos los usuarios (roles) para cada inquilino
CREATE USER acme_user WITH PASSWORD 'acme_pass';
CREATE USER globex_user WITH PASSWORD 'globex_pass';

-- Creamos las bases de datos físicas.
-- IMPORTANTE: el nombre DEBE seguir kresko_tenant_{id}, que es lo que
-- construye prisma-client-factory.ts (buildConnectionString). El id
-- ("acme", "globex") debe cumplir el patrón de tenant-id.ts:
-- minúsculas, números y guion bajo, máx. 63 caracteres.
CREATE DATABASE kresko_tenant_acme OWNER acme_user;
CREATE DATABASE kresko_tenant_globex OWNER globex_user;

-- Otorgamos privilegios
GRANT ALL PRIVILEGES ON DATABASE kresko_tenant_acme TO acme_user;
GRANT ALL PRIVILEGES ON DATABASE kresko_tenant_globex TO globex_user;

-- Registramos el catálogo de tenants en el control-plane (kresko_admin).
-- Se ejecuta aparte, conectado a kresko_admin (no a las BD de tenant de arriba).
-- INSERT INTO "Tenant" (id, slug, name, status, "createdAt") VALUES
--   ('acme', 'acme', 'Acme Corp', 'ACTIVE', now()),
--   ('globex', 'globex', 'Globex Inc', 'ACTIVE', now());