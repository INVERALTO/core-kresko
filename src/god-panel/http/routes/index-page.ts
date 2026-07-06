import type { ServerResponse } from 'node:http';
import type { AdminRequest } from '../middleware.js';

const PAGE = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kresko // God Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0b0e11;
    --panel: #12161c;
    --line: #232a32;
    --line-soft: #1a2028;
    --text: #e7ecef;
    --muted: #7d8892;
    --accent: #e8a33d;
    --accent-dim: #6b5528;
    --danger: #e0654f;
    --ok: #7fbf8f;
    --mono: 'IBM Plex Mono', ui-monospace, monospace;
    --sans: 'Inter', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(circle at 1px 1px, var(--line-soft) 1px, transparent 0) 0 0/28px 28px,
      var(--bg);
    color: var(--text);
    font-family: var(--sans);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .frame {
    width: 100%;
    max-width: 420px;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .eyebrow::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }
  h1 {
    font-family: var(--sans);
    font-weight: 700;
    font-size: 28px;
    letter-spacing: -0.01em;
    margin: 0 0 4px;
  }
  .sub {
    color: var(--muted);
    font-size: 13.5px;
    margin: 0 0 22px;
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 22px 22px 18px;
    position: relative;
    overflow: hidden;
  }
  .panel::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-dim), transparent);
  }
  .status {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 18px;
    min-height: 16px;
  }
  .status .cursor {
    display: inline-block;
    width: 7px;
    height: 12px;
    background: var(--muted);
    margin-left: 2px;
    vertical-align: -2px;
    animation: blink 1.1s steps(1) infinite;
  }
  .status.ok { color: var(--ok); }
  .status.ok .cursor { background: var(--ok); }
  .status.err { color: var(--danger); }
  .status.err .cursor { background: var(--danger); }
  @keyframes blink { 50% { opacity: 0; } }

  label {
    display: block;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.12em;
    color: var(--muted);
    text-transform: uppercase;
    margin: 0 0 6px;
  }
  .field { margin-bottom: 16px; }
  .field-wrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #0d1013;
    transition: border-color 0.15s ease;
  }
  .field-wrap:focus-within {
    border-color: var(--accent-dim);
  }
  .field-wrap .bracket {
    font-family: var(--mono);
    color: var(--line);
    padding: 0 4px 0 10px;
    font-size: 14px;
    user-select: none;
  }
  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13.5px;
    padding: 11px 10px 11px 4px;
  }
  input::placeholder { color: #3d4750; }

  button {
    width: 100%;
    margin-top: 6px;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid var(--accent-dim);
    background: transparent;
    color: var(--accent);
    font-family: var(--mono);
    font-size: 12.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  button:hover:not(:disabled) {
    background: var(--accent);
    color: #1a1200;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .foot {
    margin-top: 16px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: #3d4750;
    text-align: center;
  }

  .shake { animation: shake 0.32s ease; }
  @keyframes shake {
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .status .cursor { animation: none; }
    .shake { animation: none; }
  }
</style>
</head>
<body>
  <div class="frame">
    <div class="eyebrow">Kresko control plane</div>
    <h1>God Panel</h1>
    <p class="sub">Acceso de super-administrador. Contexto root sobre todos los tenants.</p>

    <div class="panel" id="panel">
      <div class="status" id="status">awaiting credentials<span class="cursor"></span></div>

      <form id="loginForm" autocomplete="off">
        <div class="field">
          <label for="email">Operator ID</label>
          <div class="field-wrap">
            <span class="bracket">&gt;</span>
            <input id="email" name="email" type="text" placeholder="adminkresko" required />
          </div>
        </div>
        <div class="field">
          <label for="password">Access Key</label>
          <div class="field-wrap">
            <span class="bracket">&gt;</span>
            <input id="password" name="password" type="password" placeholder="••••••••••••" required />
          </div>
        </div>
        <button type="submit" id="submitBtn">Authenticate</button>
      </form>
    </div>

    <div class="foot">SUPERADMIN · 8H SESSION · HTTPONLY COOKIE</div>
  </div>

<script>
  const form = document.getElementById('loginForm');
  const statusEl = document.getElementById('status');
  const panel = document.getElementById('panel');
  const btn = document.getElementById('submitBtn');

  function setStatus(text, mode) {
    statusEl.className = 'status' + (mode ? ' ' + mode : '');
    statusEl.innerHTML = text + '<span class="cursor"></span>';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    btn.disabled = true;
    setStatus('verifying credentials');

    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        setStatus('access granted — entering context', 'ok');
        setTimeout(() => { window.location.href = '/admin/tenants'; }, 500);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || 'access denied', 'err');
        panel.classList.remove('shake');
        void panel.offsetWidth;
        panel.classList.add('shake');
        btn.disabled = false;
      }
    } catch (err) {
      setStatus('connection error — retry', 'err');
      btn.disabled = false;
    }
  });
</script>
</body>
</html>`;

// La firma DEBE coincidir con el tipo `Handler` de router.ts: (req, res, params, body)
export function serveLoginPage(_req: AdminRequest, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}
