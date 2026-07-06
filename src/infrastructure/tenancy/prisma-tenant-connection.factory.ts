import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

export class PrismaTenantConnectionFactory {
  
  async create(config: any) { 
    const databaseUrl = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.databaseName}?schema=public`;

    // 1. Creamos un pool de conexiones con el driver nativo de Postgres
    const pool = new Pool({ connectionString: databaseUrl });
    
    // 2. Envolvemos el pool en el adaptador oficial de Prisma
    const adapter = new PrismaPg(pool);

    // 3. Pasamos el adaptador al cliente (¡esta es la propiedad correcta ahora!)
    const prismaClient = new PrismaClient({ adapter });

    await prismaClient.$connect();

    return {
      prisma: prismaClient,
      close: async () => {
        // Es importante cerrar tanto Prisma como el Pool nativo
        await prismaClient.$disconnect();
        await pool.end();
      }
    };
  }
}