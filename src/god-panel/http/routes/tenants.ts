import type { ServerResponse } from 'node:http';
import { TenantStatus } from '@prisma/client';
import type { AdminRequest } from '../middleware.js';
import { requireSuperAdmin, getAdminSession } from '../middleware.js';
import { serveDashboardPage } from './dashboard-page.js';
import { adminPrisma } from '../../../core/admin-prisma.js';
import { assertValidTenantId, normalizeTenantId, TenantValidationError } from '../../../tenancy/tenant-id.js';
import { TenantManager } from '../../../tenancy/tenant-manager.js';
import { provisionTenantDatabase, dropTenantDatabase, TenantProvisioningError } from '../../../tenancy/provisioning/tenant-db-provisioner.js';

const TENANT_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  createdAt: true,
} as const;

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

/** true si err es el error de Prisma para violación de constraint único (P2002). */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

/** true si err es el error de Prisma para "registro no encontrado" (P2025), usado por update/delete. */
function isNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}

/**
 * GET /admin/tenants
 * Content negotiation sobre la MISMA ruta:
 *   - El login (index-page.ts) redirige aquí con una navegación normal
 *     de navegador (Accept: text/html,...) -> servimos el dashboard HTML.
 *   - El propio dashboard llama a esta URL vía fetch() pidiendo
 *     explícitamente Accept: application/json -> servimos el JSON de siempre.
 * Así no hace falta otra ruta ni tocar a dónde redirige el login.
 */
