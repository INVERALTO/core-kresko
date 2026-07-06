import { TenantDatabaseConfig } from '../types/tenant-database-config.interface';
import { IDbConnection } from './db-connection.interface';

export interface ITenantConnectionFactory {
  create(config: TenantDatabaseConfig): Promise<IDbConnection>;
}
