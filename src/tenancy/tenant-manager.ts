import type { PrismaClient } from '@prisma/client';
import { runWithTenant, getCurrentTenantId, tryGetCurrentTenantId } from './tenant-context';
import { prismaClientFactory } from './prisma-client-factory';
import { TenantExtractor } from './tenant-extractor';

/**
 * Punto de entrada universal para código que no depende de ningún
 * framework web (workers, colas, scripts, entrypoints propios).
 *
 * Dos formas de uso:
 *
 * 1) Con tenantId explícito — establece el contexto ALS y lo mantiene
 *    activo durante toda la ejecución de `fn`, incluida cualquier
 *    llamada anidada a TenantManager.getPrisma() más abajo en la pila:
 *
 *      await withTenant(tenantId, async (prisma) => {
 *        return prisma.user.findMany();
 *      });
 *
 * 2) Sin tenantId — reutiliza el tenant ya activo en el AsyncLocalStorage
 *    (útil cuando withTenant se llama desde dentro de un contexto que
 *    otro withTenant/runWithTenant ya estableció más arriba):
 *
 *      await withTenant(async (prisma) => {
 *        return prisma.user.findMany();
 *      });
 *
 * Integración con el aislamiento: en la variante (1), `withTenant` es
 * el único lugar donde nace el contexto de tenant para esa ejecución;
 * en la variante (2), delega en getCurrentTenantId(), que revienta
 * (fail-closed) si nadie activó un tenant antes. Nunca hay una ruta
 * donde el PrismaClient devuelto pueda ser "de nadie" o "por defecto".
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (prisma: PrismaClient) => Promise<T>,
): Promise<T>;
export async function withTenant<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T>;
export async function withTenant<T>(
  tenantIdOrFn: string | ((prisma: PrismaClient) => Promise<T>),
  maybeFn?: (prisma: PrismaClient) => Promise<T>,
): Promise<T> {
  if (typeof tenantIdOrFn === 'string') {
    const tenantId = tenantIdOrFn;
    const fn = maybeFn as (prisma: PrismaClient) => Promise<T>;
    return runWithTenant(tenantId, async () => {
      const prisma = await prismaClientFactory.getClient(tenantId);
      return fn(prisma);
    });
  }

  const fn = tenantIdOrFn;
  const tenantId = getCurrentTenantId(); // lanza si no hay tenant activo
  const prisma = await prismaClientFactory.getClient(tenantId);
  return fn(prisma);
}

/** Extractor por defecto, compartido, para el caso común (JWT -> header -> cola). */
const defaultTenantExtractor = TenantExtractor.default();

/**
 * Cierra el ciclo completo en un solo paso:
 *
 *   Request/Payload -> TenantExtractor -> tenantId validado
 *   -> withTenant(...) -> PrismaClient aislado
 *
 * `source` es lo que sea que tengas a mano en tu entrypoint: el
 * payload JWT decodificado, un objeto request-like con `.headers`,
 * o el mensaje crudo de una cola. El extractor decide de dónde sacar
 * el tenantId; withTenantFrom nunca inventa un tenantId por su cuenta.
 *
 * Puedes inyectar un TenantExtractor distinto (con tus propias
 * TenantIdSource) si el default no aplica a tu caso.
 */
export async function withTenantFrom<T>(
  source: unknown,
  fn: (prisma: PrismaClient) => Promise<T>,
  extractor: TenantExtractor = defaultTenantExtractor,
): Promise<T> {
  const tenantId = extractor.extract(source);
  return withTenant(tenantId, fn);
}

/**
 * API pública que el resto de la aplicación debe usar. Nadie fuera
 * de esta carpeta debería importar tenant-context.ts o
 * prisma-client-factory.ts directamente.
 *
 * Integración con el aislamiento de inquilinos:
 * - `runWithTenant` es el único lugar donde se "activa" un tenant
 *   (normalmente desde un middleware HTTP, apenas se resuelve el
 *   tenantId del JWT/header).
 * - `getPrisma` nunca recibe un tenantId como argumento: lo lee del
 *   contexto async activo. Esto hace estructuralmente imposible que
 *   un servicio de negocio "se equivoque de tenant" pasando el
 *   parámetro incorrecto, porque no hay parámetro que pasar.
 */
export const TenantManager = {
  runWithTenant,
  getCurrentTenantId,
  tryGetCurrentTenantId,

  /** Obtiene (o crea) el PrismaClient del tenant activo en el contexto actual. */
  async getPrisma(): Promise<PrismaClient> {
    const tenantId = getCurrentTenantId();
    return prismaClientFactory.getClient(tenantId);
  },

  withTenant,
  withTenantFrom,

  /** Cierra la conexión de un tenant puntual (p. ej. tras desactivarlo). */
  async closeTenant(tenantId: string): Promise<void> {
    await prismaClientFactory.closeTenant(tenantId);
  },

  /** Cierre ordenado de todas las conexiones activas (apagado del proceso). */
  async shutdown(): Promise<void> {
    await prismaClientFactory.shutdownAll();
  },

  get activeTenantCount(): number {
    return prismaClientFactory.activeTenantCount;
  },
};
