const crypto = require('crypto');
const mongoose = require('mongoose');
const env = require('../config/env');
const Loan = require('../models/Loan');
const Counter = require('../models/Counter');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const eligibility = require('./eligibilityService');
const { RULES, quote } = require('../utils/loanMath');
const { limitForScore, applyRepayment } = require('../utils/creditScore');
const { ageFromDob } = require('../utils/date');
const { LOAN_STATUS: S } = require('../utils/constants');
const { NEXT, STATUS_LABEL, APPROVABLE, REJECTABLE, DISBURSABLE, REPAYABLE } = require('../utils/loanStatus');

const DELAY_MS = env.stepDelaySeconds * 1000;
const addMs = (d, ms) => new Date(d.getTime() + ms);
const endOfDueDay = (d) => {
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e;
};
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

/* ------------------------------------------------------------------ */
/* Offer (apply) + accept                                              */
/* ------------------------------------------------------------------ */

/** Validates the request against eligibility + rules and returns the server-side quote. */
async function prepare(user, { amount, days }) {
  const elig = await eligibility.evaluate(user);
  if (!elig.eligible) {
    throw new AppError(
      elig.reason === 'ACTIVE_LOAN_EXISTS' ? 409 : 422,
      elig.reason,
      elig.message,
      elig.activeLoanId ? { activeLoanId: elig.activeLoanId } : {}
    );
  }
  if (amount > elig.maxAmount) {
    throw new AppError(422, 'AMOUNT_ABOVE_LIMIT', `The maximum amount available to you is ${inr(elig.maxAmount)}.`);
  }
  if (amount < RULES.minAmount || amount % RULES.amountStep !== 0) {
    throw new AppError(422, 'INVALID_AMOUNT', `Amount must be at least ${inr(RULES.minAmount)} in steps of ${inr(RULES.amountStep)}.`);
  }
  if (days < RULES.minDays || days > RULES.maxDays) {
    throw new AppError(422, 'INVALID_TENURE', `Tenure must be between ${RULES.minDays} and ${RULES.maxDays} days.`);
  }
  return { elig, quote: quote(amount, days) };
}

async function nextApplicationNo() {
  const c = await Counter.findOneAndUpdate({ name: 'loan' }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `CS${10000 + c.seq}`;
}

/** POST /loans/apply: prices the loan server-side and stores it as OFFERED, replacing any earlier pending offer. */
async function createOffer(user, { amount, days, purpose }) {
  const { quote: q } = await prepare(user, { amount, days });
  const now = new Date();
  await Loan.deleteMany({ userId: user._id, status: S.OFFERED });
  return Loan.create({
    userId: user._id,
    applicationNo: await nextApplicationNo(),
    amount: q.principal,
    days: q.days,
    purpose,
    interestPerDayPercent: RULES.interestPerDayPercent,
    processingFeePercent: RULES.processingFeePercent,
    interest: q.interest,
    processingFee: q.processingFee,
    totalPayable: q.totalPayable,
    disbursedAmount: q.disbursed,
    status: S.OFFERED,
    isActive: false,
    statusHistory: [{ status: S.OFFERED, at: now }],
  });
}

async function findOwned(user, id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found');
  const loan = await Loan.findOne({ _id: id, userId: user._id });
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found');
  return loan;
}

/** POST /loans/:id/accept: OFFERED -> SUBMITTED and the status engine starts. Idempotent for double taps. */
async function accept(user, id) {
  const loan = await findOwned(user, id);
  if (loan.status !== S.OFFERED) return advanceSafe(loan);

  const now = new Date();
  loan.status = S.SUBMITTED;
  loan.isActive = true;
  loan.acceptedAt = now;
  loan.statusHistory.push({ status: S.SUBMITTED, at: now });
  loan.nextTransitionAt = addMs(now, DELAY_MS);
  try {
    await loan.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'ACTIVE_LOAN_EXISTS', 'You already have an active loan application.');
    throw err;
  }
  return loan;
}

