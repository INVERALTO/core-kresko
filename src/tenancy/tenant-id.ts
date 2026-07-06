/**
 * El tenantId llega desde fuera del sistema (JWT, header x-tenant-id)
 * y se interpola directamente en el nombre de la base de datos
 * (`kresko_tenant_{tenantId}`) y en la connection string.
 *
 * Por eso NO es solo una validación de forma: es el control de
 * seguridad que impide que un tenantId malicioso (con `/`, `?`, `;`,
 * espacios, etc.) rompa el parseo de la URL de conexión o intente
 * apuntar a otra base de datos que no le corresponde.
 *
 * Regla: minúsculas, números y guion bajo. Máximo 63 caracteres
 * (límite de identificadores de Postgres).
 */
const TENANT_ID_PATTERN = /^[a-z0-9_]{1,63}$/;

export class TenantValidationError extends Error {
  constructor(public readonly tenantId: string) {
    super(
      `[TenantManager] tenantId inválido: "${tenantId}". ` +
        'Solo se permiten minúsculas, números y guion bajo (máx. 63 caracteres).',
    );
    this.name = 'TenantValidationError';
  }
}

export function assertValidTenantId(tenantId: string): void {
  if (typeof tenantId !== 'string' || !TENANT_ID_PATTERN.test(tenantId)) {
    throw new TenantValidationError(tenantId);
  }
}

/**
 * Normaliza un tenantId "crudo" (p. ej. un UUID con guiones y mayúsculas
 * proveniente de un claim JWT) a la forma que exige TENANT_ID_PATTERN,
 * SIN inventar una segunda regla de validación en paralelo.
 *
 * "a1b2c3d4-E5F6-..." -> "a1b2c3d4_e5f6_..."
 *
 * Esto es solo normalización de formato; la validación real sigue
 * ocurriendo en assertValidTenantId(), que es la única fuente de verdad.
 */
export function normalizeTenantId(rawTenantId: string): string {
  return rawTenantId.trim().toLowerCase().replace(/-/g, '_');
}
