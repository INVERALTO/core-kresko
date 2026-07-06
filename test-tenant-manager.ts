import { randomUUID } from 'node:crypto';
import { withTenant, TenantManager } from './src/tenancy/tenant-manager';
import { TenantDatabaseNotFoundError } from './src/tenancy/prisma-client-factory';

const TENANT_A = 'tenant_a';
const TENANT_B = 'tenant_b';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FALLIDA: ${message}`);
}

/**
 * Falla rápido y con un mensaje accionable si las bases de los tenants
 * de prueba todavía no existen o no tienen el schema aplicado.
 */
async function ensureTenantDatabasesReady(): Promise<void> {
  for (const tenantId of [TENANT_A, TENANT_B]) {
    try {
      await withTenant(tenantId, (prisma) => prisma.$queryRaw`SELECT 1`);
    } catch (err) {
      if (err instanceof TenantDatabaseNotFoundError) {
        console.error(`\n${err.message}`);
        console.error(
          `Crea la base y aplícale el schema antes de correr este test, por ejemplo:\n` +
            `  psql -U postgres -c "CREATE DATABASE kresko_tenant_${tenantId};"\n` +
            `  set DATABASE_URL=postgresql://postgres:Kresko0112233+@localhost:5432/kresko_tenant_${tenantId}\n` +
            `  npx prisma db push\n`,
        );
      }
      throw err;
    }
  }
}

/**
 * Test 1: lo que se escribe en tenant_a con withTenant() no debe
 * ser visible al leer desde tenant_b con el mismo email.
 */
async function testWriteIsolation(): Promise<void> {
  console.log('\n--- Test 1: escritura en tenant_a no debe filtrarse a tenant_b ---');
  const email = `isolation_${randomUUID()}@kresko.test`;

  await withTenant(TENANT_A, (prisma) =>
    prisma.user.create({ data: { email, name: 'Usuario A' } }),
  );

  const foundInA = await withTenant(TENANT_A, (prisma) =>
    prisma.user.findUnique({ where: { email } }),
  );
  assert(foundInA !== null, 'el usuario debería existir en tenant_a (se acaba de crear ahí)');

  const foundInB = await withTenant(TENANT_B, (prisma) =>
    prisma.user.findUnique({ where: { email } }),
  );
  assert(foundInB === null, 'FUGA DE DATOS: el usuario de tenant_a apareció en tenant_b');

  console.log('✅ tenant_a y tenant_b no comparten datos (dirección A -> B).');
}

/** Test 2: la misma verificación en la dirección opuesta, B -> A. */
async function testReverseIsolation(): Promise<void> {
  console.log('\n--- Test 2: escritura en tenant_b no debe filtrarse a tenant_a ---');
  const email = `isolation_${randomUUID()}@kresko.test`;

  await withTenant(TENANT_B, (prisma) =>
    prisma.user.create({ data: { email, name: 'Usuario B' } }),
  );

  const foundInB = await withTenant(TENANT_B, (prisma) =>
    prisma.user.findUnique({ where: { email } }),
  );
  assert(foundInB !== null, 'el usuario debería existir en tenant_b');

  const foundInA = await withTenant(TENANT_A, (prisma) =>
    prisma.user.findUnique({ where: { email } }),
  );
  assert(foundInA === null, 'FUGA DE DATOS: el usuario de tenant_b apareció en tenant_a');

  console.log('✅ tenant_a y tenant_b no comparten datos (dirección B -> A).');
}

/**
 * Test 3: el caso más peligroso para AsyncLocalStorage — dos
 * operaciones de tenants distintos ejecutándose EN PARALELO
 * (Promise.all), intercalando su avance en el event loop. Si el
 * contexto se mezclara entre ejecuciones concurrentes, esta prueba
 * lo revelaría.
 */
async function testConcurrentContextIsolation(): Promise<void> {
  console.log('\n--- Test 3: operaciones concurrentes no deben cruzar el contexto ---');
  const emailA = `concurrent_a_${randomUUID()}@kresko.test`;
  const emailB = `concurrent_b_${randomUUID()}@kresko.test`;

  const [userA, userB] = await Promise.all([
    withTenant(TENANT_A, async (prisma) => {
      const created = await prisma.user.create({ data: { email: emailA, name: 'Concurrente A' } });
      const active = TenantManager.getCurrentTenantId();
      assert(active === TENANT_A, `contexto cruzado: se esperaba ${TENANT_A}, había ${active}`);
      return created;
    }),
    withTenant(TENANT_B, async (prisma) => {
      const created = await prisma.user.create({ data: { email: emailB, name: 'Concurrente B' } });
      const active = TenantManager.getCurrentTenantId();
      assert(active === TENANT_B, `contexto cruzado: se esperaba ${TENANT_B}, había ${active}`);
      return created;
    }),
  ]);

  assert(userA.email === emailA, 'el resultado de la rama A no corresponde a su propio email');
  assert(userB.email === emailB, 'el resultado de la rama B no corresponde a su propio email');

  const crossA = await withTenant(TENANT_A, (prisma) =>
    prisma.user.findUnique({ where: { email: emailB } }),
  );
  assert(crossA === null, 'FUGA DE DATOS: el usuario creado concurrentemente en tenant_b llegó a tenant_a');

  const crossB = await withTenant(TENANT_B, (prisma) =>
    prisma.user.findUnique({ where: { email: emailA } }),
  );
  assert(crossB === null, 'FUGA DE DATOS: el usuario creado concurrentemente en tenant_a llegó a tenant_b');

  console.log('✅ Sin cruce de contexto bajo concurrencia real.');
}

/**
 * Test 4: la factory NO debe abrir una conexión nueva cada vez que
 * se llama a withTenant() para un tenant ya cacheado. Lo verificamos
 * indirectamente con TenantManager.activeTenantCount: debe mantenerse
 * estable ante llamadas repetidas al mismo tenant.
 */
async function testFactoryCacheReuse(): Promise<void> {
  console.log('\n--- Test 4: la cache de PrismaClientFactory reutiliza conexiones ---');

  const countBefore = TenantManager.activeTenantCount;

  for (let i = 0; i < 5; i++) {
    await withTenant(TENANT_A, (prisma) => prisma.$queryRaw`SELECT 1`);
  }

  const countAfter = TenantManager.activeTenantCount;
  assert(
    countAfter === countBefore,
    `activeTenantCount cambió al repetir el mismo tenant (antes: ${countBefore}, después: ${countAfter}). ` +
      'Esto sugiere que la cache no está reutilizando el cliente existente.',
  );

  console.log(`✅ Cache estable: ${countAfter} tenant(s) activos, sin conexiones redundantes.`);
}

async function main() {
  console.log('=== Test de aislamiento — Kresko 2 TenantManager ===');
  try {
    await ensureTenantDatabasesReady();
    await testWriteIsolation();
    await testReverseIsolation();
    await testConcurrentContextIsolation();
    await testFactoryCacheReuse();

    console.log('\n🎉 TODOS LOS TESTS PASARON. El aislamiento entre tenants es estanco.');
    process.exitCode = 0;
  } catch (err) {
    console.error('\n💥 TEST FALLIDO:', err);
    process.exitCode = 1;
  } finally {
    await TenantManager.shutdown();
  }
}

main();