/* ------------------------------------------------------------------ */
/* Status engine (lazy + restart-safe: works on Render's free tier)    */
/* ------------------------------------------------------------------ */

function setStatus(loan, status, at, note) {
  loan.status = status;
  loan.statusHistory.push({ status, at, note });
}

function rejectLoan(loan, reason, at) {
  setStatus(loan, S.REJECTED, at, reason);
  loan.rejectionReason = reason;
  loan.isActive = false;
  loan.nextTransitionAt = null;
}

function disburseLoan(loan, at) {
  setStatus(loan, S.DISBURSED, at);
  loan.disbursedAt = at;
  loan.dueDate = addMs(at, loan.days * 24 * 60 * 60 * 1000);
  loan.nextTransitionAt = null;
}

/** Credit decision taken when the review step completes. */
async function decide(loan) {
  const user = await User.findById(loan.userId);
  if (!user || !user.dob) return { approved: false, reason: 'Applicant record could not be verified.' };

  const age = ageFromDob(user.dob);
  if (age < eligibility.MIN_AGE || age > eligibility.MAX_AGE) {
    return { approved: false, reason: 'Applicant age is outside the eligible range.' };
  }
  const score = user.creditScore ?? 0;
  if (score < 600) return { approved: false, reason: 'Credit score is below the minimum requirement.' };
  if (loan.amount > limitForScore(score)) {
    return { approved: false, reason: 'Requested amount exceeds the limit for your credit score.' };
  }
  // Demo-only rule so a rejection can be shown without Postman (mirrors the app's demo: principal 5,000).
  if (env.demoMode && env.demoRejectAmount > 0 && loan.amount === env.demoRejectAmount) {
    return { approved: false, reason: 'Application did not meet our internal credit policy.' };
  }
  return { approved: true };
}

/** Applies every transition whose scheduled time has passed (catch-up safe). */
async function advance(loan) {
  const now = Date.now();
  let changed = false;

  while (loan.nextTransitionAt && loan.nextTransitionAt.getTime() <= now) {
    const at = loan.nextTransitionAt;

    if (loan.status === S.UNDER_REVIEW) {
      const decision = await decide(loan);
      if (decision.approved) {
        setStatus(loan, S.KYC, at);
        loan.nextTransitionAt = addMs(at, DELAY_MS);
      } else {
        rejectLoan(loan, decision.reason, at);
      }
    } else if (NEXT[loan.status]) {
      const next = NEXT[loan.status];
      if (next === S.DISBURSED) {
        disburseLoan(loan, at);
      } else {
        setStatus(loan, next, at);
        loan.nextTransitionAt = addMs(at, DELAY_MS);
      }
    } else {
      loan.nextTransitionAt = null;
    }
    changed = true;
  }

  if (changed) await loan.save();
  return loan;
}

/** Two requests may advance the same loan; if we lose the race just re-read it. */
async function advanceSafe(loan) {
  try {
    return await advance(loan);
  } catch (err) {
    if (err.name === 'VersionError') return Loan.findById(loan._id);
    throw err;
  }
}

/** Demo back-office: force a decision (used from Postman during the video). */
async function adminAction(id, action, reason) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found');
  const loan = await Loan.findById(id);
  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', 'Loan not found');

  const now = new Date();
  const invalid = () => new AppError(409, 'INVALID_TRANSITION', `Cannot ${action} a loan that is ${loan.status}.`);

  if (action === 'approve') {
    if (!APPROVABLE.includes(loan.status)) throw invalid();
    setStatus(loan, S.KYC, now, 'Approved by credit team');
    loan.nextTransitionAt = addMs(now, DELAY_MS);
  } else if (action === 'reject') {
    if (!REJECTABLE.includes(loan.status)) throw invalid();
    rejectLoan(loan, reason || 'Rejected by credit team.', now);
  } else if (action === 'disburse') {
    if (!DISBURSABLE.includes(loan.status)) throw invalid();
    disburseLoan(loan, now);
  } else {
    // 'overdue': demo helper that backdates the due date so a LATE repayment (score penalty) can be shown
    if (loan.status !== S.DISBURSED) throw invalid();
    loan.dueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  await loan.save();
  return loan;
}

