export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
}

export interface TenantSubscription {
  readonly tenantId: string;
  readonly status: SubscriptionStatus;
  readonly enabledModules: readonly string[];
  /** ISO date. Si es null, la suscripción no expira (ej. plan enterprise). */
  readonly expiresAt: string | null;
}
