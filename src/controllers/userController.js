const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

exports.getProfile = asyncHandler(async (req, res) => {
  res.json(req.user.toProfile());
});

/** Editable after onboarding: name + marital status. DOB, gender, PAN are locked; email changes need an OTP. */
exports.updateProfile = asyncHandler(async (req, res) => {
  if (!req.user.hasPersonal()) {
    throw new AppError(409, 'PROFILE_INCOMPLETE', 'Complete your personal details first.');
  }
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json(req.user.toProfile());
});
