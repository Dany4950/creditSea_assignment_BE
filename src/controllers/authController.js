const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const otpService = require('../services/otpService');

const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
// Compared against when the mobile is unknown so response time doesn't reveal which numbers exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const accessToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion, typ: 'access' }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

exports.requestOtp = asyncHandler(async (req, res) => {
  const { mobile } = req.body;
  if (await User.exists({ mobile })) {
    throw new AppError(409, 'USER_EXISTS', 'This number is already registered. Please sign in.');
  }
  const otp = await otpService.send(`auth:${mobile}`, 4);
  res.json({ message: 'OTP sent successfully', ...(otp && { otp }) });
});

exports.verifyOtp = asyncHandler(async (req, res) => {
  const { mobile, otp } = req.body;
  await otpService.verify(`auth:${mobile}`, otp, { length: 4 });
  const registrationToken = jwt.sign({ sub: mobile, typ: 'reg' }, env.jwtSecret, { expiresIn: '10m' });
  res.json({ registrationToken });
});

exports.setPassword = asyncHandler(async (req, res) => {
  const { mobile, password, registrationToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(registrationToken, env.jwtSecret);
  } catch {
    throw new AppError(401, 'REGISTRATION_EXPIRED', 'Verification expired. Please verify your number again.');
  }
  if (payload.typ !== 'reg' || payload.sub !== mobile) {
    throw new AppError(401, 'REGISTRATION_EXPIRED', 'Verification expired. Please verify your number again.');
  }
  if (await User.exists({ mobile })) {
    throw new AppError(409, 'USER_EXISTS', 'This number is already registered. Please sign in.');
  }

  await User.create({ mobile, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ message: 'Account created. Please sign in.' });
});

exports.login = asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  const user = await User.findOne({ mobile }).select('+passwordHash');

  if (user?.lockUntil && user.lockUntil > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts. Please try again in 15 minutes.');
  }

  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      const fails = user.failedLogins + 1;
      const update = fails >= MAX_FAILED_LOGINS
        ? { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MS) }
        : { failedLogins: fails };
      await User.updateOne({ _id: user._id }, { $set: update });
    }
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect mobile number or password.');
  }

  await User.updateOne({ _id: user._id }, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } });
  res.json({
    token: accessToken(user),
    user: { id: user.id, mobile: user.mobile, profileComplete: user.profileComplete },
  });
});

/** Invalidates every token issued to this user (all devices). */
exports.logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ message: 'Logged out' });
});
