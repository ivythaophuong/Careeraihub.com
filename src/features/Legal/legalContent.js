// The one source for the Privacy Policy and the Terms of Service. The in-app pages (PrivacyPolicy.jsx, TermsOfService.jsx) and the
// landing-page legal sheet (LandingPage.jsx) all render from here, so they cannot say different things again.
// Only state what the product does today (see docs/DATA_LINEAGE.md). Needs a legal review before it is relied on.
export const LEGAL_UPDATED = 'October 2026';
export const LEGAL_EMAIL = 'hello.careeraihub@gmail.com';

// section = { heading, paras?: string[], bullets?: string[] }; a bullet may be [boldLead, rest].
export const PRIVACY_SECTIONS = [
  {
    heading: '1. Who we are and the laws we follow',
    paras: [
      'CareerAiHub is an AI career platform operated by its founder. A company has not been registered yet; this page will be updated when it is. We aim to follow the personal data protection laws of the places we serve: Vietnam, Singapore (PDPA) and Malaysia (PDPA).',
    ],
  },
  {
    heading: '2. Information We Collect',
    bullets: [
      ['Account Information:', 'email address and name, used to sign you in.'],
      ['Resume & Career Content:', 'resumes you upload or paste (a PDF you upload may be kept in your account so you can edit it again), work history, skills, scans, job applications, practice interview and STAR answers (text), cover letters and similar items you create or save.'],
      ['Job Search Terms:', 'the job title and location you type into job search.'],
      ['TrustMatch Profile:', 'if you create one, the headline, bio, skills, salary range, work preference and visibility setting you enter.'],
      ['Technical Logs:', 'time, feature used, AI model used, size of the request and whether it succeeded, tied to an identifier that is not your email. These logs do not include the text of your resume.'],
    ],
    paras: ['Please do not put identity numbers, bank details or health records in your resume.'],
  },
  {
    heading: '3. How We Use Your Data',
    bullets: [
      'Analyze and improve your resume and prepare career materials using AI models (see section 5).',
      'Generate career advice, interview practice and scores.',
      'Save your progress and sync it across devices through our database.',
      'Run job search, keep the service working and protect it from abuse.',
    ],
    paras: ['We do not sell your personal data. By creating an account you agree to this policy and to our Terms of Service.'],
  },
  {
    heading: '4. Storage, Retention & Deletion',
    paras: [
      'We use Supabase for the database and sign-in. The career data saved in your account stays there until you delete it. You can remove it yourself in the Memory Dashboard with "Clear memory", or ask us to delete your data or your account by email at the address in section 8.',
      'We answer deletion, access and correction requests as soon as we reasonably can and within the time that applicable law requires.',
    ],
  },
  {
    heading: '5. Third-Party Services and Transfers Abroad',
    paras: [
      'When you use a scanning, rewriting, scoring or coaching feature, the relevant part of your resume and your request are sent to an AI provider so it can answer. These providers process data outside your country, including in the United States. Today our main provider is OpenAI, and Groq is used as a backup if OpenAI is unavailable. We may change providers; when we do, this page is updated.',
    ],
    bullets: [
      ['OpenAI:', 'OpenAI states that data sent to its API is not used to train or improve its models unless a customer opts in, and that it keeps abuse-monitoring logs of API usage for up to 30 days unless the law requires longer.'],
      ['Groq:', 'Groq states that by default it does not retain customer data for inference requests, except where needed to protect platform reliability.'],
      ['Adzuna (job search):', 'only the job title and location you search for are sent to Adzuna. We do not send your resume, name or email to Adzuna.'],
    ],
    paras2: [
      'These are statements by those providers, and their own terms govern what they do with the data. We do not control their systems.',
    ],
  },
  {
    heading: '6. Sharing With Employers',
    paras: [
      'If you set your TrustMatch profile to visible, verified employers on the platform can see that profile (your headline, bio, skills, salary range, work preference and trust score). You choose this setting and can turn it off in TrustMatch. We do not share your resume with employers.',
    ],
  },
  {
    heading: '7. Security',
    paras: [
      'You must sign in to reach your saved data, our AI keys are kept on our servers and never in your browser, and the site is served over HTTPS. No online service can promise absolute security, so please share only what you are comfortable sharing.',
    ],
  },
  {
    heading: '8. Your Rights and Contact',
    paras: [
      'You can ask to see, correct or delete your personal data, or withdraw your consent (which may stop some features from working). Email ' + LEGAL_EMAIL + '. If you think we handled your data wrongly, tell us and we will look into it.',
    ],
  },
];

export const TERMS_SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    paras: ['By creating an account or using CareerAiHub, you agree to these Terms and to the Privacy Policy. If you do not agree, please do not use the platform.'],
  },
  {
    heading: '2. Use of AI Tools',
    paras: [
      'CareerAiHub gives suggestions made by large language models for resumes, applications and interview practice. The results are provided "as is" and "as available". They can be wrong, incomplete or misleading.',
      'You are responsible for reading, checking and correcting everything before you send it to an employer or anyone else.',
    ],
  },
  {
    heading: '3. Your Content and Conduct',
    paras: ['You keep ownership of the content you upload. You confirm that it is accurate as far as you know, and that you have the right to use it. You agree not to:'],
    bullets: [
      'create false, misleading or fraudulent career documents;',
      'try to break, overload, reverse-engineer or get around the platform, its API or its security;',
      'use the platform for anything unlawful.',
    ],
  },
  {
    heading: '4. No Guarantee and Limits of Liability',
    paras: [
      'CareerAiHub is a career-preparation tool. We do not guarantee a job, an interview or any particular result. To the extent the law allows, we are not liable for indirect or consequential loss from your use of the platform or your reliance on AI output. Nothing here limits rights that the law does not allow to be limited.',
    ],
  },
  {
    heading: '5. Changes and Ending',
    paras: [
      'We may change these Terms or the service; continued use after a change means you accept it. We may suspend accounts that break these Terms. You can stop using the platform and ask us to delete your data at any time.',
    ],
  },
  {
    heading: '6. Contact',
    paras: ['Questions about these Terms: ' + LEGAL_EMAIL + '. The company is not registered yet; the operator, governing law and courts will be stated here once it is.'],
  },
];
