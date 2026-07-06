import type { IncomingMessage, ServerResponse } from 'node:http';
import { decodeSession, encodeSession, type SuperAdminSession } from './session';

export interface AdminRequest extends IncomingMessage {
  adminSession?: SuperAdminSession;
}

export const SESSION_COOKIE = 'admin_session';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * Igual que requireSuperAdmin, pero sin tocar `res`: solo lee y decodifica
 * la cookie. Útil quando el caller necesita decidir *cómo* responder
 * (JSON 401 vs. redirect 302 a /) antes de cortar el flujo.
 */
export function getAdminSession(req: AdminRequest): SuperAdminSession | null {
  const cookies = parseCookies(req.headers.cookie);
  const session = decodeSession(cookies[SESSION_COOKIE]);
  if (session) req.adminSession = session;
  return session;
}

/**
 * Verifica que exista una sesión de super-admin válida.
 * Si no la hay, responde 401 y devuelve null (el caller debe cortar el flujo).
 */
export function requireSuperAdmin(req: AdminRequest, res: ServerResponse): SuperAdminSession | null {
  const session = getAdminSession(req);

  if (!session) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No autenticado' }));
    return null;
  }

  return session;
}

export function setSessionCookie(res: ServerResponse, session: SuperAdminSession): void {
  const isProd = process.env.NODE_ENV === 'production';
  const flags = ['HttpOnly', 'Path=/', 'SameSite=Strict', isProd ? 'Secure' : ''].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeSession(session)}; ${flags}`);
}
