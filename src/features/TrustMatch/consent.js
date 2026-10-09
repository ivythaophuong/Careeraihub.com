// Pure logic of the candidate consent flow (docs/architecture/plans/CONSENT-FLOW-DESIGN.md). No network, no React.

export const PURPOSE = 'recruiter_review';
export const DEFAULT_DAYS = 90;
const DAY_MS = 86_400_000;

// What each consented part releases to the employer. This must match the columns of employer_view_candidates (design, section 4.2).
export const PART_FIELDS = {
  profile: ['Name', 'Headline', 'Bio', 'Skills', 'Location', 'Work preference'],
  salary: ['Expected salary range'],
};
// Never part of this consent.
export const NOT_SHARED = ['Resume text', 'Email address', 'Credentials', 'Practice scores'];

export const consentFlowEnabled = () => import.meta.env?.VITE_CONSENT_FLOW === 'true';

// The row sent to the database. The candidate id is never sent: the database sets it.
export function buildGrant({ employerId, shareSalary = false, now = new Date() }) {
  if (!employerId) throw new Error('An employer is required.');
  return {
    employer_id: employerId,
    scope: { parts: shareSalary ? ['profile', 'salary'] : ['profile'] },
    purpose: PURPOSE,
    expires_at: new Date(now.getTime() + DEFAULT_DAYS * DAY_MS).toISOString(),
  };
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const isActive = (c, now = new Date()) => !!c && c.purpose === PURPOSE && !c.revoked_at && new Date(c.expires_at) > now;

// Group the candidate's consent rows by employer: what is active now (parts combined, latest expiry) and what is history.
export function groupByEmployer(consents, now = new Date()) {
  const out = new Map();
  for (const c of consents || []) {
    if (!c || c.purpose !== PURPOSE) continue;
    const g = out.get(c.employer_id) || { employerId: c.employer_id, active: [], history: [], parts: [], expiresAt: null };
    if (isActive(c, now)) {
      g.active.push(c);
      for (const p of c.scope?.parts || []) if (!g.parts.includes(p)) g.parts.push(p);
      if (!g.expiresAt || new Date(c.expires_at) > new Date(g.expiresAt)) g.expiresAt = c.expires_at;
    } else g.history.push(c);
    out.set(c.employer_id, g);
  }
  return out;
}

// Sharing an empty profile would mislead the candidate: require a saved profile with a name.
export function canShare(profile) {
  if (!profile) return { ok: false, reason: 'Save your TrustMatch profile first, so there is something to share.' };
  if (!String(profile.full_name || '').trim()) return { ok: false, reason: 'Add your name to your TrustMatch profile first.' };
  return { ok: true, reason: '' };
}

// Exactly the lines the dialog shows for the chosen parts.
export function releasedFields({ shareSalary, profile }) {
  const lines = [...PART_FIELDS.profile];
  if (shareSalary) {
    const range = profile?.salary_min ? ` (${profile.currency || 'USD'} ${profile.salary_min}–${profile.salary_max ?? '?'})` : ' (none saved yet)';
    lines.push(`${PART_FIELDS.salary[0]}${range}`);
  }
  return lines;
}
