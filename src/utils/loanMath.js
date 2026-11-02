/** Single source of truth for loan pricing. The Flutter app mirrors this formula locally. */
const RULES = Object.freeze({
  minAmount: 5000,
  amountStep: 1000,
  minDays: 20,
  maxDays: 45,
  interestPerDayPercent: 1,
  processingFeePercent: 10,
});

/** Simple interest, single repayment. All values are whole rupees. */
function quote(principal, days) {
  const interest = Math.round((principal * RULES.interestPerDayPercent * days) / 100);
  const processingFee = Math.round((principal * RULES.processingFeePercent) / 100);
  return {
    principal,
    days,
    interest,
    processingFee,
    totalPayable: principal + interest,
    disbursed: principal - processingFee,
  };
}

module.exports = { RULES, quote };
