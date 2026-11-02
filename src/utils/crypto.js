const crypto = require('crypto');
const env = require('../config/env');

const key =
  env.panEncKey && env.panEncKey.length === 64
    ? Buffer.from(env.panEncKey, 'hex')
    : crypto.createHash('sha256').update(env.jwtSecret).digest();

/** AES-256-GCM. Output: iv.tag.cipher (base64 parts). */
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function hmac(value) {
  return crypto.createHmac('sha256', env.jwtSecret).update(value).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { encrypt, hmac, safeEqual };
