import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Cliente único para el Core (kresko_admin): suscripciones, enrutamiento
 * y, a futuro, la tabla de registro de tenants. Vive fuera del cache
 * por-tenant de TenantManager porque su ciclo de vida es el del proceso,
 * no el de una request con tenant activo.
 */
const connectionString =
  process.env.CORE_DATABASE_URL ??
  'postgresql://postgres:Kresko0112233+@localhost:5432/kresko_admin?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const adminPrisma = new PrismaClient({ adapter });

export async function disconnectAdminPrisma(): Promise<void> {
  await adminPrisma.$disconnect();
  await pool.end();
}
