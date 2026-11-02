const AppError = require('../utils/AppError');

/** validate(zodSchema, 'body' | 'query') -> replaces req[source] with the parsed, sanitised data. */
module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const errors = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_';
      if (!errors[field]) errors[field] = issue.message;
    }
    return next(new AppError(422, 'VALIDATION_ERROR', Object.values(errors)[0], { errors }));
  }
  req[source] = result.data;
  next();
};
