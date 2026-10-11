import { escapeHtml as e } from './client.js';

export function findTreeNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children || []) { const found = findTreeNode(child, id); if (found) return found; }
  return null;
}
export function extremeTreeNode(root, side) {
  let node = root;
  while (node.children?.length) {
    const child = node.side === 'root' ? node.children.find(child => child.side === side)
      : side === 'left' ? node.children[0] : node.children.at(-1);
    if (!child) break;
    node = child;
  }
  return node;
}
export function searchTree(root, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results = [];
  function visit(node) {
    if (`${node.username} ${node.name || ''}`.toLowerCase().includes(q)) results.push(node);
    for (const child of node.children || []) visit(child);
  }
  visit(root);
  return results.slice(0, 50);
}
const person = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 23c0-15 22-15 22 0v7c0 6-5 11-11 11S21 36 21 30z" fill="#15352d"/><path d="M16 45 26 40l6 5 6-5 10 5c7 3 9 11 10 19H6c1-8 3-16 10-19" fill="#11412d"/><path d="m26 40 6 5 6-5-2 24h-8z" fill="#f1f6ee"/><path d="m30 45 2 2 2-2-1 6 2 13h-6l2-13z" fill="#26392e"/><path d="m25 42-6 4 6 13-2-11 4 3zm14 0 6 4-6 13 2-11-4 3z" fill="#fff" opacity=".75"/></svg>`;
function avatar(status, root = false) { return `<span class="person-avatar ${root ? 'person-root' : status === 'AVAILABLE' ? 'person-available' : status === 'ACTIVE' ? 'person-active' : 'person-inactive'}">${person}</span>`; }
function member(node, depth, maxDepth, root) {
  const available = node.status === 'AVAILABLE';
  const slot = index => ({ id: `${node.id}-slot-${index}`, name:'Available position', username:'Join Here', status:'AVAILABLE', children:[] });
  let children = node.side === 'root'
    ? ['left', 'right'].map((side, index) => (node.children || []).find(child => child.side === side) || slot(index))
    : (node.children || []).slice(0,2);
  if (depth < maxDepth && !available) {
    children = [...children];
    while (children.length < 2) children.push(slot(children.length));
  }
  return `<li><button class="tree-member" ${available ? 'disabled' : `data-tree-node="${e(node.id)}"`} aria-label="${e(node.username)}: ${e(node.status)}${available ? '' : '. View branch'}">${avatar(node.status, root)}<strong>${e(available ? 'Available' : node.username)}</strong>${!available && node.name && node.name !== node.username ? `<small>${e(node.name)}</small>` : ''}</button>${depth < maxDepth && children.length ? `<ul>${children.map(child => member(child,depth+1,maxDepth,false)).join('')}</ul>` : ''}</li>`;
}
export function renderReferenceTree(data, { focusId = '', query = '', zoom = 'normal' } = {}) {
  const root = findTreeNode(data.root, focusId) || data.root;
  const results = searchTree(data.root, query);
  return `<div class="reference-tree-page"><div class="page-heading"><div><p class="eyebrow">AFFILIATES</p><h1>Binary tree</h1><p>Explore your member network and its available positions.</p></div><button class="secondary" data-action="tree-reset">Return to my tree</button></div><section class="panel reference-tree-panel"><div class="tree-toolbar"><form id="tree-search" class="tree-search"><label class="sr-only" for="tree-query">Search a member</label><input id="tree-query" name="query" type="search" value="${e(query)}" maxlength="50" placeholder="Search member name or username"><button type="submit">Search</button></form><div class="tree-legend">${[['AVAILABLE','Available'],['INACTIVE','Inactive'],['ACTIVE','Active']].map(([status,label]) => `<span>${avatar(status)}<small>${label}</small></span>`).join('')}</div></div>${query ? `<div class="tree-search-results" role="status">${results.length ? results.map(node => `<button class="secondary" data-tree-node="${e(node.id)}">${e(node.username)}</button>`).join('') : 'No members match your search.'}</div>` : ''}<div class="tree-scroll reference-tree-scroll" data-zoom="${e(zoom)}"><ul class="binary-tree reference-binary-tree">${member(root,0,3,true)}</ul></div><div class="tree-bottom-bar"><button class="secondary" data-action="tree-left">Extreme Left</button><span>${data.stats.totalMembers} team members · ${data.stats.activeMembers} active${data.truncated ? ' · Showing up to 500 members' : ''}</span><div class="tree-zoom"><button class="secondary" data-action="tree-zoom-out" aria-label="Zoom out">−</button><button class="secondary" data-action="tree-zoom-reset">100%</button><button class="secondary" data-action="tree-zoom-in" aria-label="Zoom in">+</button></div><button class="primary" data-action="tree-right">Extreme Right</button></div></section><p class="helper">Select a member to view their branch. Gray positions are placeholders, not registered members.</p></div>`;
}
