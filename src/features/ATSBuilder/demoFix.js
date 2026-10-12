// DEVELOPMENT ONLY. A synthetic resume profile with issues, so the Fix page can be tried on a local machine, where the AI call is blocked by CORS
// (the Edge Function allows only the production origin). It is switched on by ?demo=fix and only when the app runs in development (import.meta.env.DEV);
// a production build never returns it. Nothing in it is real: no real name, email, phone or link.
export const DEMO_FIX_PROFILE = {
  name: 'Demo Candidate',
  email: 'demo.candidate@example.com',
  phone: '',
  linkedin: '',
  location: 'Singapore',
  targetRole: 'Data Analyst',
  summary: 'Analyst who builds reports for sales teams.',
  skills: ['SQL', 'Excel'],
  education: [{ degree: 'BSc Business', institution: 'Example University', year: '2019' }],
  workExperience: [
    { title: 'Analyst', company: 'Northwind Demo Co', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers', 'Trained two new hires'] },
    { title: 'Associate', company: 'Contoso Demo Ltd', period: '2019 - 2021', bullets: ['Trained two new hires', 'Prepared weekly sales summaries'] },
  ],
  issues: [
    { severity: 'high', title: 'No metrics in bullets', description: 'Add a real figure (a count, a percentage, a size) where you have one.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null },
    { severity: 'medium', title: 'Plain verb in two jobs', description: 'Say what the training led to.', before: 'Trained two new hires', after: 'Coached two new hires through their first quarter', builderStep: 2, module: null },
    { severity: 'medium', title: 'Summary is generic', description: 'Say what you report on and for whom.', before: 'builds reports for sales teams', after: 'builds weekly sales reports used by 6 managers', builderStep: 5, module: null },
    { severity: 'medium', title: 'Skills list is short', description: 'Add the tools you use.', before: '', after: '', builderStep: 4, module: null },
    { severity: 'medium', title: 'Match the job description', description: 'Compare your resume with a job description.', before: '', after: '', builderStep: null, module: 'scan' },
  ],
};

export function demoFixProfile({ dev, search } = {}) {
  if (dev !== true) return null;
  try { return new URLSearchParams(search || '').get('demo') === 'fix' ? DEMO_FIX_PROFILE : null; } catch { return null; }
}

// ?demo=fix&reset=1: start the demo again (its own saved draft and records are cleared). Development only, like the demo itself.
export function demoResetRequested({ dev, search } = {}) {
  if (dev !== true) return false;
  try { return new URLSearchParams(search || '').get('reset') === '1'; } catch { return false; }
}
