import type { ServerResponse } from 'node:http';
import type { AdminRequest } from '../middleware.js';
import { requireSuperAdmin, setSessionCookie } from '../middleware.js';
import { adminPrisma } from '../../../core/admin-prisma.js';

/**
 * POST /admin/impersonate/:tenantId
 * No abre ninguna conexión aquí: solo valida que el tenant existe en el
 * control-plane y marca la sesión como "impersonando X". La conexión real
 * al tenant se resuelve más tarde, por request, vía TenantManager.withTenant.
 */
// La firma DEBE coincidir con el tipo `Handler` de router.ts: (req, res, params, body)
export async function impersonateTenant(
  req: AdminRequest,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const tenantId = params.tenantId;

  const tenant = await adminPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Tenant no encontrado' }));
    return;
  }

  // TODO(auditoría): registrar quién impersonó, a qué tenant y cuándo.
  console.info(`[god-panel] ${session.sub} entra al contexto del tenant ${tenantId}`);

  setSessionCookie(res, {
    ...session,
    impersonating: tenantId,
    exp: Date.now() + 1000 * 60 * 30, // sesión de impersonación más corta: 30 min
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, tenant: { id: tenant.id, name: tenant.name } }));
}

/**
 * POST /admin/stop-impersonating
 * Vuelve al super-admin a su propio contexto, sin tenant activo.
 */
export async function stopImpersonating(req: AdminRequest, res: ServerResponse): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const { impersonating, ...rest } = session;
  void impersonating;

  setSessionCookie(res, { ...rest, exp: Date.now() + 1000 * 60 * 60 * 8 });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}