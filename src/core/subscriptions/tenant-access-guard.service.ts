import { SubscriptionCacheService } from './subscription-cache.service';
import {
  AccessDenialReason,
  TenantAccessDeniedException,
} from '../errors/tenant-access-denied.exception';
import { SubscriptionStatus } from './types/tenant-subscription.interface';

export class TenantAccessGuard {
  constructor(private readonly subscriptionCache: SubscriptionCacheService) {}

  /**
   * Lanza TenantAccessDeniedException si el tenant no puede usar el módulo.
   * No retorna nada: es un "assert" pensado para usarse como guard clause.
   */
  public assertAccess(tenantId: string, moduleKey: string): void {
    const subscription = this.subscriptionCache.get(tenantId);

    if (!subscription) {
      throw new TenantAccessDeniedException(
        tenantId,
        moduleKey,
        AccessDenialReason.SUBSCRIPTION_NOT_FOUND,
      );
    }

    if (subscription.status === SubscriptionStatus.SUSPENDED) {
      throw new TenantAccessDeniedException(
        tenantId,
        moduleKey,
        AccessDenialReason.SUBSCRIPTION_SUSPENDED,
      );
    }

    if (this.isExpired(subscription.expiresAt)) {
      throw new TenantAccessDeniedException(
        tenantId,
        moduleKey,
        AccessDenialReason.SUBSCRIPTION_EXPIRED,
      );
    }

    if (!subscription.enabledModules.includes(moduleKey)) {
      throw new TenantAccessDeniedException(
        tenantId,
        moduleKey,
        AccessDenialReason.MODULE_NOT_ENABLED,
      );
    }
  }

  /** Versión no-throw, útil para lógica condicional en UI/BFF. */
  public hasAccess(tenantId: string, moduleKey: string): boolean {
    try {
      this.assertAccess(tenantId, moduleKey);
      return true;
    } catch {
      return false;
    }
  }

  private isExpired(expiresAt: string | null): boolean {
    if (expiresAt === null) return false;
    return new Date(expiresAt).getTime() < Date.now();
  }
}
