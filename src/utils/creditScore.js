const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * MOCK credit bureau (deterministic so reviewers can test every path):
 *   PAN digits < 1000      -> 580 (not eligible)
 *   otherwise              -> 600 + (digits % 5) * 50   (600, 650, 700, 750, 800)
 * e.g. ABCDE1234F -> 800, ABCDE1230F -> 600, ABCDE0123F -> 580
 */
function scoreFromPan(pan) {
  const digits = Number(pan.slice(5, 9));
  return digits < 1000 ? 580 : 600 + (digits % 5) * 50;
}

function limitForScore(score) {
  if (score >= 750) return 100000;
  if (score >= 700) return 75000;
  if (score >= 650) return 50000;
  if (score >= 600) return 25000;
  return 0;
}

/** Repayment feedback loop (basic credit scoring). */
const SCORE_MIN = 300;
const SCORE_MAX = 900;
const ON_TIME_BONUS = 50; // repaid on or before the due date
const LATE_PENALTY = 30; // repaid after the due date

/**
 * Successful, on-time repayments raise the score; late ones lower it. Always clamped to 300..900.
 * Returns the new score and the real change applied (smaller than the bonus when hitting the cap).
 */
function applyRepayment(score, onTime) {
  const base = Math.min(SCORE_MAX, Math.max(SCORE_MIN, score ?? SCORE_MIN));
  const next = Math.min(SCORE_MAX, Math.max(SCORE_MIN, base + (onTime ? ON_TIME_BONUS : -LATE_PENALTY)));
  return { score: next, change: next - base };
}

const maskPan = (pan) => `${pan.slice(0, 5)}****${pan[9]}`;

module.exports = {
  PAN_REGEX, scoreFromPan, limitForScore, maskPan, applyRepayment, SCORE_MIN, SCORE_MAX, ON_TIME_BONUS, LATE_PENALTY,
};
