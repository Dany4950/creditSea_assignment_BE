const test = require('node:test');
const assert = require('node:assert/strict');
const { quote } = require('../src/utils/loanMath');

test('30,000 for 40 days', () => {
  assert.deepEqual(quote(30000, 40), {
    principal: 30000, days: 40, interest: 12000, processingFee: 3000, totalPayable: 42000, disbursed: 27000,
  });
});

test('minimum loan 5,000 for 20 days', () => {
  const q = quote(5000, 20);
  assert.equal(q.interest, 1000);
  assert.equal(q.processingFee, 500);
  assert.equal(q.totalPayable, 6000);
  assert.equal(q.disbursed, 4500);
});
