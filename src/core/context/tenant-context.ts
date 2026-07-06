import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantRequestContext {
  tenantId: string;
}

const tenantContextStorage = new AsyncLocalStorage<TenantRequestContext>();

/**
 * Punto único de acceso al contexto de tenant durante el ciclo de vida
 * de un request. Debe poblarse en un middleware temprano de la app
 * (ej. resolviendo el tenant desde subdominio, header o JWT) usando
 * `tenantContextStorage.run({ tenantId }, next)`.
 */
export const TenantContext = {
  run<T>(context: TenantRequestContext, callback: () => T): T {
    return tenantContextStorage.run(context, callback);
  },

  getTenantId(): string {
    const store = tenantContextStorage.getStore();
    if (!store) {
      throw new Error('No hay contexto de tenant activo (AsyncLocalStorage vacío).');
    }
    return store.tenantId;
  },

  getStore(): TenantRequestContext | undefined {
    return tenantContextStorage.getStore();
  },
};
