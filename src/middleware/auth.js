const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.');

module.exports = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized();
  }
  if (payload.typ !== 'access') throw unauthorized();

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) throw unauthorized();

  req.user = user;
  next();
});
