import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReferenceTree, extremeTreeNode } from '../apps/web/public/reference-tree.js';

test('a right-only team retains an empty left position and correct extreme navigation', () => {
  const right = { id:'right-member', username:'right_user', side:'right', status:'ACTIVE', children:[] };
  const root = { id:'owner', username:'owner', side:'root', status:'ACTIVE', children:[right] };
  const html = renderReferenceTree({ root, stats:{ totalMembers:1, activeMembers:1 } });
  assert.ok(html.indexOf('Available position') < html.indexOf('right_user'));
  assert.equal(extremeTreeNode(root, 'left'), root);
  assert.equal(extremeTreeNode(root, 'right'), right);
});

test('tree root displays teams in left/right order regardless of record order', () => {
  const root = { id:'owner', username:'owner', side:'root', status:'ACTIVE', children:
    ['right','left'].map(side => ({ id:side, username:side + '_user', side, status:'ACTIVE', children:[] })) };
  const html = renderReferenceTree({ root, stats:{ totalMembers:2, activeMembers:2 } });
  assert.ok(html.indexOf('left_user') < html.indexOf('right_user'));
});
