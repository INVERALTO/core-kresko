import express from 'express';
import { resolveTenant } from './interfaces/http/middlewares/resolve-tenant.middleware';
import { globalErrorHandler } from './interfaces/http/middlewares/error-handler.middleware';
import { bootstrapSubscriptions } from './bootstrap/container';
// Aquí importaremos las rutas reales más adelante, por ejemplo:
// import { usersRouter } from './modules/users/users.routes';

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // 1. Resuelve el tenant y lo publica en AsyncLocalStorage para toda la request
  app.use(resolveTenant());

  // 2. Rutas Reales (cada una decide qué módulo requiere vía requireModule)
  // app.use('/users', usersRouter); 

  // 3. Manejador global de errores (siempre al final)
  app.use(globalErrorHandler);

  // 4. Hidrata la caché de suscripciones antes de aceptar tráfico
  await bootstrapSubscriptions();

  const port = process.env.PORT ?? 3000;
  app.listen(port, () => {
    console.log(`[INFO] Kresko Core escuchando en http://localhost:${port}`);
    console.log('[INFO] Esperando tráfico de inquilinos...');
  });
}

main().catch((err) => {
  console.error('Error fatal al iniciar Kresko Core:', err);
  process.exit(1);
});