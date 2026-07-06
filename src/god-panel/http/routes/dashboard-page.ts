import type { ServerResponse } from 'node:http';

const PAGE = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kresko // God Panel — Tenants</title>
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
    --danger-dim: #6b2f26;
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
    padding: 32px 24px 60px;
  }
  .wrap { max-width: 980px; margin: 0 auto; }

  .topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
    flex-wrap: wrap;
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
  h1 { font-family: var(--sans); font-weight: 700; font-size: 26px; letter-spacing: -0.01em; margin: 0; }
  .sub { color: var(--muted); font-size: 13px; margin: 4px 0 0; }

  button {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    border-radius: 6px;
    border: 1px solid var(--accent-dim);
    background: transparent;
    color: var(--accent);
    padding: 10px 16px;
    transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  }
  button:hover:not(:disabled) { background: var(--accent); color: #1a1200; }
  button:disabled { opacity: 0.45; cursor: default; }
  button.danger { border-color: var(--danger-dim); color: var(--danger); }
  button.danger:hover:not(:disabled) { background: var(--danger); color: #240a06; }
  button.ghost { border-color: var(--line); color: var(--muted); }
  button.ghost:hover:not(:disabled) { background: var(--line); color: var(--text); }
  button.small { padding: 5px 10px; font-size: 10.5px; }

  .panel {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
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

  .create-panel { padding: 18px 20px; margin-bottom: 18px; display: none; }
  .create-panel.open { display: block; }
  .create-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
  .field { flex: 1; min-width: 180px; }
  label {
    display: block;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    color: var(--muted);
    text-transform: uppercase;
    margin: 0 0 6px;
  }
  .field-wrap {
    display: flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: #0d1013;
  }
  .field-wrap:focus-within { border-color: var(--accent-dim); }
  .field-wrap .bracket { font-family: var(--mono); color: var(--line); padding: 0 4px 0 10px; font-size: 14px; user-select: none; }
  input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    padding: 10px 10px 10px 4px;
    width: 100%;
  }
  input::placeholder { color: #3d4750; }

  .create-status {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    margin-top: 12px;
    min-height: 16px;
  }
  .create-status.ok { color: var(--ok); }
  .create-status.err { color: var(--danger); }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
  }
  tbody td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--line-soft);
    font-size: 13.5px;
    vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: none; }
  .cell-id { font-family: var(--mono); color: var(--muted); font-size: 12px; }
  .cell-name { font-weight: 600; }
  .cell-slug { font-family: var(--mono); color: var(--muted); font-size: 12px; }

  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 100px;
    border: 1px solid var(--line);
  }
  .badge.active { color: var(--ok); border-color: #2c4a34; }
  .badge.suspended { color: var(--accent); border-color: var(--accent-dim); }
  .badge.archived { color: var(--muted); border-color: var(--line); }

  .actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

  .empty, .loading {
    padding: 40px 16px;
    text-align: center;
    color: var(--muted);
    font-family: var(--mono);
    font-size: 12.5px;
  }

  .foot {
    margin-top: 16px;
    font-family: var(--mono);
    font-size: 10.5px;
    color: #3d4750;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div>
        <div class="eyebrow">Kresko control plane</div>
        <h1>God Panel — Tenants</h1>
        <p class="sub">Alta, suspensión y borrado de tenants sobre el catálogo (kresko_admin).</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="ghost small" id="refreshBtn" type="button">↻ Refrescar</button>
        <button id="toggleCreateBtn" type="button">+ Nuevo tenant</button>
      </div>
    </div>

    <div class="panel create-panel" id="createPanel">
      <form id="createForm" autocomplete="off">
        <div class="create-row">
          <div class="field">
            <label for="slug">Slug</label>
            <div class="field-wrap">
              <span class="bracket">&gt;</span>
              <input id="slug" name="slug" type="text" placeholder="acme-corp" required />
            </div>
          </div>
          <div class="field">
            <label for="name">Nombre</label>
            <div class="field-wrap">
              <span class="bracket">&gt;</span>
              <input id="name" name="name" type="text" placeholder="Acme Corp" required />
            </div>
          </div>
          <button type="submit" id="createSubmitBtn">Crear</button>
        </div>
      </form>
      <div class="create-status" id="createStatus"></div>
    </div>

    <div class="panel">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>ID / Slug</th>
            <th>Status</th>
            <th>Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="tenantsBody">
          <tr><td colspan="5" class="loading">cargando tenants…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="foot">SUPERADMIN · GOD PANEL · KRESKO CORE</div>
  </div>

<script>
  const tenantsBody = document.getElementById('tenantsBody');
  const toggleCreateBtn = document.getElementById('toggleCreateBtn');
  const createPanel = document.getElementById('createPanel');
  const createForm = document.getElementById('createForm');
  const createStatus = document.getElementById('createStatus');
  const createSubmitBtn = document.getElementById('createSubmitBtn');
  const refreshBtn = document.getElementById('refreshBtn');

  function setCreateStatus(text, mode) {
    createStatus.textContent = text || '';
    createStatus.className = 'create-status' + (mode ? ' ' + mode : '');
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function badgeFor(status) {
    const cls = status === 'ACTIVE' ? 'active' : status === 'SUSPENDED' ? 'suspended' : 'archived';
    return '<span class="badge ' + cls + '">' + status + '</span>';
  }

  async function api(path, options) {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...options,
    });
    if (res.status === 401) {
      window.location.href = '/';
      throw new Error('No autenticado');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || ('Error ' + res.status));
    }
    return data;
  }

  function renderRow(tenant) {
    const tr = document.createElement('tr');
    const isActive = tenant.status === 'ACTIVE';
    const toggleLabel = isActive ? 'Suspender' : 'Activar';
    const toggleTarget = isActive ? 'SUSPENDED' : 'ACTIVE';

    tr.innerHTML =
      '<td class="cell-name">' + tenant.name + '</td>' +
      '<td class="cell-slug">' + tenant.id + ' <span class="cell-id">/ ' + tenant.slug + '</span></td>' +
      '<td>' + badgeFor(tenant.status) + '</td>' +
      '<td class="cell-id">' + fmtDate(tenant.createdAt) + '</td>' +
      '<td>' +
        '<div class="actions">' +
          '<button class="ghost small" data-action="toggle" data-target="' + toggleTarget + '">' + toggleLabel + '</button>' +
          '<button class="ghost small" data-action="archive">Archivar</button>' +
          '<button class="danger small" data-action="hard-delete">Borrar</button>' +
        '</div>' +
      '</td>';

    tr.querySelector('[data-action="toggle"]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const target = btn.getAttribute('data-target');
      btn.disabled = true;
      try {
        await api('/admin/tenants/' + tenant.id + '/status', {
          method: 'PATCH',
          body: JSON.stringify({ status: target }),
        });
        await loadTenants();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });

    tr.querySelector('[data-action="archive"]').addEventListener('click', async (e) => {
      if (!confirm('¿Archivar (soft-delete) el tenant "' + tenant.name + '"? Esto no borra su base de datos física.')) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await api('/admin/tenants/' + tenant.id, { method: 'DELETE' });
        await loadTenants();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });

    tr.querySelector('[data-action="hard-delete"]').addEventListener('click', async (e) => {
      if (!confirm('¿BORRAR PERMANENTEMENTE el tenant "' + tenant.name + '" del catálogo? La base de datos física quedará huérfana (no se borra). Esta acción no se puede deshacer.')) return;
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await api('/admin/tenants/' + tenant.id + '?hard=true', { method: 'DELETE' });
        await loadTenants();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
      }
    });

    return tr;
  }

  async function loadTenants() {
    tenantsBody.innerHTML = '<tr><td colspan="5" class="loading">cargando tenants…</td></tr>';
    try {
      const data = await api('/admin/tenants', { method: 'GET' });
      const tenants = data.tenants || [];
      if (tenants.length === 0) {
        tenantsBody.innerHTML = '<tr><td colspan="5" class="empty">No hay tenants todavía.</td></tr>';
        return;
      }
      tenantsBody.innerHTML = '';
      for (const tenant of tenants) {
        tenantsBody.appendChild(renderRow(tenant));
      }
    } catch (err) {
      tenantsBody.innerHTML = '<tr><td colspan="5" class="empty">Error cargando tenants: ' + err.message + '</td></tr>';
    }
  }

  toggleCreateBtn.addEventListener('click', () => {
    createPanel.classList.toggle('open');
  });

  refreshBtn.addEventListener('click', () => loadTenants());

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = document.getElementById('slug').value.trim();
    const name = document.getElementById('name').value.trim();

    createSubmitBtn.disabled = true;
    // El aprovisionamiento físico (CREATE DATABASE + prisma db push) tarda
    // varios segundos; avisamos para que no parezca colgado.
    setCreateStatus('creando catálogo y aprovisionando base física — puede tardar unos segundos…');

    try {
      await api('/admin/tenants', { method: 'POST', body: JSON.stringify({ slug, name }) });
      setCreateStatus('tenant creado', 'ok');
      createForm.reset();
      createPanel.classList.remove('open');
      await loadTenants();
    } catch (err) {
      setCreateStatus(err.message, 'err');
    } finally {
      createSubmitBtn.disabled = false;
    }
  });

  loadTenants();
</script>
</body>
</html>`;

export function serveDashboardPage(res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}
