import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { assertValidTenantId } from './tenant-id';

interface CacheEntry {
  client: PrismaClient;
  pool: Pool;
  lastUsedAt: number;
  /** Se resuelve cuando la conexión ya fue verificada; permite que
   *  peticiones concurrentes por el mismo tenant esperen la misma
   *  validación en vez de disparar N intentos de conexión. */
  ready: Promise<void>;
}

// TODO: mover a variables de entorno cuando exista el .env real del proyecto.
const DB_HOST = process.env.TENANT_DB_HOST ?? 'localhost';
const DB_PORT = Number(process.env.TENANT_DB_PORT ?? 5432);
const DB_USER = process.env.TENANT_DB_USER ?? 'postgres';
const DB_PASSWORD = process.env.TENANT_DB_PASSWORD ?? 'Kresko0112233+';

/** Parsea un entero desde env; si no está definido o es inválido, usa el default. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Nota: 10_000 ms (10s) es un default agresivo pensado para desarrollo/pruebas
// rápidas en local. Antes de producción, sube TENANT_MAX_IDLE_MS (p. ej. a
// 600000 = 10 min) para evitar reconectar constantemente tenants activos.
const MAX_IDLE_MS = envInt('TENANT_MAX_IDLE_MS', 10_000); // cierra clientes sin uso tras N ms
const SWEEP_INTERVAL_MS = 60 * 1000; // revisa inactividad cada 1 min
const MAX_CACHED_CLIENTS = envInt('TENANT_MAX_CACHED_CLIENTS', 50); // techo duro de conexiones simultáneas

/** Código de error de libpq/Postgres para "la base de datos no existe". */
const PG_INVALID_CATALOG_NAME = '3D000';

export class TenantDatabaseNotFoundError extends Error {
  constructor(public readonly tenantId: string) {
    super(
      `[TenantManager] La base de datos "kresko_tenant_${tenantId}" no existe. ` +
        '¿Falta ejecutar el aprovisionamiento de este tenant?',
    );
    this.name = 'TenantDatabaseNotFoundError';
  }
}

class PrismaClientFactory {
  private cache = new Map<string, CacheEntry>();
  private sweepTimer: NodeJS.Timeout;

  constructor() {
    // .unref() para que este timer no impida que el proceso termine (útil en tests/scripts)
    this.sweepTimer = setInterval(() => this.evictIdle(), SWEEP_INTERVAL_MS).unref();
  }

  private buildConnectionString(tenantId: string): string {
    const dbName = `kresko_tenant_${tenantId}`;
    return `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${dbName}?schema=public`;
  }

  private isDatabaseNotFoundError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === PG_INVALID_CATALOG_NAME
    );
  }

  /**
   * Punto único de acceso a un PrismaClient de tenant.
   * - Cache hit: reutiliza pool/cliente existente (no abre conexiones nuevas).
   * - Cache miss: crea Pool + PrismaPg + PrismaClient, y valida la
   *   conexión inmediatamente (SELECT 1) para fallar rápido y con un
   *   error claro si `kresko_tenant_{tenantId}` no fue creada todavía.
   */
  async getClient(tenantId: string): Promise<PrismaClient> {
    assertValidTenantId(tenantId);

    const cached = this.cache.get(tenantId);
    if (cached) {
      cached.lastUsedAt = Date.now();
      await cached.ready;
      return cached.client;
    }

    if (this.cache.size >= MAX_CACHED_CLIENTS) {
      this.evictOldest();
    }

    const pool = new Pool({ connectionString: this.buildConnectionString(tenantId) });
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({ adapter });

    const entry: CacheEntry = {
      client,
      pool,
      lastUsedAt: Date.now(),
      ready: Promise.resolve(),
    };

    entry.ready = client
      .$queryRaw`SELECT 1`
      .then(() => undefined)
      .catch(async (err: unknown) => {
        this.cache.delete(tenantId);
        await client.$disconnect().catch(() => {});
        await pool.end().catch(() => {});
        if (this.isDatabaseNotFoundError(err)) {
          throw new TenantDatabaseNotFoundError(tenantId);
        }
        throw err;
      });

    this.cache.set(tenantId, entry);
    await entry.ready;
    return client;
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastUsedAt < oldestTime) {
        oldestTime = entry.lastUsedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) void this.closeTenant(oldestKey);
  }

  private evictIdle(): void {
    const now = Date.now();
    for (const [tenantId, entry] of this.cache) {
      if (now - entry.lastUsedAt > MAX_IDLE_MS) {
        void this.closeTenant(tenantId);
      }
    }
  }

  /** Cierra y descarta el cliente/pool de un tenant específico. */
  closeTenant(tenantId: string): Promise<void> {
    const entry = this.cache.get(tenantId);
    if (!entry) return Promise.resolve();
    this.cache.delete(tenantId);
    return Promise.all([
      entry.client.$disconnect().catch(() => {}),
      entry.pool.end().catch(() => {}),
    ]).then(() => undefined);
  }

  /** Cierre ordenado de todos los tenants activos (shutdown de la app). */
  async shutdownAll(): Promise<void> {
    clearInterval(this.sweepTimer);
    const tenantIds = [...this.cache.keys()];
    await Promise.all(tenantIds.map((id) => this.closeTenant(id)));
  }

  /** Utilidad de introspección, útil para health-checks o métricas. */
  get activeTenantCount(): number {
    return this.cache.size;
  }
}

export const prismaClientFactory = new PrismaClientFactory();