/* ------------------------------------------------------------------ */
/* Repayment + credit scoring (mock payment, no real money)            */
/* ------------------------------------------------------------------ */

/**
 * POST /loans/:id/repay. Marks a DISBURSED loan REPAID, frees the user to borrow again and updates the credit score:
 * on time => +50, late => -30 (see utils/creditScore.js). The score decides the next loan limit.
 */
async function repay(user, id, method) {
  const loan = await advanceSafe(await findOwned(user, id));
  if (loan.status === S.REPAID) throw new AppError(409, 'ALREADY_REPAID', 'This loan has already been repaid.');
  if (!REPAYABLE.includes(loan.status)) throw new AppError(409, 'NOT_REPAYABLE', 'Only a disbursed loan can be repaid.');

  const now = new Date();
  const onTime = now <= endOfDueDay(loan.dueDate);
  const current = await User.findById(user._id).select('creditScore');
  const { score, change } = applyRepayment(current.creditScore, onTime);

  // Atomic guard: a double tap can never repay (or change the score) twice.
  const repaid = await Loan.findOneAndUpdate(
    { _id: loan._id, status: S.DISBURSED },
    {
      $set: {
        status: S.REPAID,
        isActive: false,
        nextTransitionAt: null,
        repaidAt: now,
        repaymentMethod: method,
        paymentRef: `PAY${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        scoreChange: change,
      },
      $push: { statusHistory: { status: S.REPAID, at: now, note: onTime ? 'Repaid on time' : 'Repaid late' } },
    },
    { new: true }
  );
  if (!repaid) throw new AppError(409, 'NOT_REPAYABLE', 'Only a disbursed loan can be repaid.');

  await User.updateOne({ _id: user._id }, { $set: { creditScore: score } });
  return { loan: repaid, creditScore: score, scoreChange: change, onTime };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/** Loan JSON shared with the Flutter app. */
function toDto(loan) {
  return {
    id: loan.id,
    applicationNo: loan.applicationNo,
    principal: loan.amount,
    days: loan.days,
    purpose: loan.purpose,
    interestPerDayPercent: loan.interestPerDayPercent,
    processingFeePercent: loan.processingFeePercent,
    interest: loan.interest,
    processingFee: loan.processingFee,
    totalPayable: loan.totalPayable,
    disbursedAmount: loan.disbursedAmount,
    status: loan.status,
    statusLabel: STATUS_LABEL[loan.status], // Submitted | Under Review | Approved | Rejected | Disbursed
    rejectionReason: loan.rejectionReason ?? null,
    disbursedAt: loan.disbursedAt ?? null,
    dueDate: loan.dueDate ?? null,
    repaidAt: loan.repaidAt ?? null,
    scoreChange: loan.scoreChange ?? null,
    isOverdue: loan.status === S.DISBURSED && Boolean(loan.dueDate) && new Date() > endOfDueDay(loan.dueDate),
    createdAt: loan.createdAt,
    history: loan.statusHistory.map((h) => ({ status: h.status, at: h.at })),
  };
}

async function list(user, { page, limit }) {
  const filter = { userId: user._id, status: { $ne: S.OFFERED } }; // a pending offer is not an application yet
  const [docs, total] = await Promise.all([
    Loan.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Loan.countDocuments(filter),
  ]);
  const loans = await Promise.all(docs.map((l) => (l.nextTransitionAt ? advanceSafe(l) : l)));
  return { items: loans.map(toDto), page, limit, total, hasMore: page * limit < total };
}

async function detail(user, id) {
  return toDto(await advanceSafe(await findOwned(user, id)));
}

module.exports = { prepare, createOffer, accept, repay, adminAction, list, detail, toDto };
