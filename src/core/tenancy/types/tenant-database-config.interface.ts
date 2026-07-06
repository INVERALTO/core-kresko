export interface TenantDatabaseConfig {
  readonly tenantId: string;
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly databaseName: string;
  /** Driver/engine, útil si el factory soporta múltiples motores (postgres, mysql, etc.) */
  readonly engine: string;
  readonly ssl?: boolean;
  /** Límites opcionales de pool, si el driver los soporta */
  readonly poolSize?: number;
}
