const env = require('../config/env');

let transporter;
const enabled = () => Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer'); // loaded lazily so the app runs without SMTP
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

async function sendOtp(to, otp) {
  await getTransporter().sendMail({
    from: env.smtp.from,
    to,
    subject: 'Your CreditSea verification code',
    text: `Your CreditSea verification code is ${otp}. It expires in 5 minutes. Never share this code with anyone.`,
  });
}

module.exports = { enabled, sendOtp };
