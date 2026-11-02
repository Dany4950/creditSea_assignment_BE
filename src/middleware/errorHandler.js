const AppError = require('../utils/AppError');

const notFound = (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'Route not found'));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...err.extra });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body', code: 'INVALID_JSON' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'This record already exists', code: 'DUPLICATE' });
  }
  console.error(err); // no request bodies are logged (PII safe)
  return res
    .status(500)
    .json({ message: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' });
};

module.exports = { notFound, errorHandler };
