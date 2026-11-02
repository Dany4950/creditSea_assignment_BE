/** Operational error that the error handler turns into { message, code, ...extra }. */
class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

module.exports = AppError;
