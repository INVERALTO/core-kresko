import type { PrismaClient } from '@prisma/client';
import { withTenant, withTenantFrom, TenantManager } from '../tenancy/tenant-manager';
import { TenantExtractor, QueueMessageTenantSource } from '../tenancy/tenant-extractor';

// -----------------------------------------------------------------
// 1. Repositorio: recibe el PrismaClient como parámetro explícito.
//    No conoce AsyncLocalStorage, tenants ni el extractor.
// -----------------------------------------------------------------
export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getProfile(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new Error('Usuario no encontrado');
    return { id: user.id, name: user.name };
  }
}

// -----------------------------------------------------------------
// 2a. Entrypoint HTTP propio (sin framework): ya tienes el JWT
//     decodificado y verificado en `claims`. El extractor por
//     defecto ya sabe leer `claims.tenant_id`.
// -----------------------------------------------------------------
export async function handleHttpRequest(claims: Record<string, unknown>, email: string) {
  return withTenantFrom(claims, async (prisma) => {
    const service = new UserService(new UserRepository(prisma));
    return service.getProfile(email);
  });
}

// -----------------------------------------------------------------
// 2b. Entrypoint de cola: el mensaje trae el tenantId en `metadata`.
//     Usamos un extractor específico para este caso (solo la
//     estrategia de cola, sin JWT ni headers).
// -----------------------------------------------------------------
const queueOnlyExtractor = new TenantExtractor([new QueueMessageTenantSource()]);

export async function handleQueueMessage(message: { metadata: { tenantId: string }; email: string }) {
  return withTenantFrom(
    message,
    async (prisma) => {
      const service = new UserService(new UserRepository(prisma));
      return service.getProfile(message.email);
    },
    queueOnlyExtractor,
  );
}

// -----------------------------------------------------------------
// 3. Código que vive MÁS ABAJO en la misma pila, dentro de un
//    contexto ya activo, y prefiere tomar el prisma del ALS en vez
//    de recibirlo como parámetro.
// -----------------------------------------------------------------
export async function auditLastLogin(email: string) {
  const prisma = await TenantManager.getPrisma(); // reutiliza el tenant ya activo
  await prisma.user.update({
    where: { email },
    data: { name: `${email} (login auditado)` }, // ejemplo ilustrativo
  });
}

// -----------------------------------------------------------------
// 4. Arranque manual de ejemplo
// -----------------------------------------------------------------
async function main() {
  // Simula un JWT ya verificado en algún middleware de autenticación propio.
  const fakeJwtClaims = { tenant_id: 'ACME-Corp-01', sub: 'user@acme.com' };
  const profile = await handleHttpRequest(fakeJwtClaims, 'user@acme.com');
  console.log(profile);

  // Simula un mensaje de cola.
  await handleQueueMessage({
    metadata: { tenantId: 'acme-corp-01' },
    email: 'user@acme.com',
  });
}

if (require.main === module) {
  main().finally(() => TenantManager.shutdown());
}
