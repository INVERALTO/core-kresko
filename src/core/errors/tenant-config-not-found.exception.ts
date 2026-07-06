export class TenantConfigNotFoundException extends Error {
  constructor(public readonly tenantId: string) {
    super(`No se encontró configuración de base de datos para el tenant "${tenantId}".`);
    this.name = 'TenantConfigNotFoundException';
    Object.setPrototypeOf(this, TenantConfigNotFoundException.prototype);
  }
}
