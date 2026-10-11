export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function safeLink(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

export function money(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' && /^[A-Z]{3}\s/.test(value)) return value.replace(/^USD\s/, '$');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

export function date(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? '—' : parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function csv(rows, columns) {
  const cell = value => {
    let s = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [columns.map(c => cell(c.label)).join(','), ...rows.map(r => columns.map(c => cell(r[c.key])).join(','))].join('\r\n');
}

export function createApi({ fetchImpl = fetch, onExpired = () => {} } = {}) {
  let token = null;
  let refresh = null;
  async function request(path, { method = 'GET', body, retry = true } = {}) {
    let response;
    try {
      response = await fetchImpl('/api' + path, { method, credentials: 'same-origin', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Error('Could not connect. Check your connection and try again.'); }
    if (response.status === 401 && retry && !/^\/(?:local\/)?auth\//.test(path)) {
      try {
        refresh ||= request(path.startsWith('/local/') ? '/local/auth/refresh' : '/auth/refresh', { method: 'POST', body: {}, retry: false }).then(data => { token = data.accessToken; }).finally(() => { refresh = null; });
        await refresh;
      } catch { token = null; onExpired(); throw new Error('Your session expired. Please sign in again.'); }
      return request(path, { method, body, retry: false });
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'The request failed. Please try again.');
    return payload.data;
  }
  return { request, setToken: value => { token = value; } };
}
