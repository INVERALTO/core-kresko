import type { ServerResponse } from 'node:http';
import type { AdminRequest } from '../middleware.js';
import { requireSuperAdmin } from '../middleware.js';
import { adminPrisma } from '../../../core/admin-prisma.js';
import { TenantManager } from '../../../tenancy/tenant-manager.js';
import { dropTenantDatabase } from '../../../tenancy/provisioning/tenant-db-provisioner.js';

/**
 * POST /admin/system-reset
 * Reset completo del sistema:
 *   1) Verifica contraseña de confirmación (SYSTEM_RESET_PASSWORD)
 *   2) Cierra todas las conexiones de tenants activos
 *   3) Elimina todas las bases físicas (kresko_tenant_*)
 *   4) Borra todos los registros del catálogo (excepto kresko_admin)
 *
 * ⚠️ OPERACIÓN DESTRUCTIVA: No se puede deshacer
 */
export async function systemReset(
  req: AdminRequest,
  res: ServerResponse,
  _params: Record<string, string>,
  body: unknown
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const data = (body ?? {}) as { confirmPassword?: string };
  const providedPassword = data.confirmPassword;

  const resetPassword = process.env.SYSTEM_RESET_PASSWORD;
  if (!resetPassword) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'SYSTEM_RESET_PASSWORD no está configurado' }));
    return;
  }

  if (!providedPassword || providedPassword !== resetPassword) {
    console.warn('[god-panel] Intento de reset del sistema con contraseña incorrecta');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Contraseña de reset incorrecta' }));
    return;
  }

  try {
    console.log('[god-panel] 🔴 INICIANDO RESET COMPLETO DEL SISTEMA...');

    // 1. Obtener todos los tenants
    const allTenants = await adminPrisma.tenant.findMany({ select: { id: true } });
    console.log(`[god-panel] Encontrados ${allTenants.length} tenants para eliminar`);

    // 2. Cerrar conexiones de todos los tenants
    console.log('[god-panel] Cerrando conexiones activas...');
    for (const tenant of allTenants) {
      await TenantManager.closeTenant(tenant.id);
    }
    console.log('[god-panel] ✓ Conexiones cerradas');

    // 3. Eliminar bases físicas
    console.log('[god-panel] Eliminando bases físicas...');
    const droppedBases: string[] = [];
    for (const tenant of allTenants) {
      try {
        await dropTenantDatabase(tenant.id);
        droppedBases.push(tenant.id);
      } catch (err) {
        // Si la base no existe, no es error crítico
        console.log(`[god-panel] Base ${tenant.id} no existe o ya fue eliminada`);
      }
    }
    console.log(`[god-panel] ✓ ${droppedBases.length} bases eliminadas`);

    // 4. Borrar del catálogo
    console.log('[god-panel] Borrando registros del catálogo...');
    const deletedCount = await adminPrisma.tenant.deleteMany({});
    console.log(`[god-panel] ✓ ${deletedCount.count} tenants borrados del catálogo`);

    console.log('[god-panel] 🟢 RESET COMPLETADO EXITOSAMENTE');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        message: 'Sistema restablecido exitosamente',
        tenantsDeleted: allTenants.length,
        basesDropped: droppedBases.length,
      })
    );
  } catch (err) {
    console.error('[god-panel] ✗ Error durante el reset del sistema:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Error durante el reset del sistema',
        details: err instanceof Error ? err.message : String(err),
      })
    );
  }
}
