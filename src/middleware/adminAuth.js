const env = require('../config/env');
const AppError = require('../utils/AppError');
const { safeEqual } = require('../utils/crypto');

/** Demo back-office guard: send the ADMIN_KEY in the x-admin-key header. */
module.exports = (req, res, next) => {
  if (!env.adminKey) return next(new AppError(404, 'NOT_FOUND', 'Route not found'));
  const provided = req.headers['x-admin-key'];
  if (!provided || !safeEqual(provided, env.adminKey)) {
    return next(new AppError(401, 'ADMIN_UNAUTHORIZED', 'Invalid admin key'));
  }
  next();
};
