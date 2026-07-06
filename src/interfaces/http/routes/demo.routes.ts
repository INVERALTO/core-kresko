import { Router, Request, Response } from 'express';
import { requireModule } from '../middlewares/require-module.middleware';
import { tenantAccessGuard, userService } from '../../../bootstrap/container';

export const demoRouter = Router();

// Protegido por el módulo "inventario"
demoRouter.get(
  '/inventario/stock',
  requireModule(tenantAccessGuard, 'inventario'),
  (_req: Request, res: Response) => {
    res.json({ message: 'Acceso concedido a inventario', stock: [] });
  },
);

// Protegido por el módulo "ventas"
demoRouter.post(
  '/ventas',
  requireModule(tenantAccessGuard, 'ventas'),
  (_req: Request, res: Response) => {
    res.json({ message: 'Venta registrada (demo)' });
  },
);

// Ejemplo end-to-end: pasa por el guard de "ventas" y luego resuelve
// conexión dinámica del tenant vía TenantConnectionManager (UserRepository).
demoRouter.get(
  '/users/:id',
  requireModule(tenantAccessGuard, 'ventas'),
  async (req: Request, res: Response, next) => {
    try {
      const user = await userService.getUserProfile(req.params.id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },
);
