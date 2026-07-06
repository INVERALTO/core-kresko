import { Pool } from 'pg';

const TENANTS = ['tenant_a', 'tenant_b'];
const DB_USER = 'postgres';
const DB_PASSWORD = 'Kresko0112233+';
const DB_HOST = 'localhost';
const DB_PORT = 5432;

async function listTables(tenantId: string): Promise<void> {
  const dbName = `kresko_tenant_${tenantId}`;
  const pool = new Pool({
    connectionString: `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${dbName}?schema=public`,
  });

  console.log(`\n--- ${dbName} ---`);
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`,
    );
    if (result.rows.length === 0) {
      console.log('⚠️  No hay tablas en el schema public. El db push no se aplicó aquí.');
    } else {
      for (const row of result.rows) {
        console.log(`  - ${row.table_name}`);
      }
    }
  } catch (err) {
    console.error('❌ Error al conectar/consultar:', err);
  } finally {
    await pool.end();
  }
}

async function main() {
  for (const tenantId of TENANTS) {
    await listTables(tenantId);
  }
}

main();
