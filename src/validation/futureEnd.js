// A work entry whose end date is after today gets an informational note made by code. Not an error and not a score change: a future end can be
// real (a contract already signed, notice already given), so the note only asks the user to check. Work entries only: "expected 2027" is normal
// for education. No AI. `today` is passed in ("YYYY-MM-DD"), never read from the clock, so the result is the same for the same inputs.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayParts(today) {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(today || ''));
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

// "YYYY-MM" is after today only when its month is later than this month. A bare "YYYY" is after today only when the year is later than
// this year: a year alone during that year is ambiguous (it may mean December or January), so it gets no note. "present" and anything else: no.
function isAfter(normalized, now) {
  const mo = /^(\d{4})-(\d{2})$/.exec(String(normalized || ''));
  if (mo) return Number(mo[1]) * 12 + Number(mo[2]) > now.year * 12 + now.month;
  const yr = /^(\d{4})$/.exec(String(normalized || ''));
  return yr ? Number(yr[1]) > now.year : false;
}

export function futureEndNotes(facts, today) {
  const now = todayParts(today);
  if (!now || !Array.isArray(facts?.experiences)) return [];
  const out = [];
  facts.experiences.forEach((e, i) => {
    const end = e?.end;
    if (!end || !isAfter(end.normalized_value, now)) return;
    const who = [e.title?.value, e.company?.value].filter(Boolean).join(' at ');
    out.push({
      kind: 'future_end_date',
      severity: 'info',
      message: `${who ? `Your role "${who}"` : 'One of your roles'} ends in ${end.value}, which is after today. If that is a planned end date, you can ignore this; otherwise check the date.`,
      refs: [end.source || `experiences[${i}].end`],
    });
  });
  return out;
}
