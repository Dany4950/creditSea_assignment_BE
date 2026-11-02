module.exports = Object.freeze({
  GENDERS: ['Male', 'Female', 'Other'],
  MARITAL_STATUSES: ['Single', 'Married', 'Divorced', 'Widowed'],
  // Suggested list exposed to the app; the API accepts any 2-50 char purpose so client/server lists can't drift.
  PURPOSES: ['Personal Needs', 'Medical Emergency', 'Education', 'Travel', 'Home Renovation', 'Business', 'Other'],
  REPAYMENT_METHODS: ['UPI', 'CARD', 'NETBANKING'], // mock payment channels
  LOAN_STATUS: Object.freeze({
    OFFERED: 'OFFERED',
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    KYC: 'KYC',
    NACH: 'NACH',
    SIGN: 'SIGN',
    DISBURSING: 'DISBURSING',
    DISBURSED: 'DISBURSED',
    REJECTED: 'REJECTED',
    REPAID: 'REPAID',
  }),
});
