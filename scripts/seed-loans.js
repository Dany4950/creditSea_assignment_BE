/**
 * Adds historic loans to an existing user so My Loans pagination / caching can be demonstrated.
 *   npm run seed            (creates the demo users first)
 *   npm run seed:loans      (25 loans for 9999999999)   |   node scripts/seed-loans.js 9999999999 40
 * Re-running replaces ALL loans of that user. Historic loans are REPAID or REJECTED (never active).
 */
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Loan = require('../src/models/Loan');
const Counter = require('../src/models/Counter');
const { quote, RULES } = require('../src/utils/loanMath');
const { PURPOSES } = require('../src/utils/constants');

const mobile = process.argv[2] || '9999999999';
const count = Math.min(Number(process.argv[3]) || 25, 200);
const DAY = 24 * 60 * 60 * 1000;

(async () => {
  await mongoose.connect(env.mongoUri);
  const user = await User.findOne({ mobile });
  if (!user) {
    console.error(`No user ${mobile}. Run "npm run seed" first.`);
    process.exit(1);
  }
  await Loan.deleteMany({ userId: user._id });

  const docs = [];
  for (let i = 0; i < count; i += 1) {
    const amount = 5000 + 1000 * ((i * 7) % 20);
    const days = RULES.minDays + ((i * 5) % 26);
    const q = quote(amount, days);
    const createdAt = new Date(Date.now() - (i + 2) * 3 * DAY);
    const disbursedAt = new Date(createdAt.getTime() + 60 * 1000);
    const dueDate = new Date(disbursedAt.getTime() + days * DAY);
    const rejected = i % 4 === 3;
    const seq = (await Counter.findOneAndUpdate({ name: 'loan' }, { $inc: { seq: 1 } }, { upsert: true, new: true })).seq;

    docs.push({
      userId: user._id,
      applicationNo: `CS${10000 + seq}`,
      amount,
      days,
      purpose: PURPOSES[i % PURPOSES.length],
      interestPerDayPercent: RULES.interestPerDayPercent,
      processingFeePercent: RULES.processingFeePercent,
      interest: q.interest,
      processingFee: q.processingFee,
      totalPayable: q.totalPayable,
      disbursedAmount: q.disbursed,
      isActive: false,
      createdAt,
      ...(rejected
        ? {
            status: 'REJECTED',
            rejectionReason: 'Application did not meet our internal credit policy.',
            statusHistory: [{ status: 'SUBMITTED', at: createdAt }, { status: 'REJECTED', at: new Date(createdAt.getTime() + 30000) }],
          }
        : {
            status: 'REPAID',
            disbursedAt,
            dueDate,
            repaidAt: new Date(dueDate.getTime() - DAY),
            repaymentMethod: 'UPI',
            scoreChange: 50,
            statusHistory: [{ status: 'SUBMITTED', at: createdAt }, { status: 'DISBURSED', at: disbursedAt }, { status: 'REPAID', at: new Date(dueDate.getTime() - DAY) }],
          }),
    });
  }
  await Loan.insertMany(docs);
  console.log(`Created ${count} historic loans for ${mobile}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
