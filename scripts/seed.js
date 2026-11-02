/** Creates fully-onboarded demo users. Re-running resets them (and deletes their loans). */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');
const Loan = require('../src/models/Loan');
const { encrypt } = require('../src/utils/crypto');
const { scoreFromPan, maskPan } = require('../src/utils/creditScore');

const PASSWORD = 'Demo@1234';
const DEMO_USERS = [
  { mobile: '9999999999', first: 'Demo', last: 'Eligible', pan: 'ABCDE1234F' }, // score 800 -> up to 1,00,000
  { mobile: '8888888888', first: 'Demo', last: 'Limited', pan: 'ABCDE1230F' },  // score 600 -> up to 25,000
  { mobile: '7777777777', first: 'Demo', last: 'Ineligible', pan: 'ABCDE0123F' }, // score 580 -> not eligible
];

(async () => {
  await mongoose.connect(env.mongoUri);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const d of DEMO_USERS) {
    const existing = await User.findOne({ mobile: d.mobile });
    if (existing) {
      await Loan.deleteMany({ userId: existing._id });
      await existing.deleteOne();
    }
    await User.create({
      mobile: d.mobile,
      passwordHash,
      firstName: d.first,
      lastName: d.last,
      gender: 'Male',
      dob: new Date('1995-06-15T00:00:00.000Z'),
      maritalStatus: 'Single',
      email: `${d.mobile}@demo.creditsea.test`,
      emailVerified: true,
      panEncrypted: encrypt(d.pan),
      panMasked: maskPan(d.pan),
      panVerified: true,
      creditScore: scoreFromPan(d.pan),
    });
    console.log(`seeded ${d.mobile}  PAN ${d.pan}  score ${scoreFromPan(d.pan)}`);
  }
  console.log(`\nPassword for all demo users: ${PASSWORD}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
