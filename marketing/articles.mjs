// Content of the blog articles. Rendered to static HTML by marketing/build-pages.mjs under /blog/<slug>/.
//
// Rules for editing: same as marketing/pages.mjs. Describe the app only as it is today (source: public/llms.txt,
// src/features/*). No prices, user counts, ratings, outcomes or market figures. Advice sections are general
// guidance, not claims about CareerAiHub.

export const ARTICLES = [
  {
    slug: 'why-resumes-get-rejected',
    published: '2026-10-21',
    updated: '2026-10-21',
    locale: 'en_SG',
    title: 'Why Good Resumes Get Rejected, and 5 Fixes | CareerAiHub',
    description: 'Strong candidates lose interviews for fixable reasons: mismatched keywords, vague bullets, hard-to-read formats and claims without proof. Here are five fixes.',
    h1: 'Why good candidates get rejected before a human reads their resume',
    lead: 'You have the skills and the experience, you have sent dozens of applications and heard back from a few. The problem is rarely your ability. It is usually the gap between how you describe your work and what a specific job asks for. That gap is fixable, and you can check it before you apply.',
    sections: [
      { h2: '1. Your resume speaks a different language from the job description', paras: [
        'Applicant tracking systems (ATS) and recruiters both scan for the language of the role. If the posting says "stakeholder management" and your resume says "worked with teams", you can be a strong match on paper and still be easy to miss.',
      ], list: [
        'Put the job description next to your resume and mark the skills, tools and responsibilities it repeats.',
        'Use the employer’s wording where it is true for you, for example "SQL" instead of "database querying".',
        'Do this for every application. One generic resume cannot match ten different jobs.',
      ] },
      { h2: '2. Your bullets describe duties, not results', paras: [
        '"Responsible for customer support" tells a hiring manager very little. "Resolved 40 tickets a day and cut average response time from 6 hours to 2" tells them what you actually did. The formula: action verb, what you did, measurable result.',
        'For each role, look for two bullets where you can add a number such as volume, time saved, money, accuracy or team size. If you have no number, describe the scope honestly: who it was for, how often, how big. Never invent a figure. Interviewers will ask you to explain every number.',
      ] },
      { h2: '3. The format fights the software', paras: [
        'Two-column templates, text inside images, icons in place of contact details and creative section names can break automated parsing. If the system cannot read your resume, nobody else will.',
      ], list: [
        'Use a single column with standard headings: Experience, Education, Skills.',
        'Keep text as real text, not images.',
        'Send PDF or DOCX exactly as the employer asks.',
        'Put contact details in the body of the page, not in the header or footer.',
      ] },
      { h2: '4. Your claims have no proof', paras: [
        'Anyone can write "advanced Excel" or "certified project manager". Employers know this and look for evidence: a portfolio link, a certificate they can check, a project with a clear outcome.',
      ], list: [
        'Link to work that shows the skill.',
        'For certifications, add the credential ID or a verification link where the issuer offers one.',
        'Make sure every skill in your Skills section appears in at least one bullet that shows you using it.',
      ] },
      { h2: '5. You prepare the resume, then freeze at the interview', paras: [
        'Two moments catch out many candidates who pass the screen: the behavioural question ("Tell me about a time you...") and the salary conversation.',
      ], list: [
        'Prepare five or six stories in the STAR structure: Situation, Task, Action, Result. One story can answer several questions.',
        'Say your answers out loud. Practising silently does not show you where you ramble.',
        'Look up the salary range for the role and market before the call, and decide your target and your walk-away point in advance.',
      ] },
      { h2: 'A 15-minute check you can do today', list: [
        'Pick one job you actually want.',
        'Compare your resume with the posting. Which required skills are missing, or worded differently?',
        'Rewrite your top three bullets as action, task, result.',
        'Remove decoration such as graphics, columns and icons.',
        'Write one STAR story for the most likely behavioural question for that role.',
      ] },
      { h2: 'Where CareerAiHub fits in', paras: [
        'Doing this by hand works, but it is slow. CareerAiHub is a web app with tools for each step above. The default market is Singapore.',
      ], list: [
        'ATS Scanner: scan a resume (PDF or DOCX) against a job description and see what may cost you interviews.',
        'Resume Builder and Cover Letter AI: rewrite your resume and draft a cover letter for a specific job.',
        'Interview Coach and STAR Builder: practise mock interviews and shape your experience into STAR stories.',
        'Salary Prep: practise salary negotiation.',
        'Skills Gap and Verify Creds: compare your skills with a target role, and check certificates from allowlisted issuers.',
        'Job Search: search live job listings. It works without signing in; sign in to save your data and use the AI tools.',
      ] },
    ],
    faq: [
      { q: 'Does an ATS really reject resumes?', a: 'Systems differ. Many mainly organise and search applications, and a recruiter still decides. Either way the fix is the same: clear structure, the language of the job, and visible proof of results.' },
      { q: 'Should I add every keyword from the job description?', a: 'Only the ones that are true for you. Keywords you cannot back up will fail at the interview even if they pass the screen.' },
      { q: 'How long should my resume be?', a: 'One page is a sound default for under ten years of experience, and two pages is fine for senior roles. Cut anything that does not support the job you are applying for.' },
      { q: 'Do I need a different resume for each job?', a: 'You need a different version. Keep one master document and adjust the summary, the order of skills and the top bullets for each posting.' },
    ],
    related: ['ats-resume-checker', 'mock-interview-ai', 'salary-negotiation'],
  },
];
