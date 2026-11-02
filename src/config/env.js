require('dotenv').config();
const { parsePool } = require('../utils/otpPool');

for (const key of ['MONGODB_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key} (see .env.example)`);
    process.exit(1);
  }
}

const bool = (v, fallback = false) => (v === undefined ? fallback : String(v).toLowerCase() === 'true');

module.exports = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  otpPools: {
    4: parsePool(process.env.OTP_POOL_MOBILE, 4), // mobile signup codes
    6: parsePool(process.env.OTP_POOL_EMAIL, 6), // email verification codes
  },
  demoMode: bool(process.env.DEMO_MODE, false),
  adminKey: process.env.ADMIN_KEY || '',
  stepDelaySeconds: Number(process.env.STEP_DELAY_SECONDS) || 8,
  demoRejectAmount: Number(process.env.DEMO_REJECT_AMOUNT ?? 5000), // DEMO_MODE only; 0 disables
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'CreditSea <no-reply@creditsea.app>',
  },
  panEncKey: process.env.PAN_ENC_KEY || '',
});
