const { Schema, model } = require('mongoose');
const { LOAN_STATUS } = require('../utils/constants');

const historySchema = new Schema({ status: String, at: Date, note: String }, { _id: false });

const loanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    applicationNo: { type: String, required: true, unique: true }, // CS10001, CS10002, ...

    amount: { type: Number, required: true }, // principal (exposed as `principal` in the API)
    days: { type: Number, required: true },
    purpose: { type: String, required: true },

    // Pricing snapshot so later rule changes never alter an existing loan
    interestPerDayPercent: Number,
    processingFeePercent: Number,
    interest: Number,
    processingFee: Number,
    totalPayable: Number,
    disbursedAmount: Number,

    status: { type: String, enum: Object.values(LOAN_STATUS), default: LOAN_STATUS.OFFERED },
    rejectionReason: String,
    statusHistory: [historySchema],

    isActive: { type: Boolean, default: false }, // true from acceptance until rejected / repaid. OFFERED is not active.
    nextTransitionAt: { type: Date, default: null }, // lazy status-simulation clock
    acceptedAt: Date,
    disbursedAt: Date,
    dueDate: Date,
    repaidAt: Date,
    repaymentMethod: String, // UPI | CARD | NETBANKING (mock)
    paymentRef: String,
    scoreChange: Number, // credit score change caused by the repayment
  },
  { timestamps: true }
);

loanSchema.index({ userId: 1, createdAt: -1 });
// DB-level guarantee: a user can never hold two active loans (even with double taps / races)
loanSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_loan_per_user' }
);

module.exports = model('Loan', loanSchema);
