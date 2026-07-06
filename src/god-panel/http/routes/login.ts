import type { ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { AdminRequest } from '../middleware.js';
import { setSessionCookie } from '../middleware.js';

/** Comparación en tiempo constante para evitar timing attacks. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// La firma DEBE coincidir con el tipo `Handler` de router.ts: (req, res, params, body)
export async function login(
  _req: AdminRequest,
  res: ServerResponse,
  _params: Record<string, string>,
  body: unknown
): Promise<void> {
  const data = (body ?? {}) as { email?: string; password?: string };
  const email = data.email;
  const password = data.password;

  if (!email || !password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'email y password son requeridos' }));
    return;
  }

  const validEmail = process.env.SUPER_ADMIN_EMAIL;
  const validPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (
    !validEmail ||
    !validPassword ||
    !safeCompare(email, validEmail) ||
    !safeCompare(password, validPassword)
  ) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Credenciales inválidas' }));
    return;
  }

  setSessionCookie(res, {
    sub: email,
    exp: Date.now() + 1000 * 60 * 60 * 8, // 8 horas
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
}