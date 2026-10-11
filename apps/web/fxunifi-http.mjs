// Same-site requests for the form endpoint observed on FXUNIFI's sign-in page.
// Credentials are sent only to this fixed HTTPS origin and never logged.
const origin = 'https://fxunifi.com';

export class FxunifiSession {
  constructor({ fetchImpl = fetch } = {}) { this.fetch = fetchImpl; this.cookies = new Map(); }
  async request(path, { method = 'GET', body } = {}) {
    let url = new URL(path, origin);
    for (let redirects = 0; redirects < 6; redirects++) {
      if (url.origin !== origin) throw new Error('FXUNIFI redirected outside its trusted origin.');
      const headers = { Accept:'text/html,application/json', 'User-Agent':'TradeVault Local Account Sync/1.0' };
      const cookies = [...this.cookies.values()].filter(cookie => url.pathname.startsWith(cookie.path));
      if (cookies.length) headers.Cookie = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      if (body !== undefined) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; headers.Origin = origin; headers.Referer = origin + '/members/signin'; headers['X-Requested-With'] = 'XMLHttpRequest'; }
      const response = await this.fetch(url.href, { method, body, headers, redirect:'manual', signal:AbortSignal.timeout(20000) });
      for (const value of response.headers.getSetCookie()) {
        const [pair, ...attributes] = value.split(';'); const index = pair.indexOf('=');
        if (index < 1) continue;
        const name = pair.slice(0,index).trim(); const settings = attributes.map(attribute => attribute.trim());
        const domain = settings.find(attribute => /^domain=/i.test(attribute))?.slice(7).replace(/^\./,'').toLowerCase();
        if (domain && domain !== 'fxunifi.com') continue;
        const path = settings.find(attribute => /^path=/i.test(attribute))?.slice(5) || '/';
        if (settings.some(attribute => /^max-age=0$/i.test(attribute))) this.cookies.delete(name);
        else this.cookies.set(name,{ name, value:pair.slice(index+1), path });
      }
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location'); if (!location) throw new Error('FXUNIFI returned an invalid redirect.');
        url = new URL(location,url);
        if ([301,302,303].includes(response.status)) { method='GET'; body=undefined; }
        continue;
      }
      if (!response.ok) throw new Error(`FXUNIFI request failed (HTTP ${response.status}).`);
      const text = await response.text();
      if (text.length > 5000000) throw new Error('FXUNIFI page is too large to import.');
      return { text, url:url.href };
    }
    throw new Error('FXUNIFI redirected too many times.');
  }
  async login({ username, password }) {
    await this.request('/members/signin');
    const { text } = await this.request('/api',{ method:'POST', body:new URLSearchParams({ module:'signin', username, password }).toString() });
    let result; try { result=JSON.parse(text); } catch { throw new Error('FXUNIFI login returned an unsupported response.'); }
    if (Number(result.status) === 2) throw new Error('FXUNIFI requires an OTP. Complete the original-site verification first.');
    if (Number(result.status) !== 1) throw new Error('FXUNIFI rejected the login. Check your saved credentials or account verification.');
    const target = new URL(result.redirect || '/members/',origin + '/');
    if (target.origin !== origin || !target.pathname.startsWith('/members')) throw new Error('FXUNIFI login returned an unexpected destination.');
    const page = await this.request(target.href);
    if (/id=["']loginform["']/i.test(page.text) || new URL(page.url).pathname.includes('signin')) throw new Error('FXUNIFI did not establish an authenticated session.');
    return page;
  }
}
