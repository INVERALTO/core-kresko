import { Request, Response, NextFunction, RequestHandler } from 'express';
import { TenantContext } from '../../../core/context/tenant-context';

/**
 * Middleware de entrada: resuelve el tenantId de la request y lo publica
 * en el AsyncLocalStorage para el resto del pipeline (guards, repositorios, etc).
 *
 * Ajusta la estrategia de resolución a la de Kresko (subdominio, header,
 * JWT, etc). Aquí se ejemplifica con un header 'x-tenant-id' por simplicidad.
 */
export function resolveTenant(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = req.header('x-tenant-id');

    if (!tenantId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Falta el header x-tenant-id.' });
      return;
    }

    TenantContext.run({ tenantId }, () => next());
  };
}
