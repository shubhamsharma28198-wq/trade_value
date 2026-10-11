import { renderReferenceTree, extremeTreeNode } from './reference-tree.js';
import { renderReferenceDashboard } from './reference-dashboard.js';
import { createApi, escapeHtml as e, money, date, csv, safeLink } from './client.js';
import { createDemo } from './demo.js';
import { renderSyncPage } from './sync-page.js';

const app = document.querySelector('#app');
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15V8H5a3 3 0 0 1 0-6"/><path d="M20 12h-5v5h5"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m4 11v-3a6 6 0 0 0-4-5"/>',
  tree: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  sync: '<path d="M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6M4 17a9 9 0 0 0 15 2l3-3m0 6v-6h-6"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z"/><path d="m8 12 3 3 5-6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  logout: '<path d="M9 3H3v18h6m6-14 5 5-5 5m-8-5h13"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M3 17v4h18v-4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
};
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.grid}</svg>`;
const nav = [['dashboard', 'Overview', 'grid'], ['wallet', 'My wallet', 'wallet'], ['transactions', 'Transactions', 'activity'], ['referrals', 'Referrals', 'users'], ['tree', 'Binary tree', 'tree'], ['profile', 'My profile', 'user'], ['sync', 'Account sync', 'sync']];
const state = { user: null, demo: false, local: false, hosted: document.body?.dataset.portalMode === 'hosted', route: 'dashboard', version: 0, page: 1, type: '', status: '', adminTab: 'users', search: '', treeFocus: '', treeQuery: '', treeZoom: 'normal' };
let demoRequest, toastTimer, syncPollTimer;
const api = createApi({ onExpired: () => { state.user = null; showLogin(); } });
const request = (path, options) => state.demo ? demoRequest(path, options) : api.request((state.local ? '/local' : '') + path, options);
async function pollLocalSync() {
  clearTimeout(syncPollTimer);
  if (!state.local || !state.user) return;
  const username = state.user.username;
  try {
    const status = await request('/sync/status');
    if (!state.local || state.user?.username !== username) return;
    if (['RUNNING','PENDING'].includes(status.status)) { syncPollTimer = setTimeout(pollLocalSync,2000); return; }
    if (status.status === 'SUCCESS') {
      state.user = (await request('/auth/me')).user;
      if (!state.local || state.user?.username !== username) return;
      shell(); await navigate(); toast('FXUNIFI profile and records synced.');
    } else if (status.status === 'FAILED') { toast(status.errorMessage || 'Sync failed. Try again from Account sync.'); if (state.route === 'sync') await navigate(); }
  } catch (error) { if (state.local) toast(error.message); }
}
const statusBadge = status => `<span class="badge ${['ACTIVE', 'COMPLETED', 'SUCCESS'].includes(status) ? 'green' : ['FAILED', 'INACTIVE', 'SUSPENDED'].includes(status) ? 'red' : 'amber'}">${e(status?.replaceAll('_', ' ') || '—')}</span>`;
function toast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4000); }
function errorHtml(error) { return `<div class="error-box" role="alert">${e(error.message)}<button data-action="reload">Try again</button></div>`; }
function stat(label, value, name = 'wallet', subtitle = '') { return `<article class="stat"><div class="stat-top"><span>${e(label)}</span><span class="stat-icon">${icon(name)}</span></div><strong>${e(value)}</strong><small>${e(subtitle)}</small></article>`; }
function heading(title, description, action = '') { return `<div class="page-heading"><div><p class="eyebrow">MEMBER PORTAL</p><h1>${e(title)}</h1><p>${e(description)}</p></div>${action}</div>`; }

function showLogin(register = false) {
  if(state.hosted)register=false;
  state.version++;
  app.innerHTML = `<div class="auth-layout"><section class="auth-story"><a class="brand" href="#login"><span class="brand-mark">T</span>Trade<span>Vault</span></a><div class="story-content"><span class="story-tag">YOUR MEMBER PORTAL</span><h1>A clearer view.<br>A stronger network.</h1><p>Manage your account, track your wallet, and keep your referral network connected. All in one place.</p><div class="story-features"><span>${icon(walletIcon())} Wallet overview</span><span>${icon('users')} Referral network</span><span>${icon('shield')} Secure account access</span></div><div class="story-card"><span>EVERYTHING, IN ONE PLACE</span><div class="story-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><p>Your account. Your progress.</p></div></div><small>TradeVault · Member account management</small></section><section class="auth-form-area"><div class="auth-form"><span class="auth-kicker">WELCOME TO TRADEVAULT</span><h2>${register ? 'Create your account' : 'Welcome back'}</h2><p>${state.hosted ? 'Sign in with your private portal credentials. Your FXUNIFI connection is handled on the server.' : register ? 'Start with a few details to set up your member profile.' : 'Sign in to your member dashboard.'}</p><form id="auth-form" data-register="${register}">${register ? '<label>Full name<input name="fullName" autocomplete="name" maxlength="100" placeholder="Your full name"></label><label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>' : ''}<label>Username<input name="username" autocomplete="username" required minlength="${register ? 3 : 1}" maxlength="50" placeholder="Enter your username"></label><label>Password<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="${register ? 8 : 1}" placeholder="${register ? 'At least 8 characters' : 'Enter your password'}"></label><p class="form-error" role="alert"></p><button class="primary full" type="submit">${register ? 'Create account' : 'Sign in'} ${icon('arrow')}</button>${register || state.hosted ? '' : '<button class="secondary full" type="submit" data-local-login="true">Use saved FXUNIFI credentials</button><p class="helper">Signs in locally, then imports your original FXUNIFI account records.</p>'}</form>${state.hosted ? '' : `<p class="auth-switch">${register ? 'Already a member?' : 'New to TradeVault?'} <button data-action="${register ? 'login' : 'register'}">${register ? 'Sign in' : 'Create an account'}</button></p>`}<div class="divider"><span>OR EXPLORE FIRST</span></div><button class="secondary full" data-action="demo">Explore demo dashboard ${icon('arrow')}</button><p class="demo-note">Sample data only. No account or connection required.</p></div></section></div>`;
}
function walletIcon() { return 'wallet'; }
function localBanner() {
  return `<div class="demo-banner"><strong>${state.user.lastSyncAt ? 'FXUNIFI · SYNCED' : 'FXUNIFI · WAITING FOR SYNC'}</strong><span>${state.user.lastSyncAt ? 'Showing your original FXUNIFI records from the last successful sync.' : 'Connecting to FXUNIFI. Your records will appear after the first successful sync.'}</span><a href="#sync">Account sync</a></div>`;
}
function shell() {
  const menu = state.user.role === 'ADMIN' ? [...nav, ['admin', 'Administration', 'shield']] : nav;
  app.innerHTML = `<div class="workspace"><aside id="sidebar"><a class="brand" href="#dashboard"><span class="brand-mark">T</span>Trade<span>Vault</span></a><p class="nav-label">WORKSPACE</p><nav aria-label="Main navigation">${menu.map(([path, label, name]) => `<a href="#${path}" data-route="${path}" title="${label}" aria-label="${label}">${icon(name)}<span>${label}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="account-card"><span class="avatar">${e((state.user.fullName || state.user.username).charAt(0))}</span><div><strong>${e(state.user.fullName || state.user.username)}</strong><small>${e(state.user.rank || 'Member')} member</small></div></div><button data-action="logout">${icon('logout')} Sign out</button></div></aside><div class="main-column"><header class="topbar"><button class="icon-button menu-button" data-action="menu" aria-label="Toggle navigation" aria-expanded="false">${icon('menu')}</button><span class="breadcrumb">Workspace <span>/</span> <strong id="breadcrumb">Overview</strong></span><div class="topbar-right"><span class="portal-status"><i></i>${state.demo ? 'Demo workspace' : 'Member workspace'}</span><a class="avatar" href="#profile" aria-label="Open profile">${e((state.user.fullName || state.user.username).charAt(0))}</a></div></header>${state.demo ? '<div class="demo-banner"><strong>DEMO MODE</strong><span>You’re viewing sample data. Changes last for this session.</span><button data-action="logout">Sign in to your account →</button></div>' : ''}${state.local ? localBanner() : ''}<main id="content" tabindex="-1"></main><footer>© ${new Date().getFullYear()} TradeVault <span>Member portal · ${state.demo ? 'Sample data' : state.local ? (state.user.lastSyncAt ? 'FXUNIFI import' : 'Awaiting FXUNIFI sync') : 'Connected account'}</span></footer></div></div>`;
}

function table(headers, rows, empty = 'No records to display.') {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty">${e(empty)}</td></tr>`}</tbody></table></div>`;
}
function transactionRows(list) { return list.map(t => [`<div class="tx-label"><span class="tx-icon">${icon(t.type === 'WITHDRAWAL' ? 'wallet' : 'activity')}</span><div><strong>${e(t.description === '-' ? t.type : t.description)}</strong><small>${e(t.type)}</small></div></div>`, e(date(t.createdAt)), `<strong>${e(money(t.amount))}</strong>`, statusBadge(t.status), `<span class="muted">${e(t.reference || '—')}</span>`]); }
function referralCards(links) {
  return `<div class="referral-links">${['left', 'right'].map(side => { const url = safeLink(links?.[side]); return `<div><span class="link-label">${side === 'left' ? 'Left' : 'Right'} team referral link</span><div class="copy-field"><input aria-label="${side} referral link" value="${e(url)}" readonly placeholder="No referral link connected"><button data-copy="${e(url)}" ${url ? '' : 'disabled'} aria-label="Copy ${side} referral link">${icon('copy')}</button></div></div>`; }).join('')}</div>`;
}
function earningsChart(transactions) {
  const grouped = new Map();
  for (const t of transactions.filter(t => ['EARNINGS', 'COMMISSION', 'BONUS'].includes(t.type) && t.status === 'COMPLETED').reverse()) {
    const key = date(t.createdAt); grouped.set(key, (grouped.get(key) || 0) + Number(String(t.amount).replace(/[^0-9.-]/g, '')));
  }
  const entries = [...grouped.entries()].slice(-10);
  if (!entries.length) return '<div class="chart-empty">Your earnings will appear here once completed transactions are recorded.</div>';
  const max = Math.max(...entries.map(([,v]) => v), 1);
  const points = entries.map(([,v], i) => `${45 + (entries.length === 1 ? 250 : i * 505 / (entries.length - 1))},${165 - v / max * 115}`);
  return `<div class="chart"><svg viewBox="0 0 590 205" role="img" aria-label="Earnings from recent completed transactions"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#20c997" stop-opacity=".25"/><stop offset="100%" stop-color="#20c997" stop-opacity="0"/></linearGradient></defs>${[50, 90, 130, 170].map(y => `<line x1="45" x2="550" y1="${y}" y2="${y}" stroke="#edf0f4"/>`).join('')}<text x="0" y="55" fill="#8790a1" font-size="12">${Math.round(max)}</text><text x="18" y="173" fill="#8790a1" font-size="12">0</text><path d="M${points[0].split(',')[0]},170 L${points.join(' L')} L${points.at(-1).split(',')[0]},170 Z" fill="url(#chart-fill)"/><polyline points="${points.join(' ')}" fill="none" stroke="#16ae83" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map((p,i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="4" fill="#fff" stroke="#16ae83" stroke-width="2"><title>${e(entries[i][0])}: ${e(money(entries[i][1]))}</title></circle>`).join('')}<text x="45" y="199" fill="#8790a1" font-size="11">${e(entries[0][0])}</text><text x="550" y="199" text-anchor="end" fill="#8790a1" font-size="11">${e(entries.at(-1)[0])}</text></svg></div>`;
}

