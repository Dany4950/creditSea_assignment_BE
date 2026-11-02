const test = require('node:test');
const assert = require('node:assert/strict');
const { NEXT, STATUS_LABEL, APPROVABLE, REJECTABLE, DISBURSABLE } = require('../src/utils/loanStatus');

test('automatic flow after accept', () => {
  const chain = ['SUBMITTED'];
  while (NEXT[chain.at(-1)]) chain.push(NEXT[chain.at(-1)]);
  assert.deepEqual(chain, ['SUBMITTED', 'UNDER_REVIEW']); // review then needs a decision
  const approved = ['KYC'];
  while (NEXT[approved.at(-1)]) approved.push(NEXT[approved.at(-1)]);
  assert.deepEqual(approved, ['KYC', 'NACH', 'SIGN', 'DISBURSING', 'DISBURSED']);
});

test("labels follow the assignment's chain", () => {
  assert.equal(STATUS_LABEL.SUBMITTED, 'Submitted');
  assert.equal(STATUS_LABEL.UNDER_REVIEW, 'Under Review');
  for (const s of ['KYC', 'NACH', 'SIGN', 'DISBURSING']) assert.equal(STATUS_LABEL[s], 'Approved');
  assert.equal(STATUS_LABEL.REJECTED, 'Rejected');
  assert.equal(STATUS_LABEL.DISBURSED, 'Disbursed');
});

test('admin transition sets', () => {
  assert.ok(APPROVABLE.includes('UNDER_REVIEW') && !APPROVABLE.includes('KYC'));
  assert.ok(REJECTABLE.includes('SIGN') && !REJECTABLE.includes('DISBURSED') && !REJECTABLE.includes('OFFERED'));
  assert.ok(DISBURSABLE.includes('DISBURSING') && !DISBURSABLE.includes('SUBMITTED'));
});

const { REPAYABLE } = require('../src/utils/loanStatus');
test('repayment', () => {
  assert.equal(STATUS_LABEL.REPAID, 'Repaid');
  assert.deepEqual(REPAYABLE, ['DISBURSED']);
});
