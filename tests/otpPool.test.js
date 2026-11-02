const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePool, pickFromPool, isInPool, DEFAULT_POOLS } = require('../src/utils/otpPool');

test('parsePool accepts a valid list and trims spaces', () => {
  assert.deepEqual(parsePool('1111, 2222,3333', 4), ['1111', '2222', '3333']);
});

test('parsePool falls back to the defaults when anything is wrong', () => {
  assert.deepEqual(parsePool('', 4), DEFAULT_POOLS[4]);
  assert.deepEqual(parsePool(undefined, 6), DEFAULT_POOLS[6]);
  assert.deepEqual(parsePool('1111,22', 4), DEFAULT_POOLS[4]); // wrong length
  assert.deepEqual(parsePool('abcd,1234', 4), DEFAULT_POOLS[4]); // not digits
});

test('defaults: 5 codes each, right length, all distinct', () => {
  for (const len of [4, 6]) {
    const p = DEFAULT_POOLS[len];
    assert.equal(p.length, 5);
    assert.equal(new Set(p).size, 5);
    assert.ok(p.every((c) => c.length === len));
  }
});

test('pickFromPool returns members of the pool', () => {
  const pool = DEFAULT_POOLS[4];
  assert.equal(pickFromPool(pool, () => 0), pool[0]);
  assert.equal(pickFromPool(pool, () => 4), pool[4]);
  for (let i = 0; i < 50; i += 1) assert.ok(pool.includes(pickFromPool(pool)));
});

test('isInPool accepts any code of the pool and nothing else', () => {
  const pool = DEFAULT_POOLS[4];
  for (const c of pool) assert.ok(isInPool(pool, c));
  assert.ok(!isInPool(pool, '0000'));
  assert.ok(!isInPool(pool, '48210')); // longer
  assert.ok(!isInPool(pool, ''));
});
