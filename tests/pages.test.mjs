import test from 'node:test';
import assert from 'node:assert/strict';

test('demo renders every member page and interactive transaction filters', async () => {
  const elements = new Map();
  const handlers = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { innerHTML:'', textContent:'', attrs:{}, classList:{ add(){}, remove(){}, toggle(){ return false; } }, setAttribute(k,v){ this.attrs[k]=v; }, removeAttribute(k){ delete this.attrs[k]; }, addEventListener(k,v){ handlers.set(id + ':' + k,v); } });
    return elements.get(id);
  }
  const original = Object.fromEntries(['document','window','location','sessionStorage'].map(key => [key,globalThis[key]]));
  globalThis.document = {
    querySelector(selector) {
      if (['#content','#sidebar','.menu-button','#breadcrumb'].includes(selector) && !element('#app').innerHTML.includes('id="content"')) return null;
      return element(selector);
    },
    querySelectorAll(){ return []; },
    addEventListener(k,v){ handlers.set('document:' + k,v); },
  };
  globalThis.window = { addEventListener(k,v){ handlers.set('window:' + k,v); } };
  globalThis.location = { hash:'#dashboard' };
  globalThis.sessionStorage = { getItem(){ return '1'; }, setItem(){}, removeItem(){} };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  try {
    await import('../apps/web/public/app.js?render-test'); await settle();
    assert.match(element('#app').innerHTML, /DEMO MODE/);
    assert.match(element('#content').innerHTML, /Community Bonus Distribution/);
    assert.match(element('#content').innerHTML, /Affiliates Earning Meter/);
    assert.match(element('#content').innerHTML, /Top Referrals/);
    const routes = { dashboard:'Welcome back, Alex', wallet:'My wallet', transactions:'Transactions', referrals:'Referral network', tree:'Binary tree', profile:'My profile', sync:'Account sync' };
    for (const [route, title] of Object.entries(routes)) {
      globalThis.location.hash = '#' + route;
      handlers.get('window:hashchange')(); await settle();
      assert.match(element('#content').innerHTML, new RegExp(title), route);
      assert.doesNotMatch(element('#content').innerHTML, /Unable to load this page|undefined|NaN/, route);
    }
    globalThis.location.hash = '#transactions'; handlers.get('window:hashchange')(); await settle();
    await handlers.get('#app:change')({ target:{ id:'tx-type', value:'WITHDRAWAL', dataset:{} } });
    assert.match(element('#content').innerHTML, /5 transactions/);
    assert.match(element('#content').innerHTML, /WITHDRAWAL/);
    assert.doesNotMatch(element('#content').innerHTML, /Daily earnings/);
    globalThis.location.hash = '#admin'; handlers.get('window:hashchange')(); await settle();
    assert.match(element('#content').innerHTML, /Welcome back, Alex/);
    globalThis.location.hash = '#missing'; handlers.get('window:hashchange')(); await settle();
    assert.match(element('#content').innerHTML, /Welcome back, Alex/);
  } finally { for (const [key,value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
