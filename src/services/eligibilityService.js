const Loan = require('../models/Loan');
const { RULES } = require('../utils/loanMath');
const { limitForScore } = require('../utils/creditScore');
const { ageFromDob } = require('../utils/date');
const { PURPOSES } = require('../utils/constants');

const MIN_AGE = 21;
const MAX_AGE = 60;

/**
 * Basic eligibility (documented in README):
 *   profile complete -> age 21-60 -> credit score >= 600 -> no other active loan.
 * The loan limit comes from the credit score.
 * Response: { eligible, minAmount, maxAmount, reason?: CODE, message?: text, activeLoanId?, ...rules }
 */
async function evaluate(user) {
  const base = { ...RULES, purposes: PURPOSES, creditScore: user.creditScore ?? null };
  const no = (reason, message, extra = {}) => ({ eligible: false, maxAmount: 0, ...base, reason, message, ...extra });

  if (!user.profileComplete) return no('PROFILE_INCOMPLETE', 'Complete your profile to apply for a loan.');

  const age = ageFromDob(user.dob);
  if (age < MIN_AGE || age > MAX_AGE) {
    return no('AGE_NOT_ELIGIBLE', `Loans are available for applicants aged ${MIN_AGE} to ${MAX_AGE}.`);
  }

  const limit = limitForScore(user.creditScore ?? 0);
  if (limit === 0) return no('SCORE_TOO_LOW', 'Your credit score is below our minimum requirement of 600.');

  const active = await Loan.findOne({ userId: user._id, isActive: true }).select('_id');
  if (active) {
    return no('ACTIVE_LOAN_EXISTS', 'You already have an active loan application.', { activeLoanId: active.id });
  }

  return { eligible: true, maxAmount: limit, ...base };
}

module.exports = { evaluate, MIN_AGE, MAX_AGE };
