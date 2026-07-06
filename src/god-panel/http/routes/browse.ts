import type { ServerResponse } from 'node:http';
import type { AdminRequest } from '../middleware.js';
import { requireSuperAdmin } from '../middleware.js';

// Importamos el objeto TenantManager correctamente
import { TenantManager } from '../../../tenancy/tenant-manager.js';

/**
 * Whitelist explícita de modelos navegables desde el panel.
 */
const BROWSABLE_MODELS = new Set(['user', 'order', 'invoice']);

/**
 * GET /admin/data/:model
 * Corre la consulta DENTRO del contexto del tenant impersonado.
 */
// La firma DEBE coincidir con el tipo `Handler` de router.ts: (req, res, params, body)
export async function browseTenantData(
  req: AdminRequest,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const session = requireSuperAdmin(req, res);
  if (!session) return;

  const model = params.model;

  if (!session.impersonating) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No hay tenant impersonado activo. Llamá primero a /admin/impersonate/:tenantId' }));
    return;
  }

  if (!BROWSABLE_MODELS.has(model)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Modelo no permitido para el panel: ${model}` }));
    return;
  }

  // Corregido: Usamos TenantManager.withTenant (con T mayúscula)
  const rows = await TenantManager.withTenant(session.impersonating, async (tx: any) => {
    return tx[model].findMany({ take: 100 });
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ tenantId: session.impersonating, model, rows }));
}