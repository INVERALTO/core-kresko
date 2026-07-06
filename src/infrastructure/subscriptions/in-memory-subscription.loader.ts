import { ISubscriptionLoader } from '../../core/subscriptions/subscription-cache.service';
import {
  SubscriptionStatus,
  TenantSubscription,
} from '../../core/subscriptions/types/tenant-subscription.interface';

/**
 * Implementación MOCK de ISubscriptionLoader para ensayar en local
 * sin base de datos real. Reemplazar por una implementación que consulte
 * la DB central de administración de Kresko.
 */
export class InMemorySubscriptionLoader implements ISubscriptionLoader {
  private readonly data: TenantSubscription[] = [
    {
      tenantId: 'tenant-acme',
      status: SubscriptionStatus.ACTIVE,
      enabledModules: ['ventas', 'inventario'],
      expiresAt: null,
    },
    {
      tenantId: 'tenant-globex',
      status: SubscriptionStatus.TRIAL,
      enabledModules: ['ventas'],
      expiresAt: '2026-12-31T23:59:59.000Z',
    },
    {
      tenantId: 'tenant-vencido',
      status: SubscriptionStatus.ACTIVE,
      enabledModules: ['ventas', 'inventario'],
      expiresAt: '2020-01-01T00:00:00.000Z', // ya expiró, a propósito
    },
  ];

  public async loadAll(): Promise<TenantSubscription[]> {
    return this.data;
  }

  public async loadOne(tenantId: string): Promise<TenantSubscription | null> {
    return this.data.find((sub) => sub.tenantId === tenantId) ?? null;
  }
}
