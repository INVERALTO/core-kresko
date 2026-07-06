import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Firma simétrica de la sesión del panel de super-admin.
 * No usa JWT ni librerías externas: es un HMAC simple sobre un payload JSON.
 *
 * IMPORTANTE: ADMIN_SESSION_SECRET debe ser un valor largo y aleatorio,
 * distinto por entorno, y NUNCA debe vivir en el repo.
 */

const SECRET = process.env.ADMIN_SESSION_SECRET;
if (!SECRET) {
  throw new Error('ADMIN_SESSION_SECRET no está definido en el entorno');
}

export interface SuperAdminSession {
  /** identificador del super-admin autenticado */
  sub: string;
  /** tenantId que está siendo impersonado actualmente, si aplica */
  impersonating?: string;
  /** epoch ms de expiración */
  exp: number;
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET as string).update(payload).digest('base64url');
}

export function encodeSession(session: SuperAdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function decodeSession(token: string | undefined): SuperAdminSession | null {
  if (!token) return null;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SuperAdminSession;
    if (typeof session.exp !== 'number' || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
