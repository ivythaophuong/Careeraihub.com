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
  education: [{ degree: 'BSc Business', institution: 'Example University', year: '2019' }, { degree: '', institution: 'Example College', year: '' }],
  workExperience: [
    { title: 'Analyst', company: 'Northwind Demo Co', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers', 'Trained two new hires'] },
    { title: 'Associate', company: 'Contoso Demo Ltd', period: '2019 - 2021', bullets: ['Trained two new hires', 'Prepared weekly sales summaries'] },
    { title: 'Intern', company: '', period: '2018 - 2017', bullets: ['Filed the weekly reports'] },   // no company (so it is not drawn) and an end before the start: for the job and the dates cards
  ],
  issues: [
    { severity: 'high', title: 'No metrics in bullets', description: 'Add a real figure (a count, a percentage, a size) where you have one.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null },
    { severity: 'medium', title: 'Plain verb in two jobs', description: 'Say what the training led to.', before: 'Trained two new hires', after: 'Coached two new hires through their first quarter', builderStep: 2, module: null },
    { severity: 'medium', title: 'Summary is generic', description: 'Say what you report on and for whom.', before: 'builds reports for sales teams', after: 'builds weekly sales reports used by 6 managers', builderStep: 5, module: null },
    { severity: 'medium', title: 'Skills list is short', description: 'Add the tools you use.', before: '', after: '', builderStep: 4, module: null },
    // One issue for each card of the Fix page that has no sentence to quote. The data above has what each card shows: no phone and no LinkedIn, an end before
    // the start, a missing year, a job with no company, a school with no degree. These issues carry no AI text on purpose: those cards suggest nothing.
    { severity: 'medium', title: 'Some dates need a check', description: 'A date is missing or looks wrong. Type only dates that are true.', before: '', after: '', builderStep: 2, module: null },
    { severity: 'medium', title: 'Phone number missing', description: 'Recruiters look for a phone number and a profile link.', before: '', after: '', builderStep: 1, module: null },
    { severity: 'medium', title: 'Degree is not specified', description: 'Say which degree you studied for.', before: '', after: '', builderStep: 3, module: null },
    { severity: 'medium', title: 'Job titles are vague', description: 'Check the title and the company of each job.', before: '', after: '', builderStep: 2, module: null },
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
