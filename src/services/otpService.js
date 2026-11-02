const crypto = require('crypto');
const env = require('../config/env');
const Otp = require('../models/Otp');
const AppError = require('../utils/AppError');
const { hmac, safeEqual } = require('../utils/crypto');
const { pickFromPool, isInPool } = require('../utils/otpPool');
const mailer = require('./mailer');

const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 30 * 1000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const MAX_ATTEMPTS = 5;

/** Pool mode = DEMO_MODE and no real delivery provider for this channel. */
function poolFor(length, channel) {
  const realEmail = channel === 'email' && mailer.enabled();
  return env.demoMode && !realEmail ? env.otpPools[length] || null : null;
}

/**
 * Creates + delivers an OTP (always stored hashed, expiring, cooldown + attempt limited).
 *  - email + SMTP configured -> a REAL random code is emailed and never returned in the response
 *  - DEMO_MODE (no provider)  -> one random code from the server's OTP pool, returned in the response so the app can show it
 *  - otherwise                -> random code; plug an SMS provider into the delivery block
 */
async function send(key, length, { channel = 'sms', to } = {}) {
  const now = new Date();
  const existing = await Otp.findOne({ key });

  if (existing) {
    const sinceLast = now - existing.lastSentAt;
    if (sinceLast < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - sinceLast) / 1000);
      throw new AppError(429, 'RESEND_COOLDOWN', `Please wait ${retryAfter}s before requesting another OTP`, { retryAfter });
    }
    if (now - existing.windowStartedAt < WINDOW_MS && existing.windowCount >= MAX_PER_WINDOW) {
      throw new AppError(429, 'OTP_LIMIT', 'Too many OTP requests. Please try again in a few minutes.');
    }
  }

  const windowFresh = existing && now - existing.windowStartedAt < WINDOW_MS;
  const windowStartedAt = windowFresh ? existing.windowStartedAt : now;
  const otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const realEmail = channel === 'email' && mailer.enabled();
  const pool = poolFor(length, channel);
  const otp = pool ? pickFromPool(pool) : String(crypto.randomInt(0, 10 ** length)).padStart(length, '0');

  await Otp.findOneAndUpdate(
    { key },
    {
      otpHash: hmac(`${key}:${otp}`),
      otpExpiresAt,
      attempts: 0,
      lastSentAt: now,
      windowStartedAt,
      windowCount: windowFresh ? existing.windowCount + 1 : 1,
      docExpiresAt: new Date(Math.max(windowStartedAt.getTime() + WINDOW_MS, otpExpiresAt.getTime())),
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  // ---- delivery ----
  if (realEmail) {
    try {
      await mailer.sendOtp(to, otp);
    } catch (err) {
      console.error('[otp] email delivery failed:', err.message);
      throw new AppError(502, 'EMAIL_DELIVERY_FAILED', 'Could not send the verification email. Please try again.');
    }
  } else if (!pool) {
    console.warn('[otp] No SMS provider configured. Plug one in src/services/otpService.js');
  }
  return pool ? otp : undefined;
}

/**
 * Throws AppError on failure; on success the OTP is consumed (single use).
 * In pool mode ANY code from the pool is accepted (as long as an unexpired request exists for this key).
 */
async function verify(key, otp, { length, channel = 'sms' } = {}) {
  const doc = await Otp.findOne({ key });
  if (!doc || doc.otpExpiresAt < new Date()) {
    throw new AppError(400, 'OTP_EXPIRED', 'OTP expired. Please request a new one.');
  }
  if (doc.attempts >= MAX_ATTEMPTS) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please request a new OTP.');
  }
  const pool = poolFor(length || otp.length, channel);
  const valid = pool ? isInPool(pool, otp) : safeEqual(doc.otpHash, hmac(`${key}:${otp}`));
  if (!valid) {
    await Otp.updateOne({ _id: doc._id }, { $inc: { attempts: 1 } });
    throw new AppError(400, 'INVALID_OTP', 'Incorrect OTP. Please try again.');
  }
  await Otp.updateOne({ _id: doc._id }, { $set: { otpExpiresAt: new Date(0) } }); // consume
}

module.exports = { send, verify };
