// Synthetic resumes with known answers, for measuring the code extractor (src/extraction/resumeFacts.js) field by field.
// Every person, company and address is invented (example.com / 555 numbers). No real data, ever.
// `expect` lists only what the resume plainly states; a field not listed is not scored for that case.
// Dates are "YYYY-MM" (or "present"), matching normalized_value of the extractor.

export const CASES = [
  {
    id: 'c01-standard',
    layout: 'single column, standard headings',
    text: `Jordan Lee
jordan.lee@example.com | +65 5555 0100 | Singapore

Experience
Senior Product Analyst, Northwind Logistics
Mar 2022 - Present
- Built a weekly delivery report used by 6 regional managers
- Cut manual data entry by 40% by redesigning the intake spreadsheet

Product Analyst, Harbor Retail
Jun 2019 - Feb 2022
- Handled monthly KPI reporting for 8 stores

Education
BSc Business Administration, National University of Singapore, 2019

Skills
SQL, Excel, Power BI, Python, A/B testing
`,
    expect: {
      name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '+6555550100',
      experiences: [
        { title: 'Senior Product Analyst', company: 'Northwind Logistics', start: '2022-03', end: 'present' },
        { title: 'Product Analyst', company: 'Harbor Retail', start: '2019-06', end: '2022-02' },
      ],
      education: [{ institution: 'National University of Singapore', year: '2019' }],
      skills: ['SQL', 'Excel', 'Power BI', 'Python', 'A/B testing'],
      metricsMin: 3,
    },
  },
  {
    id: 'c02-company-first',
    layout: 'company before title, dash separator',
    text: `Maya Okafor
maya.okafor@example.com
+44 7700 900123

WORK EXPERIENCE
Brightwave Media — Content Strategist
January 2021 – December 2023
• Planned 120 articles a year across four verticals
• Grew newsletter subscribers from 8,000 to 21,000

Lumen Studio — Junior Copywriter
September 2018 – December 2020
• Wrote product copy for 30 clients

EDUCATION
University of Leeds — BA English Literature (2018)

SKILLS
Copywriting, SEO, Content planning, Google Analytics
`,
    expect: {
      name: 'Maya Okafor', email: 'maya.okafor@example.com', phone: '+447700900123',
      experiences: [
        { title: 'Content Strategist', company: 'Brightwave Media', start: '2021-01', end: '2023-12' },
        { title: 'Junior Copywriter', company: 'Lumen Studio', start: '2018-09', end: '2020-12' },
      ],
      education: [{ institution: 'University of Leeds', year: '2018' }],
      skills: ['Copywriting', 'SEO', 'Content planning', 'Google Analytics'],
      metricsMin: 2,
    },
  },
  {
    id: 'c03-two-roles-one-company',
    layout: 'two titles under one employer',
    text: `Daniel Reyes
daniel.reyes@example.com | 555-0142 | Manila

Experience
Cobalt Payments
Operations Lead
Apr 2022 - Present
- Managed a team of 9 support agents
Operations Analyst
Feb 2020 - Mar 2022
- Reduced average ticket resolution time from 30 hours to 18 hours

Education
BS Industrial Engineering, De La Salle University, 2019

Skills
Excel, SQL, Tableau, Process improvement
`,
    expect: {
      name: 'Daniel Reyes', email: 'daniel.reyes@example.com',
      experiences: [
        { title: 'Operations Lead', company: 'Cobalt Payments', start: '2022-04', end: 'present' },
        { title: 'Operations Analyst', company: 'Cobalt Payments', start: '2020-02', end: '2022-03' },
      ],
      education: [{ institution: 'De La Salle University', year: '2019' }],
      skills: ['Excel', 'SQL', 'Tableau', 'Process improvement'],
      metricsMin: 2,
    },
  },
  {
    id: 'c04-numeric-dates',
    layout: 'numeric date formats',
    text: `Priya Nair
priya.nair@example.com | +91 98765 00000

Experience
Data Engineer, Orchid Systems
03/2021 - 11/2023
- Built ETL pipelines processing 2M rows per day

Software Intern, Orchid Systems
06/2020 - 09/2020
- Wrote unit tests for the billing module

Education
B.Tech Computer Science, Anna University, 2020

Skills
Python, Airflow, SQL, Docker
`,
    expect: {
      name: 'Priya Nair', email: 'priya.nair@example.com',
      experiences: [
        { title: 'Data Engineer', company: 'Orchid Systems', start: '2021-03', end: '2023-11' },
        { title: 'Software Intern', company: 'Orchid Systems', start: '2020-06', end: '2020-09' },
      ],
      education: [{ institution: 'Anna University', year: '2020' }],
      skills: ['Python', 'Airflow', 'SQL', 'Docker'],
      metricsMin: 1,
    },
  },
  {
    id: 'c05-overlapping',
    layout: 'two concurrent roles',
    text: `Sam Whitaker
sam.whitaker@example.com | +1 555 0177

Experience
Marketing Manager, Pinecrest Foods
Jan 2021 - Present
- Launched 3 regional campaigns that increased sales by 15%

Freelance Designer, Self-employed
Jun 2021 - Present
- Designed packaging for 5 small brands

Education
BA Communications, State University, 2016

Skills
Branding, Adobe Illustrator, Campaign planning
`,
    expect: {
      name: 'Sam Whitaker', email: 'sam.whitaker@example.com',
      experiences: [
        { title: 'Marketing Manager', company: 'Pinecrest Foods', start: '2021-01', end: 'present' },
        { title: 'Freelance Designer', company: 'Self-employed', start: '2021-06', end: 'present' },
      ],
      education: [{ institution: 'State University', year: '2016' }],
      skills: ['Branding', 'Adobe Illustrator', 'Campaign planning'],
      metricsMin: 2,
    },
  },
  {
    id: 'c06-gap-and-year-only',
    layout: 'years only, with a gap',
    text: `Lena Fischer
lena.fischer@example.com | +49 151 5550000 | Berlin

Experience
Project Coordinator, Alder Architects
2018 - 2020
- Coordinated 12 building permit applications

Office Manager, Birch & Co
2022 - 2024
- Introduced a shared calendar for 15 staff

Education
Diploma in Business Administration, Berlin School of Economics, 2017

Skills
Scheduling, Budgeting, Stakeholder communication
`,
    expect: {
      name: 'Lena Fischer', email: 'lena.fischer@example.com',
      experiences: [
        { title: 'Project Coordinator', company: 'Alder Architects', start: '2018', end: '2020' },
        { title: 'Office Manager', company: 'Birch & Co', start: '2022', end: '2024' },
      ],
      education: [{ institution: 'Berlin School of Economics', year: '2017' }],
      skills: ['Scheduling', 'Budgeting', 'Stakeholder communication'],
      metricsMin: 2,
    },
  },
  {
    id: 'c07-no-contact-block',
    layout: 'no email or phone at all',
    text: `Chidi Mensah

Experience
Sales Associate, Riverstone Outfitters
May 2023 - Present
- Served about 60 customers a day

Education
High School Diploma, Central High School, 2022

Skills
Customer service, Cash handling, Inventory
`,
    expect: {
      name: 'Chidi Mensah', email: null, phone: null,
      experiences: [{ title: 'Sales Associate', company: 'Riverstone Outfitters', start: '2023-05', end: 'present' }],
      education: [{ institution: 'Central High School', year: '2022' }],
      skills: ['Customer service', 'Cash handling', 'Inventory'],
      metricsMin: 1,
    },
  },
  {
    id: 'c08-skills-list-duplicates',
    layout: 'bulleted skills with a duplicate and a synonym',
    text: `Amara Singh
amara.singh@example.com | +61 400 000 000

Experience
QA Engineer, Kestrel Software
Aug 2020 - Jul 2023
- Automated 400 regression tests

Education
BSc Information Technology, Monash University, 2020

Technical Skills
- Selenium
- selenium
- Test automation
- Python
- Jira
`,
    expect: {
      name: 'Amara Singh', email: 'amara.singh@example.com',
      experiences: [{ title: 'QA Engineer', company: 'Kestrel Software', start: '2020-08', end: '2023-07' }],
      education: [{ institution: 'Monash University', year: '2020' }],
      skills: ['Selenium', 'Test automation', 'Python', 'Jira'],
      skillsUnique: true,
      metricsMin: 1,
    },
  },
  {
    id: 'c09-metrics-variety',
    layout: 'figures with and without symbols',
    text: `Tomás Herrera
tomas.herrera@example.com | +34 600 000 000

Experience
Account Executive, Solara Energy
Mar 2019 - Dec 2022
- Closed $1.2M in new contracts in 2021
- Doubled the pipeline (3x) within 18 months
- Cut onboarding from 6 hours to 2 hours per client

Education
BBA, ESADE, 2018

Skills
Negotiation, CRM, Forecasting
`,
    expect: {
      name: 'Tomás Herrera', email: 'tomas.herrera@example.com',
      experiences: [{ title: 'Account Executive', company: 'Solara Energy', start: '2019-03', end: '2022-12' }],
      education: [{ institution: 'ESADE', year: '2018' }],
      skills: ['Negotiation', 'CRM', 'Forecasting'],
      metricsMin: 4,
    },
  },
  {
    id: 'c10-one-paragraph',
    layout: 'structure lost: the whole resume as one paragraph',
    text: `Noor Hassan noor.hassan@example.com +971 50 000 0000 Experience Support Specialist, Dune Telecom Jan 2022 - Present Resolved 25 customer cases a day Education BA Psychology, American University of Sharjah, 2021 Skills Communication, Troubleshooting, CRM`,
    expect: {
      name: 'Noor Hassan', email: 'noor.hassan@example.com',
      experiences: [{ title: 'Support Specialist', company: 'Dune Telecom', start: '2022-01', end: 'present' }],
      education: [{ institution: 'American University of Sharjah', year: '2021' }],
      skills: ['Communication', 'Troubleshooting', 'CRM'],
      metricsMin: 1,
      // A resume with lost layout: an honest extractor may return null with requiresInterpretation; a confident wrong value is the failure.
      lostLayout: true,
    },
  },
  {
    id: 'c11-founder',
    layout: 'founder, self-described roles',
    text: `Elif Demir
elif.demir@example.com | +90 500 000 0000

Experience
Founder, Studio Nine
Oct 2020 - Present
- Built a team of 6 and signed 14 clients

Product Designer, Mosaic Labs
Jul 2017 - Sep 2020
- Redesigned the onboarding flow, lifting completion by 22%

Education
BFA Graphic Design, Istanbul Technical University, 2017

Skills
Figma, User research, Prototyping
`,
    expect: {
      name: 'Elif Demir', email: 'elif.demir@example.com',
      experiences: [
        { title: 'Founder', company: 'Studio Nine', start: '2020-10', end: 'present' },
        { title: 'Product Designer', company: 'Mosaic Labs', start: '2017-07', end: '2020-09' },
      ],
      education: [{ institution: 'Istanbul Technical University', year: '2017' }],
      skills: ['Figma', 'User research', 'Prototyping'],
      metricsMin: 3,
    },
  },
  {
    id: 'c12-summary-and-certs',
    layout: 'summary, certifications and a long skills line',
    text: `Hannah Brooks
hannah.brooks@example.com | +1 555 0188 | Austin, TX

Summary
Finance analyst with 6 years of experience in forecasting and reporting.

Experience
Financial Analyst, Meridian Capital
Feb 2018 - Present
- Maintained a 24-month forecast model used by 3 executives

Education
BBA Finance, University of Texas, 2017

Certifications
CFA Level II Candidate
Skills
Financial modelling, Excel, VBA, Power BI, Forecasting, Variance analysis
`,
    expect: {
      name: 'Hannah Brooks', email: 'hannah.brooks@example.com',
      experiences: [{ title: 'Financial Analyst', company: 'Meridian Capital', start: '2018-02', end: 'present' }],
      education: [{ institution: 'University of Texas', year: '2017' }],
      skills: ['Financial modelling', 'Excel', 'VBA', 'Power BI', 'Forecasting', 'Variance analysis'],
      metricsMin: 1,
    },
  },
];
