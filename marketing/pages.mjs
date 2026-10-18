// Content of the public marketing pages. Rendered to static HTML by scripts/build-pages.mjs.
//
// Rules for editing (same as CLAUDE.md: write only what is verified in source):
// - Describe what the app does today. No prices, user counts, ratings, outcomes or market figures.
// - No Singpass, OpenCerts or "free" claims: they are not verified (docs/OPEN_POINTS.md OP-6).
// - Facts about the tools come from src/ (file noted in the comment on each block).

export const SITE = 'https://careeraihub.com';

export const PAGES = [
  {
    slug: 'ats-resume-checker',
    updated: '2026-10-18',
    locale: 'en_SG',
    title: 'ATS Resume Checker: scan your resume against a job | CareerAiHub',
    description: 'Upload a PDF or DOCX resume, paste a job description and see what may be costing you interviews. Built for job seekers in Singapore and Malaysia.',
    h1: 'ATS resume checker for job seekers in Singapore and Malaysia',
    lead: 'CareerAiHub scans your resume against a real job description and shows the gaps a recruiter or an applicant tracking system (ATS) could trip over, so you know what to fix before you apply.',
    sections: [
      // src/features/ResumeScan, src/lib/resumeParser.js, src/lib/resumeDigest.js
      { h2: 'How it works', list: [
        'Upload your resume as a PDF or DOCX. The text is read in your browser.',
        'Paste the job description you are applying for.',
        'The scan lists what is missing or unclear against that job, including keywords from the posting.',
        'Very long resumes or postings are shortened before the AI reads them, and the app tells you when it did.',
      ] },
      // src/lib/factGuard.js, numberGuard.js
      { h2: 'Fixes that stay true to your resume', paras: [
        'When the AI rewrites a line, any figure it adds that is not in your own text is removed or flagged. You stay in control of what goes on your resume, and you should still read every line before you send it.',
      ] },
      { h2: 'What it is not', paras: [
        'CareerAiHub is not connected to any employer’s applicant tracking system, so its result is its own assessment, not the score a specific company will give you. It cannot promise an interview.',
      ] },
      { h2: 'After the scan', paras: [
        'Move on to the Resume Builder to apply the fixes and keep saved versions, write a matching cover letter, or practise the interview for the same role.',
      ] },
    ],
    faq: [
      { q: 'Which file types can I scan?', a: 'PDF and DOCX.' },
      { q: 'Does the checker guarantee I will pass an ATS?', a: 'No. It is not connected to any employer’s ATS. It shows gaps against the job description you paste, so you can fix them before applying.' },
      { q: 'Do I need an account?', a: 'Sign in to use the AI tools and save your results.' },
    ],
    related: ['mock-interview-ai', 'salary-negotiation', 'singapore'],
  },
  {
    slug: 'mock-interview-ai',
    updated: '2026-10-18',
    locale: 'en_SG',
    title: 'AI Mock Interview and STAR Story Practice | CareerAiHub',
    description: 'Practise interview answers with an AI coach, build STAR stories from your own experience and see which skills need more work.',
    h1: 'AI mock interview practice',
    lead: 'The Interview Coach lets you rehearse answers before the real interview, turn your experience into STAR stories, and track where you are still weak.',
    sections: [
      // src/features/InterviewCoach/InterviewCoach.jsx, STARBuilder, WeaknessRadar, ReadinessScore
      { h2: 'What is inside', list: [
        'Study Modules: short lessons before you practise.',
        'Live Session: a mock interview where you answer and get feedback.',
        'STAR Builder: shape a real experience into Situation, Task, Action and Result.',
        'Weakness Radar: see which areas keep coming up in your practice.',
        'Readiness Score: a practice score based on your own practice activity. It is not a verified credential and does not predict a result.',
      ] },
      { h2: 'Use it with your resume', paras: [
        'Scan your resume first, then practise the questions that match the gaps it found. Your sessions and STAR stories are saved to your account so you can come back to them.',
      ] },
    ],
    faq: [
      { q: 'What is the STAR method?', a: 'A way to answer behavioural questions: describe the Situation, your Task, the Action you took and the Result.' },
      { q: 'Does the Readiness Score predict whether I will get the job?', a: 'No. It reflects your own practice activity inside CareerAiHub only.' },
      { q: 'Are my practice sessions saved?', a: 'Yes, when you are signed in. They are stored in your account.' },
    ],
    related: ['ats-resume-checker', 'salary-negotiation', 'singapore'],
  },
  {
    slug: 'salary-negotiation',
    updated: '2026-10-18',
    locale: 'en_SG',
    title: 'Salary Negotiation Prep: scripts and offer maths | CareerAiHub',
    description: 'Prepare for a salary conversation at any stage: before interviews, with an offer, mid-negotiation or a counter-offer. Scripts from the AI, numbers from your own figures.',
    h1: 'Salary negotiation preparation',
    lead: 'Salary Prep helps you plan what to say at the stage you are in, and works out the numbers from the figures you give it.',
    sections: [
      // src/features/SalaryCoach/salary.js
      { h2: 'Pick your stage', list: [
        'Before interviews: how to defer the number and answer if pressed.',
        'Got an offer: how to respond without accepting on the spot and how to ask for time.',
        'Mid-negotiation: how to handle pushback and trade-offs between parts of the package.',
        'Counter-offer: how to weigh a counter-offer or competing offers honestly.',
      ] },
      { h2: 'Numbers come from you, not from the AI', paras: [
        'The negotiation maths is calculated from the amounts you enter. The AI supplies strategy and example scripts only. It has no live salary data, so it is told not to quote market figures. Check market ranges yourself, for example on job listings that show salaries, before you set your target.',
      ] },
      { h2: 'Currencies', paras: [
        'The currency list currently has SGD, USD, GBP, EUR, AUD and CAD.',
      ] },
    ],
    faq: [
      { q: 'Does it tell me what salary to ask for?', a: 'No. It does not quote market salaries. You enter your own figures and it helps with strategy, scripts and the arithmetic.' },
      { q: 'Which currencies are supported?', a: 'SGD, USD, GBP, EUR, AUD and CAD.' },
      { q: 'Can I use it before I have an offer?', a: 'Yes. One of the four stages is for before interviews, when you may be asked for your salary expectations early.' },
    ],
    related: ['mock-interview-ai', 'ats-resume-checker', 'singapore'],
  },
  {
    slug: 'singapore',
    updated: '2026-10-18',
    locale: 'en_SG',
    title: 'AI Career Tools for Job Seekers in Singapore | CareerAiHub',
    description: 'Resume scan, interview practice and salary preparation, with Singapore as the default market. Includes links to Singapore job boards.',
    h1: 'AI career tools for job seekers in Singapore',
    lead: 'Singapore is the default market in CareerAiHub. Use it to tighten your resume for a specific posting, practise for the interview and prepare the salary conversation.',
    sections: [
      { h2: 'What you can do', list: [
        'Scan your resume against a job description.',
        'Build and download an updated resume, with saved versions.',
        'Draft a cover letter for a specific role.',
        'Practise interviews and build STAR stories.',
        'Prepare a salary conversation in SGD.',
        'Compare your skills with a target role and plan next steps.',
      ] },
      // src/features/JobSearch/JobSearch.jsx, src/features/MarketIntel/MarketIntel.jsx
      { h2: 'Find jobs', paras: [
        'Job Search can search live listings and also links to Singapore job boards such as MyCareersFuture, which shows salary ranges on listings, and JobStreet.',
        'The Regional Guide gives hand-written rules of thumb about hiring in different markets. It is not live or measured data.',
      ] },
      // src/features/Legal/legalContent.js
      { h2: 'Your data', paras: [
        'CareerAiHub aims to follow the personal data protection laws of the places it serves, including Singapore’s PDPA. A company has not been registered yet; read the Privacy Policy in the app for the current wording.',
      ] },
    ],
    faq: [
      { q: 'Is CareerAiHub made for Singapore?', a: 'Singapore is the default market in the app.' },
      { q: 'Can I search Singapore jobs?', a: 'Yes. Job Search lists live postings and links to Singapore job boards such as MyCareersFuture and JobStreet.' },
      { q: 'Does it replace a career coach?', a: 'No. It is a set of AI tools for preparing your resume, interviews and salary talks. Read what it produces before you use it.' },
    ],
    related: ['ats-resume-checker', 'mock-interview-ai', 'salary-negotiation'],
  },
  {
    slug: 'malaysia',
    updated: '2026-10-18',
    locale: 'en_MY',
    title: 'AI Resume and Interview Tools for Job Seekers in Malaysia | CareerAiHub',
    description: 'What job seekers in Malaysia can use today in CareerAiHub (resume scan, interview practice, cover letters) and what is not available yet.',
    h1: 'CareerAiHub for job seekers in Malaysia',
    lead: 'Most of CareerAiHub’s AI tools work on any resume and any job description, so you can use them for Malaysian roles. Some parts are built around Singapore, and this page says which.',
    sections: [
      { h2: 'What works for Malaysian roles today', list: [
        'ATS Scanner: paste any job description, including one from JobStreet Malaysia, and scan your resume against it.',
        'Resume Builder and Cover Letter AI.',
        'Interview Coach and STAR Builder.',
        'Skills Gap and Career Roadmap.',
      ] },
      { h2: 'What is not there yet', list: [
        'Malaysia-specific features are planned, not built.',
        'Salary Prep does not list MYR in its currency choices yet.',
        'Whether Job Search returns live Malaysian listings is not confirmed, so check the job board directly.',
      ] },
      { h2: 'Your data', paras: [
        'CareerAiHub aims to follow the personal data protection laws of the places it serves, including Malaysia’s PDPA. A company has not been registered yet; read the Privacy Policy in the app for the current wording.',
      ] },
    ],
    faq: [
      { q: 'Can I use CareerAiHub in Malaysia?', a: 'The AI tools work on any resume and job description. Malaysia-specific features are planned but not built yet.' },
      { q: 'Can I use MYR in Salary Prep?', a: 'Not yet. The currency list has SGD, USD, GBP, EUR, AUD and CAD.' },
      { q: 'Can I scan a resume against a JobStreet Malaysia posting?', a: 'Yes. Copy the job description text into the ATS Scanner.' },
    ],
    related: ['ats-resume-checker', 'mock-interview-ai', 'singapore'],
  },
];
