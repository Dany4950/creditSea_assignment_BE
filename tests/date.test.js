const test = require('node:test');
const assert = require('node:assert/strict');
const { ageFromDob, parseIsoDate } = require('../src/utils/date');

test('age calculation around the birthday', () => {
  const dob = new Date('2000-06-15T00:00:00Z');
  assert.equal(ageFromDob(dob, new Date('2026-06-14T00:00:00Z')), 25);
  assert.equal(ageFromDob(dob, new Date('2026-06-15T00:00:00Z')), 26);
});

test('parseIsoDate rejects impossible dates', () => {
  assert.ok(parseIsoDate('1995-06-15'));
  assert.equal(parseIsoDate('1995-02-31'), null);
  assert.equal(parseIsoDate('15-06-1995'), null);
});
