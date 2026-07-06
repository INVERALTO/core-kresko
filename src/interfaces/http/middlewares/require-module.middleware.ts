import { Request, Response, NextFunction, RequestHandler } from 'express';
import { TenantContext } from '../../../core/context/tenant-context';
import { TenantAccessGuard } from '../../../core/subscriptions/tenant-access-guard.service';
import { TenantAccessDeniedException } from '../../../core/errors/tenant-access-denied.exception';

/**
 * Factory de middleware Express con Inyección de Dependencias.
 *
 * Uso en el router:
 * const accessGuard = new TenantAccessGuard(subscriptionCache);
 * router.get('/inventario/stock', requireModule(accessGuard, 'inventario'), controller.handler)
 */
export function requireModule(
  accessGuard: TenantAccessGuard,
  moduleKey: string,
): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    try {
      // 1. Extraemos el inquilino del contexto actual
      const tenantId = TenantContext.getTenantId();

      // 2. Usamos la INSTANCIA inyectada para validar
      accessGuard.assertAccess(tenantId, moduleKey);

      next();
    } catch (error) {
      if (error instanceof TenantAccessDeniedException) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `No tienes acceso al módulo "${moduleKey}".`,
          reason: error.reason,
        });
        return;
      }
      // Cualquier otro error pasa al manejador global
      next(error);
    }
  };
}
