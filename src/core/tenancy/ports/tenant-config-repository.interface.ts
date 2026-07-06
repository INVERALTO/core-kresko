import { TenantDatabaseConfig } from '../types/tenant-database-config.interface';

export interface ITenantConfigRepository {
  getConfig(tenantId: string): Promise<TenantDatabaseConfig | null>;
}
