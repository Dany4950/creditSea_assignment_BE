const { z } = require('zod');
const { GENDERS, MARITAL_STATUSES, REPAYMENT_METHODS } = require('../utils/constants');
const { PAN_REGEX } = require('../utils/creditScore');
const { parseIsoDate } = require('../utils/date');

const mobile = z
  .string({ required_error: 'Mobile number is required' })
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const otp4 = z.string().regex(/^\d{4}$/, 'OTP must be 4 digits');
const otp6 = z.string().regex(/^\d{6}$/, 'OTP must be 6 digits');
const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password is too long')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least 1 special character');
const name = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z .'-]{1,29}$/, 'Enter a valid name (2-30 letters)');
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(100)
  .regex(/^[\w.+\-]+@[\w\-]+(\.[\w\-]+)+$/, 'Enter a valid email address');
const pan = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PAN_REGEX, 'Enter a valid PAN (e.g. ABCDE1234F)');
const dob = z.string().refine((v) => parseIsoDate(v) !== null, 'Date of birth must be yyyy-MM-dd');

const loanBase = {
  amount: z.number({ invalid_type_error: 'Amount must be a number' }).int('Amount must be a whole number'),
  days: z.number({ invalid_type_error: 'Tenure must be a number' }).int('Tenure must be whole days'),
};

module.exports = {
  requestOtp: z.object({ mobile }),
  verifyOtp: z.object({ mobile, otp: otp4 }),
  setPassword: z.object({ mobile, password, registrationToken: z.string().min(10) }),
  login: z.object({ mobile, password: z.string().min(1, 'Password is required') }),

  personal: z.object({
    firstName: name,
    lastName: name,
    gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Select a valid gender' }) }),
    dob,
    maritalStatus: z.enum(MARITAL_STATUSES, { errorMap: () => ({ message: 'Select a valid marital status' }) }),
  }),
  updateProfile: z
    .object({ firstName: name.optional(), lastName: name.optional(), maritalStatus: z.enum(MARITAL_STATUSES).optional() })
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update'),
  emailSend: z.object({ email }),
  emailVerify: z.object({ email, otp: otp6 }),
  panVerify: z.object({ pan }),

  quote: z.object(loanBase),
  apply: z.object({
    ...loanBase,
    purpose: z.string().trim().min(2, 'Select the purpose of the loan').max(50),
  }),
  repay: z.object({ method: z.enum(REPAYMENT_METHODS, { errorMap: () => ({ message: 'Select a valid payment method' }) }).default('UPI') }),
  listLoans: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
  adminAction: z.object({
    action: z.enum(['approve', 'reject', 'disburse', 'overdue']),
    reason: z.string().trim().max(200).optional(),
  }),
};
