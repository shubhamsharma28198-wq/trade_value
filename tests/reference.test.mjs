import test from 'node:test';
import assert from 'node:assert/strict';
import { bonusTotals, bonusChart, earningMeter } from '../apps/web/public/reference-dashboard.js';

test('bonus chart uses completed earnings and omits pending deposits or withdrawals', () => {
  const rows = [{ type:'EARNINGS', status:'COMPLETED', amount:'USD 100.00' }, { type:'COMMISSION', status:'COMPLETED', amount:50 }, { type:'BONUS', status:'PENDING', amount:900 }, { type:'DEPOSIT', status:'COMPLETED', amount:500 }];
  assert.deepEqual(bonusTotals(rows), { EARNINGS:100, COMMISSION:50, BONUS:0 });
  assert.match(bonusChart(rows), /66.7%/);
  assert.match(bonusChart(rows), /33.3%/);
  assert.doesNotMatch(bonusChart(rows), /NaN/);
});
test('earning meter handles zero investment and caps the needle while preserving actual ratios', () => {
  assert.match(earningMeter({ totalInvested:0, totalEarned:100 }), /Add recorded investment/);
  const output = earningMeter({ totalInvested:200, totalEarned:500 });
  assert.match(output, /250.00%/);
  assert.match(output, /rotate\(135 130 107\)/);
  assert.doesNotMatch(output, /Infinity|NaN/);
});
