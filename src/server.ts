// src/server.ts

import 'dotenv/config';
import { createServer } from 'node:http';
import { route, dispatch } from './god-panel/http/router.js';

import { login } from './god-panel/http/routes/login.js';
import { serveLoginPage } from './god-panel/http/routes/index-page.js';
import {
  listTenants,
  createTenant,
  updateTenantStatus,
  deleteTenant,
} from './god-panel/http/routes/tenants.js';
import { impersonateTenant, stopImpersonating } from './god-panel/http/routes/impersonate.js';
import { browseTenantData } from './god-panel/http/routes/browse.js';
import { systemReset } from './god-panel/http/routes/system-reset.js';

// --- AQUÍ ESTÁN TODAS TUS RUTAS REGISTRADAS ---
route('GET', '/', serveLoginPage);
route('POST', '/admin/login', login);
route('GET', '/admin/tenants', listTenants);
route('POST', '/admin/tenants', createTenant);
route('PATCH', '/admin/tenants/:id/status', updateTenantStatus);
route('DELETE', '/admin/tenants/:id', deleteTenant);
route('POST', '/admin/impersonate/:tenantId', impersonateTenant);
route('POST', '/admin/stop-impersonating', stopImpersonating);
route('GET', '/admin/data/:model', browseTenantData);
route('POST', '/admin/system-reset', systemReset);
// ----------------------------------------------

const PORT = Number(process.env.GOD_PANEL_PORT ?? 3001);

createServer(dispatch).listen(PORT, () => {
  console.log(`[god-panel] API escuchando en :${PORT}`);
});
