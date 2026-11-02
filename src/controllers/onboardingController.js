const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const otpService = require('../services/otpService');
const { encrypt } = require('../utils/crypto');
const { ageFromDob, parseIsoDate, toIsoDate } = require('../utils/date');
const { scoreFromPan, maskPan } = require('../utils/creditScore');

const MIN_REGISTRATION_AGE = 18; // loan age window (21-60) is enforced at eligibility, not registration

exports.getPersonal = asyncHandler(async (req, res) => {
  const u = req.user;
  res.json({
    personal: u.hasPersonal()
      ? { firstName: u.firstName, lastName: u.lastName, gender: u.gender, dob: toIsoDate(u.dob), maritalStatus: u.maritalStatus }
      : null,
  });
});

exports.putPersonal = asyncHandler(async (req, res) => {
  const { firstName, lastName, gender, dob, maritalStatus } = req.body;
  const dobDate = parseIsoDate(dob);

  if (ageFromDob(dobDate) < MIN_REGISTRATION_AGE) {
    throw new AppError(422, 'AGE_TOO_YOUNG', 'You must be at least 18 years old to register.');
  }
  const u = req.user;
  if (u.profileComplete && (u.gender !== gender || toIsoDate(u.dob) !== dob)) {
    throw new AppError(409, 'FIELD_LOCKED', 'Date of birth and gender cannot be changed after verification.');
  }

  Object.assign(u, { firstName, lastName, gender, dob: dobDate, maritalStatus });
  await u.save();
  res.json({ message: 'Personal details saved', profileComplete: u.profileComplete });
});

exports.getEmail = asyncHandler(async (req, res) => {
  res.json({ email: req.user.email ?? null, verified: req.user.emailVerified });
});

exports.sendEmailOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const otp = await otpService.send(`email:${req.user.id}:${email}`, 6, { channel: 'email', to: email });
  res.json({ message: 'Verification code sent', ...(otp && { otp }) });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  await otpService.verify(`email:${req.user.id}:${email}`, otp, { length: 6, channel: 'email' });
  req.user.email = email;
  req.user.emailVerified = true;
  await req.user.save();
  res.json({ verified: true, profileComplete: req.user.profileComplete });
});

exports.getPan = asyncHandler(async (req, res) => {
  res.json({ verified: req.user.panVerified, panMasked: req.user.panMasked ?? null });
});

/** Mock PAN verification. AAAAA0000A simulates "PAN not found". The PAN is stored encrypted, never returned. */
exports.verifyPan = asyncHandler(async (req, res) => {
  const { pan } = req.body;
  const u = req.user;

  if (u.panVerified) return res.json({ verified: true, profileComplete: u.profileComplete }); // locked + idempotent
  if (pan === 'AAAAA0000A') throw new AppError(404, 'PAN_NOT_FOUND', 'PAN not found. Please check and try again.');

  u.panEncrypted = encrypt(pan);
  u.panMasked = maskPan(pan);
  u.panVerified = true;
  u.creditScore = scoreFromPan(pan);
  await u.save();
  res.json({ verified: true, profileComplete: u.profileComplete });
});
