import { TenantSubscription } from './types/tenant-subscription.interface';

/**
 * Puerto que abstrae el origen real de los datos (DB, config service, etc).
 * El Core no depende de la implementación concreta.
 */
export interface ISubscriptionLoader {
  loadAll(): Promise<TenantSubscription[]>;
  loadOne(tenantId: string): Promise<TenantSubscription | null>;
}

export class SubscriptionCacheService {
  // Map<tenantId, TenantSubscription> -> lookup O(1)
  private readonly cache = new Map<string, TenantSubscription>();

  constructor(private readonly loader: ISubscriptionLoader) {}

  /** Hidrata la caché completa (arranque de la app / job periódico). */
  public async warmUp(): Promise<void> {
    const subscriptions = await this.loader.loadAll();
    subscriptions.forEach((sub) => this.cache.set(sub.tenantId, sub));
  }

  /** Lectura O(1). No golpea la DB. */
  public get(tenantId: string): TenantSubscription | undefined {
    return this.cache.get(tenantId);
  }

  /** Invalidación puntual (ej. tras un webhook de billing). */
  public async refresh(tenantId: string): Promise<void> {
    const sub = await this.loader.loadOne(tenantId);
    if (sub) {
      this.cache.set(tenantId, sub);
    } else {
      this.cache.delete(tenantId);
    }
  }

  public invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }
}
