// src/tenancy/provisioning/tenant-db-provisioner.ts
//
// Aprovisiona la base de datos física de un tenant nuevo, en dos pasos:
//   1) CREATE DATABASE kresko_tenant_{id}
//   2) `prisma db push` contra esa base, para dejarla con el schema listo
//
// Decisiones explícitas (para que no queden implícitas ni se asuman mal):
//
// - Reutiliza las MISMAS credenciales globales que ya usa
//   prisma-client-factory.ts (TENANT_DB_HOST/PORT/USER/PASSWORD). NO crea
//   un rol de Postgres por-tenant como sugiere init-tenants.sql, porque el
//   runtime actual siempre se conecta con el usuario global sin importar
//   quién sea el owner de la base. Si más adelante quieres aislar por rol
//   de Postgres, hay que tocar también prisma-client-factory.ts para que
//   use credenciales por-tenant al conectarse, no solo al crearlas aquí.
//
// - Usa `prisma db push`, no `prisma migrate deploy`, porque este proyecto
//   no tiene carpeta prisma/migrations (verify-tenant-schema.ts ya asume
//   "db push"). Si en algún momento migran a `prisma migrate`, este archivo
//   hay que actualizarlo también.
//
// - schema.prisma hoy declara Dummy, User y Tenant en el MISMO archivo.
//   Este push va a crear también la tabla "Tenant" dentro de la base de
//   cada tenant, aunque esa tabla es exclusiva del control-plane
//   (kresko_admin). Es un problema preexistente del schema, no algo
//   introducido acá — pero es información real que necesitas antes de
//   llevar esto a producción: separa el schema de negocio (por-tenant)
//   del schema del control-plane (admin) en dos archivos .prisma distintos.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { assertValidTenantId } from '../tenant-id.js';

const execFileAsync = promisify(execFile);

// ESM polyfill para __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_HOST = process.env.TENANT_DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.TENANT_DB_PORT ?? 5432);
const DB_USER = process.env.TENANT_DB_USER ?? 'postgres';
const DB_PASSWORD = process.env.TENANT_DB_PASSWORD ?? 'Kresko0112233+';

/** Código de error de Postgres: "la base de datos ya existe". */
const PG_DUPLICATE_DATABASE = '42P04';

export class TenantProvisioningError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'TenantProvisioningError';
  }
}

function buildConnectionString(dbName: string): string {
  return `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${dbName}?schema=public`;
}

function isDuplicateDatabaseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === PG_DUPLICATE_DATABASE;
}

/**
 * Paso 1: CREATE DATABASE kresko_tenant_{id}.
 * Se conecta a la base de mantenimiento "postgres" porque CREATE DATABASE
 * no puede correr dentro de una transacción ni contra la base que se está
 * creando.
 */
async function createPhysicalDatabase(tenantId: string): Promise<void> {
  const dbName = `kresko_tenant_${tenantId}`;
  const maintenancePool = new Pool({ connectionString: buildConnectionString('postgres') });

  try {
    // El nombre de una base no se puede parametrizar con placeholders ($1)
    // en DDL. Es seguro interpolarlo aquí porque tenantId ya pasó por
    // assertValidTenantId() (solo [a-z0-9_], nunca comillas ni ';').
    console.log(`[provisioner] Creando base física: ${dbName}`);
    await maintenancePool.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[provisioner] ✓ Base ${dbName} creada exitosamente`);
  } catch (err) {
    if (isDuplicateDatabaseError(err)) {
      throw new TenantProvisioningError(
        `La base "${dbName}" ya existe. Si este id/slug se reutilizó tras un borrado ` +
          '"hard" (ver deleteTenant en tenants.ts), la base física anterior quedó huérfana ' +
          'y hay que limpiarla manualmente (DROP DATABASE) antes de reaprovisionar.',
        err,
      );
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new TenantProvisioningError(`No se pudo crear la base "${dbName}": ${errorMsg}`, err);
  } finally {
    await maintenancePool.end();
  }
}

/**
 * Paso 2: aplica el schema de Prisma a la base recién creada.
 * Usa execSync con npx para ejecutar prisma db push
 */
async function pushTenantSchema(tenantId: string): Promise<void> {
  const dbName = `kresko_tenant_${tenantId}`;
  const projectRoot = path.resolve(__dirname, '../../..');
  const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
  const connectionString = buildConnectionString(dbName);

  try {
    console.log(`[provisioner] Ejecutando "prisma db push" en ${dbName}...`);
    
    const { execSync } = await import('node:child_process');
    const output = execSync(
      `npx prisma db push --schema="${schemaPath}" --accept-data-loss`,
      {
        cwd: projectRoot,
        env: { ...process.env, DATABASE_URL: connectionString },
        encoding: 'utf-8',
      }
    );
    
    console.log(`[provisioner] prisma output: ${output}`);
    console.log(`[provisioner] ✓ Schema aplicado exitosamente en ${dbName}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[provisioner] ✗ Error en "prisma db push":`, err);
    throw new TenantProvisioningError(`"prisma db push" falló contra "${dbName}": ${errorMsg}`, err);
  }
}

/**
 * Aprovisiona de punta a punta la base física de un tenant nuevo.
 *
 * Se asume llamado DESPUÉS de insertar la fila en el catálogo
 * (adminPrisma.tenant.create). Si esto lanza, quien llama debe revertir
 * esa fila para no dejar un tenant "fantasma" en el catálogo sin base
 * física real (ver createTenant en tenants.ts, que hace exactamente eso).
 *
 * Es una operación de varios segundos (CREATE DATABASE + spawn de un
 * proceso `prisma db push`): normal para una acción de panel admin,
 * pero no la llames desde un flujo de alta frecuencia sin poner algo
 * de por medio (cola, timeout, etc.).
 */
export async function provisionTenantDatabase(tenantId: string): Promise<void> {
  assertValidTenantId(tenantId);
  await createPhysicalDatabase(tenantId);
  await pushTenantSchema(tenantId);
}

/**
 * Elimina la base física de un tenant (DROP DATABASE).
 * Usado para limpiar tenants huérfanos o al desaprovisionar.
 */
export async function dropTenantDatabase(tenantId: string): Promise<void> {
  assertValidTenantId(tenantId);
  const dbName = `kresko_tenant_${tenantId}`;
  const maintenancePool = new Pool({ connectionString: buildConnectionString('postgres') });

  try {
    console.log(`[provisioner] Eliminando base física: ${dbName}`);
    await maintenancePool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    console.log(`[provisioner] ✓ Base ${dbName} eliminada`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new TenantProvisioningError(`No se pudo eliminar la base "${dbName}": ${errorMsg}`, err);
  } finally {
    await maintenancePool.end();
  }
}
