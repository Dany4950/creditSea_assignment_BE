const { LOAN_STATUS: S } = require('./constants');

/** Automatic progression once a loan is accepted. UNDER_REVIEW is special: a credit decision picks KYC or REJECTED. */
const NEXT = Object.freeze({
  [S.SUBMITTED]: S.UNDER_REVIEW,
  [S.KYC]: S.NACH,
  [S.NACH]: S.SIGN,
  [S.SIGN]: S.DISBURSING,
  [S.DISBURSING]: S.DISBURSED,
});

/** The assignment's named chain: Submitted -> Under Review -> Approved/Rejected -> Disbursed. */
const STATUS_LABEL = Object.freeze({
  [S.OFFERED]: 'Offered',
  [S.SUBMITTED]: 'Submitted',
  [S.UNDER_REVIEW]: 'Under Review',
  [S.KYC]: 'Approved',
  [S.NACH]: 'Approved',
  [S.SIGN]: 'Approved',
  [S.DISBURSING]: 'Approved',
  [S.DISBURSED]: 'Disbursed',
  [S.REJECTED]: 'Rejected',
  [S.REPAID]: 'Repaid',
});

const APPROVABLE = [S.SUBMITTED, S.UNDER_REVIEW];
const REJECTABLE = [S.SUBMITTED, S.UNDER_REVIEW, S.KYC, S.NACH, S.SIGN, S.DISBURSING];
const DISBURSABLE = [S.KYC, S.NACH, S.SIGN, S.DISBURSING];
const REPAYABLE = [S.DISBURSED];

module.exports = { NEXT, STATUS_LABEL, APPROVABLE, REJECTABLE, DISBURSABLE, REPAYABLE };
