/** Whole years between dob and now (UTC). */
function ageFromDob(dob, now = new Date()) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

/** 'yyyy-MM-dd' -> Date at UTC midnight, or null if invalid. */
function parseIsoDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

const toIsoDate = (d) => (d ? d.toISOString().slice(0, 10) : null);

module.exports = { ageFromDob, parseIsoDate, toIsoDate };
