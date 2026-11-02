const { Schema, model } = require('mongoose');

const otpSchema = new Schema({
  key: { type: String, required: true, unique: true }, // e.g. auth:9876543210 | email:<userId>:<email>
  otpHash: { type: String, required: true }, // HMAC, never the OTP itself
  otpExpiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  windowStartedAt: { type: Date, required: true },
  windowCount: { type: Number, default: 1 },
  docExpiresAt: { type: Date, required: true }, // TTL cleanup
});

otpSchema.index({ docExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model('Otp', otpSchema);
