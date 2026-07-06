import { ITenantConnectionFactory } from '../../core/tenancy/ports/tenant-connection-factory.interface';
import { IDbConnection } from '../../core/tenancy/ports/db-connection.interface';
import { TenantDatabaseConfig } from '../../core/tenancy/types/tenant-database-config.interface';

/**
 * Implementación MOCK de ITenantConnectionFactory. Simula un pool/conexión
 * real sin necesidad de un motor de base de datos instalado, para poder
 * ensayar el flujo completo (guard -> connection manager -> repository)
 * en local. Reemplazar por una factory real (pg.Pool, PrismaClient, etc).
 */
export class FakeTenantConnectionFactory implements ITenantConnectionFactory {
  public async create(config: TenantDatabaseConfig): Promise<IDbConnection> {
    console.log(
      `[FakeTenantConnectionFactory] Abriendo conexión simulada -> tenant=${config.tenantId} db=${config.databaseName}`,
    );

    // Simula almacenamiento en memoria por tenant, solo para poder
    // ver resultados coherentes en los ensayos locales.
    const fakeUsersTable = new Map<string, { id: string; name: string; email: string }>([
      ['1', { id: '1', name: 'Ada Lovelace', email: 'ada@example.com' }],
      ['2', { id: '2', name: 'Alan Turing', email: 'alan@example.com' }],
    ]);

    const connection: IDbConnection = {
      async query<T>(sql: string, params: unknown[] = []): Promise<T> {
        console.log(`[FakeDbConnection:${config.tenantId}] query -> ${sql}`, params);

        if (sql.toLowerCase().startsWith('select') && params[0]) {
          const found = fakeUsersTable.get(String(params[0]));
          return (found ? [found] : []) as unknown as T;
        }

        if (sql.toLowerCase().startsWith('insert')) {
          const id = String(fakeUsersTable.size + 1);
          const [name, email] = params as [string, string];
          const created = { id, name, email };
          fakeUsersTable.set(id, created);
          return [created] as unknown as T;
        }

        return [] as unknown as T;
      },

      async close(): Promise<void> {
        console.log(`[FakeTenantConnectionFactory] Cerrando conexión -> tenant=${config.tenantId}`);
      },
    };

    return connection;
  }
}
