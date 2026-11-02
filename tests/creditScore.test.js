const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreFromPan, limitForScore, maskPan, PAN_REGEX } = require('../src/utils/creditScore');

test('mock bureau is deterministic', () => {
  assert.equal(scoreFromPan('ABCDE1234F'), 800);
  assert.equal(scoreFromPan('ABCDE1230F'), 600);
  assert.equal(scoreFromPan('ABCDE1231F'), 650);
  assert.equal(scoreFromPan('ABCDE0123F'), 580);
});

test('limit by score', () => {
  assert.equal(limitForScore(580), 0);
  assert.equal(limitForScore(600), 25000);
  assert.equal(limitForScore(649), 25000);
  assert.equal(limitForScore(650), 50000);
  assert.equal(limitForScore(700), 75000);
  assert.equal(limitForScore(750), 100000);
});

test('PAN regex + mask', () => {
  assert.ok(PAN_REGEX.test('ABCDE1234F'));
  assert.ok(!PAN_REGEX.test('abcde1234f'));
  assert.ok(!PAN_REGEX.test('ABCD1234EF'));
  assert.equal(maskPan('ABCDE1234F'), 'ABCDE****F');
});

const { applyRepayment } = require('../src/utils/creditScore');

test('on-time repayment raises the score by 50, capped at 900', () => {
  assert.deepEqual(applyRepayment(600, true), { score: 650, change: 50 });
  assert.deepEqual(applyRepayment(880, true), { score: 900, change: 20 });
  assert.deepEqual(applyRepayment(900, true), { score: 900, change: 0 });
});

test('late repayment lowers the score by 30, floored at 300', () => {
  assert.deepEqual(applyRepayment(600, false), { score: 570, change: -30 });
  assert.deepEqual(applyRepayment(310, false), { score: 300, change: -10 });
});

test('a good repayment can unlock a higher limit', () => {
  const { limitForScore } = require('../src/utils/creditScore');
  assert.equal(limitForScore(600), 25000);
  assert.equal(limitForScore(applyRepayment(600, true).score), 50000);
  assert.equal(limitForScore(applyRepayment(600, false).score), 0); // 570 is below the minimum
});
