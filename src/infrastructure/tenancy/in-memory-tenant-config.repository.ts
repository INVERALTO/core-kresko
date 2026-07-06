import { ITenantConfigRepository } from '../../core/tenancy/ports/tenant-config-repository.interface';
import { TenantDatabaseConfig } from '../../core/tenancy/types/tenant-database-config.interface';

/**
 * Implementación MOCK de ITenantConfigRepository para ensayar en local.
 * Reemplazar por una implementación real contra la DB central de administración.
 */
export class InMemoryTenantConfigRepository implements ITenantConfigRepository {
  private readonly configs: Record<string, TenantDatabaseConfig> = {
    'tenant-acme': {
      tenantId: 'tenant-acme',
      host: 'localhost',
      port: 5432,
      user: 'acme_user',
      password: 'acme_pass',
      databaseName: 'kresko_acme',
      engine: 'postgres',
    },
    'tenant-globex': {
      tenantId: 'tenant-globex',
      host: 'localhost',
      port: 5432,
      user: 'globex_user',
      password: 'globex_pass',
      databaseName: 'kresko_globex',
      engine: 'postgres',
    },
  };

  public async getConfig(tenantId: string): Promise<TenantDatabaseConfig | null> {
    return this.configs[tenantId] ?? null;
  }
}
