export enum AccessDenialReason {
  MODULE_NOT_ENABLED = 'MODULE_NOT_ENABLED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  SUBSCRIPTION_SUSPENDED = 'SUBSCRIPTION_SUSPENDED',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
}

export class TenantAccessDeniedException extends Error {
  public readonly httpStatus = 403 as const;

  constructor(
    public readonly tenantId: string,
    public readonly moduleKey: string,
    public readonly reason: AccessDenialReason,
  ) {
    super(
      `Acceso denegado al módulo "${moduleKey}" para el tenant "${tenantId}". Motivo: ${reason}`,
    );
    this.name = 'TenantAccessDeniedException';
    Object.setPrototypeOf(this, TenantAccessDeniedException.prototype);
  }
}
