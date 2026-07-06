import { tenantConnectionManager } from './bootstrap/container';

async function runTest() {
  console.log('🚀 Iniciando prueba de Multi-Tenancy Kresko 2...\n');

  try {
    // --- PRUEBA INQUILINO 1: ACME ---
    console.log('🔌 Solicitando conexión para [tenant-acme]...');
    const acmeDb = await tenantConnectionManager.getConnection('tenant-acme');
    
    const acmeResult = await acmeDb.prisma.$queryRawUnsafe('SELECT current_database() AS db_name;');
    console.log('✅ ACME conectado exitosamente a:', acmeResult);
    console.log('--------------------------------------------------');

    // --- PRUEBA INQUILINO 2: GLOBEX ---
    console.log('🔌 Solicitando conexión para [tenant-globex]...');
    const globexDb = await tenantConnectionManager.getConnection('tenant-globex');
    
    const globexResult = await globexDb.prisma.$queryRawUnsafe('SELECT current_database() AS db_name;');
    console.log('✅ GLOBEX conectado exitosamente a:', globexResult);
    console.log('--------------------------------------------------');

    // --- PRUEBA DE CACHÉ ---
    console.log('🔄 Solicitando conexión para ACME nuevamente (debería reusar la existente)...');
    const acmeDbCached = await tenantConnectionManager.getConnection('tenant-acme');
    console.log('¿Es la misma instancia de Prisma en memoria?:', acmeDb === acmeDbCached);

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  } finally {
    console.log('\n🧹 Cerrando todas las conexiones...');
    await tenantConnectionManager.closeAll();
    console.log('👋 Prueba finalizada.');
  }
}

runTest();