async function dashboard() {
  const [data, tx, referrals] = await Promise.all([request('/dashboard'), request('/transactions?limit=30'), request('/referrals')]);
  const syncControl = state.local ? `${heading('Overview','Your latest imported FXUNIFI account records.',`<button class="primary" data-action="sync">${icon('sync')} Sync now</button>`)}<p class="helper">${state.user.lastSyncAt ? 'Last synced: ' + e(new Date(state.user.lastSyncAt).toLocaleString()) : 'Waiting for your first successful sync.'}</p>` : '';
  return syncControl + renderReferenceDashboard({ data, transactions: tx.transactions, referrals, icon, referralCards, table, transactionRows });
}
async function wallet() {
  const data = await request('/wallet'); const w = data.wallet;
  return `${heading('My wallet', 'Your recorded balances, capital, and earnings.', '<button class="secondary" data-action="reload">Refresh wallet</button>')}${state.local && w.capital === null ? '<div class="error-box" role="status">Your first FXUNIFI import has not finished. <a href="#sync">View sync status</a></div>' : ''}<section class="balance-card"><div><span>AVAILABLE BALANCE</span><h2>${e(money(w.availableBalance))}</h2><p>USD · Account wallet</p></div><span class="balance-icon">${icon('wallet')}</span></section><div class="stats-grid wallet-stats">${[['My capital','capital'],['Total invested','totalInvested'],['Total profit','totalProfit'],['Total earned','totalEarned'],['Total withdrawn','totalWithdrawn']].map(([label,key]) => stat(label, money(w[key]), 'wallet')).join('')}</div><section class="panel"><h2>Wallet history</h2><p class="muted">Review completed and pending transactions associated with your account.</p><a class="primary" href="#transactions">View transactions ${icon('arrow')}</a><p class="helper">This portal displays account records. Payment processing is not connected.</p></section>${state.local && data.depositHistory ? `<section class="panel"><h2>Trading deposit history</h2>${table(['Contract','Date','Package','Amount','Status'], data.depositHistory.map(row => [e(row.reference),e(date(row.createdAt)),e(row.description),e(money(row.amount)),e(row.status)]),'No deposit records.')}</section><section class="panel"><h2>Withdrawal history</h2>${table(['Date','Amount','Status','Transaction ID'], data.withdrawalHistory.map(row => [e(date(row.createdAt)),e(money(row.amount)),statusBadge(row.status),e(row.reference || '—')]),'No withdrawal records.')}</section>` : ''}`;
}
let currentTransactions = [];
async function transactions() {
  const query = new URLSearchParams({ page: state.page, limit: 10, ...(state.type ? { type: state.type } : {}), ...(state.status ? { status: state.status } : {}) });
  const data = await request('/transactions?' + query);
  currentTransactions = data.transactions;
  return `${heading('Transactions', 'Track your account activity and transaction status.', `<button class="secondary" data-action="export">${icon('download')} Export page</button>`)}<section class="panel"><div class="filter-bar"><label>Transaction type<select id="tx-type"><option value="">All types</option>${['DEPOSIT','WITHDRAWAL','COMMISSION','EARNINGS','BONUS','CREDIT','DEBIT'].map(t => `<option ${state.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Status<select id="tx-status"><option value="">All statuses</option>${['PENDING','COMPLETED','FAILED','CANCELLED'].map(t => `<option ${state.status === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><span class="filter-count">${data.pagination.totalItems} transactions</span></div>${table(['Transaction','Date','Amount','Status','Reference'], transactionRows(data.transactions), 'No transactions match these filters.')}<div class="pagination"><span>Page ${data.pagination.totalPages ? state.page : 0} of ${data.pagination.totalPages}</span><div><button class="secondary" data-action="previous" ${state.page <= 1 ? 'disabled' : ''}>Previous</button><button class="secondary" data-action="next" ${state.page >= data.pagination.totalPages ? 'disabled' : ''}>Next</button></div></div></section>`;
}
async function referrals() {
  const d = await request('/referrals');
  const members = [...d.leftTeam.members, ...d.rightTeam.members];
  return `${heading('Referral network', 'Stay connected with your left and right teams.')}<div class="stats-grid">${stat('Total members', d.leftTeam.totalCount + d.rightTeam.totalCount, 'users')}${stat('Active members', d.leftTeam.activeCount + d.rightTeam.activeCount, 'users')}${stat('Left team PV', d.leftTeam.pv, 'tree')}${stat('Right team PV', d.rightTeam.pv, 'tree')}</div><section class="panel"><div class="panel-heading"><div><h2>Your referral links</h2><p>Copy a link to invite someone to the relevant team.</p></div></div>${referralCards(d.referralLinks)}</section><section class="panel"><div class="panel-heading"><h2>Team members</h2><a class="text-link" href="#tree">View binary tree ${icon('arrow')}</a></div><label class="search-label">Search members<input id="member-search" placeholder="Search by name or username" type="search"></label><div id="members-table">${memberTable(members)}</div></section>`;
}
let referralMembers = [];
function memberTable(members) {
  referralMembers = members;
  return table(['Member','Team','Level','PV','Status'], members.map(m => [`<strong>${e(m.name || m.username)}</strong><small class="block muted">@${e(m.username)}</small>`, e(m.side), e(m.level), e(m.pv), statusBadge(m.status)]), 'No team members to display.');
}
function treeNode(node, depth = 0) {
  if (depth > 10) return '<li><span class="tree-node">More levels…</span></li>';
  return `<li><div class="tree-node"><span class="avatar">${e((node.name || node.username).charAt(0))}</span><strong>${e(node.name || node.username)}</strong><small>@${e(node.username)}</small>${statusBadge(node.status)}${node.pv ? `<small>${e(node.pv)} PV</small>` : ''}</div>${node.children?.length ? `<ul>${node.children.map(child => treeNode(child, depth + 1)).join('')}</ul>` : ''}</li>`;
}
let currentTree = null;
async function tree() {
  currentTree = await request('/tree');
  return renderReferenceTree(currentTree, { focusId: state.treeFocus, query: state.treeQuery, zoom: state.treeZoom });
}
async function profile() {
  const d = await request('/profile');
  return `${heading('My profile', 'Manage your details and view your membership information.')}<div class="profile-grid"><section class="panel"><h2>Personal details</h2><p class="muted">Keep your contact information up to date.</p><form id="profile-form">${[['fullName','Full name','name'],['phone','Phone number','tel'],['location','Location','address-level2']].map(([key,label,autocomplete]) => `<label>${label}<input name="${key}" maxlength="${key === 'phone' ? 30 : 100}" autocomplete="${autocomplete}" value="${e(d.editable[key] || '')}"></label>`).join('')}<p class="form-error" role="alert"></p><button class="primary" type="submit" ${state.local ? 'disabled' : ''}>Save changes ${icon('check')}</button></form></section><section class="panel"><h2>Membership information</h2><p class="muted">Account and membership records.</p><dl class="profile-details">${[['Username',d.synced.username],['Email',d.synced.email],['Rank',d.synced.rank || 'Member'],['Sponsor',d.synced.sponsorUsername || '—'],['Member since',date(d.synced.memberSince)],['Account status',d.metadata.status]].map(([label,value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl><p class="helper">Contact your account administrator to update membership records.</p></section><section class="panel"><h2>Account security</h2>${state.demo || state.local ? '<p class="muted">Password changes for imported accounts must be made on the original FXUNIFI website.</p>' : '<p class="muted">Changing your password signs out all sessions.</p><form id="password-form"><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" maxlength="72" required></label><label>New password<input name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><p class="form-error" role="alert"></p><button class="primary" type="submit">Change password</button></form>'}</section></div>`;
}
async function sync() {
  const d = await request('/sync/status');
  return renderSyncPage(d,{heading,stat,statusBadge,icon,local:state.local});
}

async function admin() {
  const summary = await request('/admin/dashboard');
  const tabs = ['users','transactions','sync-jobs','audit-logs'];
  const data = await request('/admin/' + state.adminTab + '?' + new URLSearchParams({ page: state.page, limit: 20, ...(state.search ? { search: state.search } : {}) }));
  let rows, headers;
  if (state.adminTab === 'users') { headers = ['Username','Email','Role','Status','Manage']; rows = data.users.map(u => [e(u.username), e(u.email), e(u.role), statusBadge(u.status), `<select data-user-status="${e(u.id)}" aria-label="Status for ${e(u.username)}" ${u.id === state.user.id ? 'disabled' : ''}>${['ACTIVE','INACTIVE','SUSPENDED'].map(s => `<option ${u.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`]); }
  if (state.adminTab === 'transactions') { headers = ['Member','Type','Amount','Status','Date']; rows = data.transactions.map(t => [e(t.user.username), e(t.type), e(money(t.amount)), statusBadge(t.status), e(date(t.createdAt))]); }
  if (state.adminTab === 'sync-jobs') { headers = ['Member','Provider','Status','Date','Action']; rows = data.syncRuns.map(r => [e(r.user.username), e(r.provider), statusBadge(r.status), e(date(r.startedAt)), r.status === 'FAILED' ? `<button class="secondary" data-retry="${e(r.id)}">Retry</button>` : '—']); }
  if (state.adminTab === 'audit-logs') { headers = ['Member','Action','Date','IP address']; rows = data.logs.map(l => [e(l.user.username), e(l.action), e(date(l.createdAt)), e(l.ipAddress || '—')]); }
  return `${heading('Administration', 'Monitor member accounts and account activity.')}<div class="stats-grid">${stat('Total users', summary.totalUsers,'users')}${stat('Active users',summary.activeUsers,'users')}${stat('Pending withdrawals',summary.pendingWithdrawals,'wallet')}${stat('Failed sync jobs',summary.failedSyncJobs,'sync')}</div><section class="panel"><div class="tabs">${tabs.map(t => `<button data-admin-tab="${t}" class="${state.adminTab === t ? 'selected' : ''}">${e(t.replaceAll('-',' '))}</button>`).join('')}</div>${state.adminTab === 'users' ? `<form id="admin-search" class="search-form"><label>Search users<input name="search" type="search" value="${e(state.search)}" placeholder="Name, username or email"></label><button class="secondary">Search</button></form>` : ''}${table(headers, rows)}<div class="pagination"><span>Page ${data.pagination.totalPages ? state.page : 0} of ${data.pagination.totalPages}</span><div><button class="secondary" data-action="previous" ${state.page <= 1 ? 'disabled' : ''}>Previous</button><button class="secondary" data-action="next" ${state.page >= data.pagination.totalPages ? 'disabled' : ''}>Next</button></div></div></section>`;
}

const pages = { dashboard, wallet, transactions, referrals, tree, profile, sync, admin };
async function navigate() {
  if (!state.user) return;
  const route = location.hash.slice(1) || 'dashboard';
  const allowed = route in pages && (route !== 'admin' || state.user.role === 'ADMIN');
  const next = allowed ? route : 'dashboard';
  if (state.route !== next) { state.page = 1; state.type = ''; state.status = ''; }
  state.route = next;
  const version = ++state.version;
  if (!document.querySelector('#content')) shell();
  document.querySelector('.workspace').classList.toggle('tree-workspace', next === 'tree');
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('.menu-button').setAttribute('aria-expanded','false');
  document.querySelectorAll('[data-route]').forEach(a => { a.classList.toggle('active', a.dataset.route === next); if (a.dataset.route === next) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.querySelector('#breadcrumb').textContent = next === 'admin' ? 'Administration' : nav.find(n => n[0] === next)[1];
  const content = document.querySelector('#content');
  content.setAttribute('aria-busy','true');
  content.innerHTML = '<div class="loading" role="status"><span class="spinner"></span>Loading your workspace…</div>';
  try { const html = await pages[next](); if (version !== state.version) return; content.innerHTML = html; }
  catch (error) { if (version !== state.version) return; content.innerHTML = heading('Unable to load this page', 'Your data could not be loaded.') + errorHtml(error); }
  if (version === state.version) content.removeAttribute('aria-busy');
}
app.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'demo') { state.local = false; sessionStorage.removeItem('tradevault-local'); state.demo = true; sessionStorage.setItem('tradevault-demo','1'); demoRequest = createDemo(); state.user = (await request('/auth/me')).user; shell(); location.hash = 'dashboard'; await navigate(); }
  if (button.dataset.treeNode) { state.treeFocus = button.dataset.treeNode; state.treeQuery = ''; await navigate(); }
  if (action === 'tree-reset') { state.treeFocus = ''; state.treeQuery = ''; await navigate(); }
  if (action === 'tree-left' || action === 'tree-right') { if (currentTree) state.treeFocus = extremeTreeNode(currentTree.root, action === 'tree-left' ? 'left' : 'right').id; state.treeQuery = ''; await navigate(); }
  if (action?.startsWith('tree-zoom-')) { state.treeZoom = action === 'tree-zoom-in' ? 'large' : action === 'tree-zoom-out' ? 'small' : 'normal'; await navigate(); }
  if (action === 'register' || action === 'login') showLogin(action === 'register');
  if (action === 'logout') { button.disabled = true; try { if (!state.demo) await request('/auth/logout', { method: 'POST', body: {} }); } catch (error) { toast(error.message); button.disabled = false; return; } api.setToken(null); state.user = null; state.demo = false; state.local = false; sessionStorage.removeItem('tradevault-local'); sessionStorage.removeItem('tradevault-demo'); location.hash = 'login'; showLogin(); }
  if (action === 'menu') { const open = document.querySelector('#sidebar').classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); }
  if (action === 'reload') await navigate();
  if (action === 'previous' || action === 'next') { state.page += action === 'next' ? 1 : -1; await navigate(); }
  if (action === 'export') { const text = csv(currentTransactions, [['type','Type'],['amount','Amount'],['status','Status'],['reference','Reference'],['createdAt','Date']].map(([key,label]) => ({ key,label }))); const url = URL.createObjectURL(new Blob([text], { type:'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `tradevault-transactions-page-${state.page}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Current page exported.'); }
  if (button.dataset.copy) { try { await navigator.clipboard.writeText(button.dataset.copy); toast('Referral link copied.'); } catch { toast('Select and copy the link from the field.'); } }
  if (button.dataset.adminTab) { state.adminTab = button.dataset.adminTab; state.page = 1; await navigate(); }
  if (button.dataset.retry) { button.disabled = true; try { await request('/admin/sync-jobs/' + button.dataset.retry + '/retry', { method:'POST', body:{} }); toast('Sync queued for retry.'); await navigate(); } catch (error) { toast(error.message); button.disabled = false; } }
  if (action === 'sync') {
    button.disabled = true;
    try { const d = await request('/sync/fxunifi', { method:'POST', body:{} }); toast(d.message); await navigate(); if (state.local) void pollLocalSync(); }
    catch (error) { toast(error.message); button.disabled = false; }
  }
});
app.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('button[type="submit"]') || form.querySelector('button');
  const errorEl = form.querySelector('.form-error');
  if (errorEl) errorEl.textContent = '';
  button.disabled = true;
  const body = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'tree-search') { state.treeQuery = body.query; await navigate(); }
    if (form.id === 'auth-form') {
      if (form.dataset.register === 'true') {
        const params = new URLSearchParams(location.search);
        if (params.get('ref')) { body.referralUsername = params.get('ref'); body.side = params.get('side') || 'left'; }
      }
      const localLogin = state.hosted || event.submitter?.dataset.localLogin === 'true';
      const data = await api.request(localLogin ? '/local/auth/login' : form.dataset.register === 'true' ? '/auth/register' : '/auth/login', { method:'POST', body });
      api.setToken(data.accessToken); state.demo = false; state.local = localLogin;
      sessionStorage.removeItem('tradevault-demo');
      if (localLogin) sessionStorage.setItem('tradevault-local','1'); else sessionStorage.removeItem('tradevault-local');
      state.user = data.user; shell(); location.hash = 'dashboard'; await navigate(); if (state.local) void pollLocalSync();
    }
    if (form.id === 'profile-form') { await request('/profile', { method:'PUT', body }); Object.assign(state.user, body); shell(); await navigate(); toast(state.demo ? 'Demo profile updated for this session.' : 'Profile saved.'); }
    if (form.id === 'password-form') {
      if (body.newPassword !== body.confirmPassword) throw new Error('New passwords do not match.');
      if (new TextEncoder().encode(body.newPassword).length > 72) throw new Error('Password must be at most 72 UTF-8 bytes.');
      const data = await request('/auth/password', { method:'POST', body:{ currentPassword:body.currentPassword, newPassword:body.newPassword } });
      api.setToken(null); state.user = null; state.demo = false;
      sessionStorage.removeItem('tradevault-demo'); location.hash = 'login'; showLogin(); toast(data.message);
    }
    if (form.id === 'admin-search') { state.search = body.search; state.page = 1; await navigate(); }
  } catch (error) { if (errorEl) errorEl.textContent = error.message; else toast(error.message); }
  finally { button.disabled = false; }
});
app.addEventListener('change', async event => {
  if (event.target.id === 'tx-type' || event.target.id === 'tx-status') { state[event.target.id === 'tx-type' ? 'type' : 'status'] = event.target.value; state.page = 1; await navigate(); }
  if (event.target.dataset.userStatus) { const el = event.target; el.disabled = true; try { await request('/admin/users/' + el.dataset.userStatus + '/status', { method:'PATCH', body:{ status:el.value } }); toast('Member status updated.'); await navigate(); } catch (error) { toast(error.message); await navigate(); } }
});
app.addEventListener('input', event => {
  if (event.target.id === 'member-search') { const q = event.target.value.toLowerCase(); const list = referralMembers; document.querySelector('#members-table').innerHTML = table(['Member','Team','Level','PV','Status'], list.filter(m => `${m.name || ''} ${m.username}`.toLowerCase().includes(q)).map(m => [`<strong>${e(m.name || m.username)}</strong><small class="block muted">@${e(m.username)}</small>`, e(m.side), e(m.level), e(m.pv), statusBadge(m.status)]), 'No members match your search.'); }
});
window.addEventListener('hashchange', () => { if (state.user) void navigate(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.querySelector('#sidebar')?.classList.remove('open'); document.querySelector('.menu-button')?.setAttribute('aria-expanded', 'false'); } });

async function boot() {
  if (sessionStorage.getItem('tradevault-demo')) { state.demo = true; demoRequest = createDemo(); state.user = (await request('/auth/me')).user; shell(); await navigate(); return; }
  app.innerHTML = '<div class="loading fullscreen" role="status"><span class="spinner"></span>Opening TradeVault…</div>';
  try { state.local = state.hosted || sessionStorage.getItem('tradevault-local') === '1'; const refreshed = await api.request(state.local ? '/local/auth/refresh' : '/auth/refresh', { method:'POST', body:{}, retry:false }); api.setToken(refreshed.accessToken); state.user = (await request('/auth/me')).user; shell(); await navigate(); if (state.local) void pollLocalSync(); }
  catch { showLogin(location.hash === '#register' || new URLSearchParams(location.search).has('ref')); }
}
void boot();
