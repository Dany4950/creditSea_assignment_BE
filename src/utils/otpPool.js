const crypto = require('crypto');

/**
 * OTP pool: a small set of valid codes kept on the server (env OTP_POOL_MOBILE / OTP_POOL_EMAIL).
 * Each OTP request is answered with one of them at random, and any code from the pool is accepted at verification.
 * Pure helpers (no DB / env access) so they are unit-tested.
 */
const DEFAULT_POOLS = Object.freeze({
  4: ['4821', '7350', '1946', '6037', '2584'],
  6: ['482193', '735028', '194657', '603714', '258430'],
});

/** 'a,b,c' -> ['a','b','c'] when every entry has exactly `length` digits, otherwise the built-in default pool. */
function parsePool(raw, length) {
  const items = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const re = new RegExp(`^\\d{${length}}$`);
  return items.length > 0 && items.every((c) => re.test(c)) ? items : [...DEFAULT_POOLS[length]];
}

function pickFromPool(pool, randomInt = crypto.randomInt) {
  return pool[randomInt(pool.length)];
}

/** Constant-time membership test (always compares every code, no early exit). */
function isInPool(pool, code) {
  const given = Buffer.from(String(code));
  let ok = false;
  for (const c of pool) {
    const expected = Buffer.from(c);
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}

module.exports = { DEFAULT_POOLS, parsePool, pickFromPool, isInPool };