export async function listTenants(req: AdminRequest, res: ServerResponse): Promise<void> {
  const wantsJson = (req.headers.accept ?? '').includes('application/json');

  if (!wantsJson) {
    // Navegación de navegador: si no hay sesión, al login; si la hay, el dashboard.
    const session = getAdminSession(req);
    if (!session) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }
    serveDashboardPage(res);
    return;
  }

  const session = requireSuperAdmin(req, res);
  if (!session) return;

  try {
    const tenants = await adminPrisma.tenant.findMany({
      select: TENANT_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    sendJson(res, 200, { tenants, impersonating: session.impersonating ?? null });
  } catch (err) {
    console.error('[god-panel] Error listando tenants:', err);
    sendJson(res, 500, { error: 'Error listando tenants' });
  }
}

/**
 * POST /admin/tenants
 * Alta de punta a punta de un tenant:
 *   1) Inserta el registro en el catálogo (adminPrisma, kresko_admin).
 *   2) Aprovisiona la base física kresko_tenant_{id} (CREATE DATABASE +
 *      `prisma db push`), vía provisionTenantDatabase().
 *
 * Si el paso 2 falla, se revierte el paso 1 (se borra la fila recién
 * creada) para no dejar un tenant "fantasma" en el catálogo sin base
 * física real. El tenant solo queda con status ACTIVE si AMBOS pasos
 * terminaron bien.
 */
export async function createTenant(
  req: AdminRequest,
  res: ServerResponse,
  _params: Record<string, string>,
  body: unknown
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const data = (body ?? {}) as { id?: string; slug?: string; name?: string };
  const { slug, name } = data;

  if (!slug || !name) {
    sendJson(res, 400, { error: 'slug y name son requeridos' });
    return;
  }

  // El id técnico se deriva del slug si no viene explícito, y se normaliza
  // al mismo patrón que exige la base física (ver tenant-id.ts).
  const rawId = data.id ?? slug;
  const id = normalizeTenantId(rawId);

  try {
    assertValidTenantId(id);
  } catch (err) {
    if (err instanceof TenantValidationError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    throw err;
  }

  let tenant;
  try {
    console.log(`[god-panel] Creando tenant en catálogo: ${id}`);
    tenant = await adminPrisma.tenant.create({
      data: { id, slug, name, status: TenantStatus.ACTIVE },
      select: TENANT_SELECT,
    });
    console.log(`[god-panel] ✓ Tenant insertado en catálogo: ${id}`);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      sendJson(res, 409, { error: `Ya existe un tenant con ese id o slug (${id} / ${slug})` });
      return;
    }
    console.error('[god-panel] Error creando tenant en catálogo:', err);
    sendJson(res, 500, { error: 'Error creando tenant en catálogo' });
    return;
  }

  try {
    console.log(`[god-panel] Aprovisionando base física para: ${id}`);
    await provisionTenantDatabase(id);
    console.log(`[god-panel] ✓ Base física aprovisionada para: ${id}`);
  } catch (err) {
    console.error(`[god-panel] Error aprovisionando base física. Revertiendo catálogo para ${id}...`, err);

    // Rollback: sin base física no dejamos el registro en el catálogo.
    try {
      await adminPrisma.tenant.delete({ where: { id } });
      console.log(`[god-panel] ✓ Rollback: tenant borrado del catálogo`);
    } catch (rollbackErr) {
      console.error(`[god-panel] ✗ Rollback FALLÓ: no se pudo borrar tenant ${id} del catálogo:`, rollbackErr);
      console.error('[god-panel] ⚠️ TENANT HUÉRFANO EN CATÁLOGO! Borrar manualmente o usar DELETE /admin/tenants/:id?hard=true');
    }

    const message =
      err instanceof TenantProvisioningError
        ? err.message
        : 'Error desconocido aprovisionando la base física del tenant';
    sendJson(res, 500, { error: `No se pudo aprovisionar el tenant: ${message}` });
    return;
  }

  sendJson(res, 201, { tenant });
}

/**
 * PATCH /admin/tenants/:id/status
 * Cambia el status del tenant (ACTIVE | SUSPENDED | ARCHIVED).
 * Si el nuevo status no es ACTIVE, cierra también el pool de conexión
 * cacheado del tenant (TenantManager.closeTenant) para que ninguna
 * request en curso siga usando una conexión "viva" de un tenant suspendido.
 */
export async function updateTenantStatus(
  req: AdminRequest,
  res: ServerResponse,
  params: Record<string, string>,
  body: unknown
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const id = params.id;
  const data = (body ?? {}) as { status?: string };
  const status = data.status;

  const validStatuses = Object.values(TenantStatus);
  if (!status || !validStatuses.includes(status as TenantStatus)) {
    sendJson(res, 400, { error: `status debe ser uno de: ${validStatuses.join(', ')}` });
    return;
  }

  try {
    console.log(`[god-panel] Actualizando status de tenant ${id} a: ${status}`);
    const tenant = await adminPrisma.tenant.update({
      where: { id },
      data: { status: status as TenantStatus },
      select: TENANT_SELECT,
    });

    if (status !== TenantStatus.ACTIVE) {
      await TenantManager.closeTenant(id);
    }

    console.log(`[god-panel] ✓ Status actualizado para ${id}`);
    sendJson(res, 200, { tenant });
  } catch (err) {
    if (isNotFoundError(err)) {
      sendJson(res, 404, { error: 'Tenant no encontrado' });
      return;
    }
    console.error('[god-panel] Error actualizando status:', err);
    sendJson(res, 500, { error: 'Error actualizando status del tenant' });
  }
}

/**
 * DELETE /admin/tenants/:id
 * Por default hace soft-delete (status = ARCHIVED), igual que
 * updateTenantStatus, y cierra la conexión cacheada del tenant.
 *
 * Con ?hard=true borra la fila del catálogo en adminPrisma.
 * OJO: esto NO borra la base física `kresko_tenant_{id}` (no existe ese
 * paso en este código todavía) — la deja huérfana para limpieza manual.
 * No implico un DROP DATABASE aquí porque no hay ningún mecanismo de
 * aprovisionamiento/desaprovisionamiento físico en el proyecto que
 * indique cómo debe hacerse eso de forma segura.
 *
 * Con ?hard=true&dropDb=true SÍÍÍ borra la base física junto con la fila.
 * Úsalo para limpiar tenants huérfanos.
 */
export async function deleteTenant(
  req: AdminRequest,
  res: ServerResponse,
  params: Record<string, string>,
  _body: unknown
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const id = params.id;
  // El router (router.ts) no separa el query string en un par��metro propio,
  // así que lo leemos aquí igual que hace `dispatch()` para el pathname.
  const url = new URL(req.url ?? '', 'http://localhost');
  const hard = url.searchParams.get('hard') === 'true';
  const dropDb = url.searchParams.get('dropDb') === 'true';

  console.log(`[god-panel] Eliminando tenant ${id} (hard=${hard}, dropDb=${dropDb})`);

  await TenantManager.closeTenant(id);

  try {
    if (hard) {
      // Si es hard delete Y pide dropDb, primero elimina la base física
      if (dropDb) {
        try {
          console.log(`[god-panel] Eliminando base física de ${id}...`);
          await dropTenantDatabase(id);
          console.log(`[god-panel] ✓ Base física eliminada para ${id}`);
        } catch (dropErr) {
          console.error(`[god-panel] Error eliminando base física:`, dropErr);
          sendJson(res, 500, { 
            error: `No se pudo eliminar la base física del tenant: ${
              dropErr instanceof TenantProvisioningError ? dropErr.message : 'Error desconocido'
            }` 
          });
          return;
        }
      }

      // Ahora sí, borra del catálogo
      console.log(`[god-panel] Borrando tenant del catálogo (hard delete): ${id}`);
      await adminPrisma.tenant.delete({ where: { id } });
      console.log(`[god-panel] ��� Tenant eliminado completamente`);
      sendJson(res, 200, { ok: true, hard: true, dbDropped: dropDb });
      return;
    }

    // Soft delete: cambiar status a ARCHIVED
    const tenant = await adminPrisma.tenant.update({
      where: { id },
      data: { status: TenantStatus.ARCHIVED },
      select: TENANT_SELECT,
    });
    console.log(`[god-panel] ✓ Tenant archivado (soft delete): ${id}`);
    sendJson(res, 200, { ok: true, hard: false, tenant });
  } catch (err) {
    if (isNotFoundError(err)) {
      sendJson(res, 404, { error: 'Tenant no encontrado' });
      return;
    }
    console.error('[god-panel] Error borrando tenant:', err);
    sendJson(res, 500, { error: 'Error borrando tenant' });
  }
}
