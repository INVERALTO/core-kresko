import { ITenantConfigRepository } from './ports/tenant-config-repository.interface';
import { ITenantConnectionFactory } from './ports/tenant-connection-factory.interface';
import { IDbConnection } from './ports/db-connection.interface';
import { TenantConfigNotFoundException } from '../errors/tenant-config-not-found.exception';

export class TenantConnectionManager {
  /** Conexiones ya resueltas y listas para usar. */
  private readonly connections = new Map<string, IDbConnection>();

  /**
   * Locks de creación en curso. Evita que N requests concurrentes al mismo
   * tenant (cuando aún no hay conexión) disparen N conexiones/pools duplicados.
   */
  private readonly pendingConnections = new Map<string, Promise<IDbConnection>>();

  constructor(
    private readonly configRepository: ITenantConfigRepository,
    private readonly connectionFactory: ITenantConnectionFactory,
  ) {}

  public async getConnection(tenantId: string): Promise<IDbConnection> {
    // 1. Ya existe en el registry -> retorno inmediato.
    const existing = this.connections.get(tenantId);
    if (existing) {
      return existing;
    }

    // 2. Ya hay una creación en curso para este tenant -> reutilizo esa promesa
    //    en lugar de abrir una segunda conexión en paralelo.
    const pending = this.pendingConnections.get(tenantId);
    if (pending) {
      return pending;
    }

    // 3. Lazy loading: resuelvo config, creo la conexión y la registro.
    const creationPromise = this.createAndRegisterConnection(tenantId);
    this.pendingConnections.set(tenantId, creationPromise);

    try {
      return await creationPromise;
    } finally {
      this.pendingConnections.delete(tenantId);
    }
  }

  public async closeConnection(tenantId: string): Promise<void> {
    const connection = this.connections.get(tenantId);
    if (!connection) {
      return;
    }

    await connection.close();
    this.connections.delete(tenantId);
  }

  /** Útil para shutdown ordenado de la app (SIGTERM, tests, etc.). */
  public async closeAll(): Promise<void> {
    const tenantIds = Array.from(this.connections.keys());
    await Promise.all(tenantIds.map((tenantId) => this.closeConnection(tenantId)));
  }

  private async createAndRegisterConnection(tenantId: string): Promise<IDbConnection> {
    const config = await this.configRepository.getConfig(tenantId);

    if (!config) {
      throw new TenantConfigNotFoundException(tenantId);
    }

    const connection = await this.connectionFactory.create(config);
    this.connections.set(tenantId, connection);

    return connection;
  }
}
