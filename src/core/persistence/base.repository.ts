import { IDbConnection } from '../tenancy/ports/db-connection.interface';
import { TenantConnectionManager } from '../tenancy/tenant-connection-manager.service';
import { TenantContext } from '../context/tenant-context';

/**
 * Clase base para todos los repositorios de módulo.
 *
 * Encapsula la resolución transparente de la conexión activa del tenant:
 * los repositorios concretos nunca manejan tenantId ni el connection manager
 * directamente, solo llaman a `this.getDb()`.
 */
export abstract class BaseRepository {
  protected constructor(private readonly connectionManager: TenantConnectionManager) {}

  /**
   * Resuelve la conexión de base de datos del tenant actual.
   * 1. Lee el tenantId del contexto (AsyncLocalStorage).
   * 2. Pide la conexión activa (o la crea, lazy) al TenantConnectionManager.
   */
  protected async getDb(): Promise<IDbConnection> {
    const tenantId = TenantContext.getTenantId();
    return this.connectionManager.getConnection(tenantId);
  }
}
