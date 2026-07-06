import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Estado que viaja "invisible" a través de toda la cadena async
 * de una petición (middlewares -> servicios -> repositorios),
 * sin necesidad de pasar `tenantId` como parámetro en cada función.
 */
export interface TenantContextStore {
  tenantId: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContextStore>();

/**
 * Ejecuta `fn` dentro de un contexto donde `tenantId` es el inquilino activo.
 * Todo lo que se llame (de forma síncrona o asíncrona) dentro de `fn`
 * puede recuperar ese `tenantId` con `getCurrentTenantId()`.
 *
 * Integración con el aislamiento: este es el ÚNICO punto de entrada
 * que "activa" un tenant. Si nadie llama a runWithTenant, no hay
 * tenant activo y cualquier intento de obtener un PrismaClient
 * de tenant falla explícitamente (fail-closed, nunca fail-open).
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}

/**
 * Devuelve el tenantId activo o lanza si no hay ninguno.
 * Se usa en la capa de acceso a datos, justo antes de pedir
 * el PrismaClient correspondiente.
 */
export function getCurrentTenantId(): string {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new Error(
      '[TenantContext] No hay un tenant activo en el contexto async actual. ' +
        '¿Olvidaste envolver esta ejecución con TenantManager.runWithTenant()?',
    );
  }
  return store.tenantId;
}

/**
 * Variante no estricta, útil para rutas del Core que pueden
 * ejecutarse sin ningún tenant activo (p. ej. login, provisioning).
 */
export function tryGetCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}
