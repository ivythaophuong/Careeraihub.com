// Second corpus (B): layouts and wording that differ from corpus A on purpose. Written AFTER the extractor was tuned on corpus A,
// and not used to tune it; any fix made because of a failure here makes corpus B a regression set, not a fresh measurement.
// Same rules as corpus A: every person, company and address is invented. Dates are "YYYY-MM", "YYYY" or "present".

export const CASES_B = [
  {
    id: 'b01-caps-headings-alt-names',
    layout: 'ALL CAPS headings with alternative names',
    text: `MARÍA JOSÉ DE LA CRUZ
maria.cruz+jobs@example.com · (415) 555-0132 · San Francisco, CA

PROFESSIONAL BACKGROUND
Customer Success Manager | Tidewater Software
Sept 2020 – Present
• Owned a portfolio of 35 enterprise accounts worth $4.5M in annual revenue
• Reduced churn from 9% to 6% in one year

Customer Support Lead — Harbor Labs
Aug 2017 – Aug 2020
• Trained 14 new hires

ACADEMIC BACKGROUND
BA Sociology, University of California, Berkeley, 2017

CORE SKILLS
Account management, Onboarding, Salesforce, Zendesk
`,
    expect: {
      name: 'María José de la Cruz', email: 'maria.cruz+jobs@example.com', phone: '4155550132',
      experiences: [
        { title: 'Customer Success Manager', company: 'Tidewater Software', start: '2020-09', end: 'present' },
        { title: 'Customer Support Lead', company: 'Harbor Labs', start: '2017-08', end: '2020-08' },
      ],
      education: [{ institution: 'University of California, Berkeley', year: '2017' }],
      skills: ['Account management', 'Onboarding', 'Salesforce', 'Zendesk'],
      metricsMin: 3,
    },
  },
  {
    id: 'b02-career-history-pipe-dates',
    layout: 'dates on the same line after a pipe, "to date"',
    text: `Jean-Luc O'Neil
jeanluc.oneil@example.com | +33 6 55 55 01 02 | Lyon, France

CAREER HISTORY
Senior Software Engineer II | Kite Analytics | 2021 – to date
- Designed a streaming ingestion service handling 40k events per second
- Mentored 5 junior engineers

Software Engineer | Kite Analytics | 2018 – 2021
- Migrated 12 services to Kubernetes

EDUCATION
MSc Computer Science, INSA Lyon, 2018

SKILLS
Go, Kafka, Kubernetes, PostgreSQL
`,
    expect: {
      name: "Jean-Luc O'Neil", email: 'jeanluc.oneil@example.com', phone: '+33655550102',
      experiences: [
        { title: 'Senior Software Engineer II', company: 'Kite Analytics', start: '2021', end: 'present' },
        { title: 'Software Engineer', company: 'Kite Analytics', start: '2018', end: '2021' },
      ],
      education: [{ institution: 'INSA Lyon', year: '2018' }],
      skills: ['Go', 'Kafka', 'Kubernetes', 'PostgreSQL'],
      metricsMin: 3,
    },
  },
  {
    id: 'b03-categorised-skills',
    layout: 'skills grouped under category labels',
    text: `Wei Zhang
wei.zhang@example.com | +86 138 0000 0000

Experience
Data Scientist, Lotus Retail
Mar 2020 - Present
- Built a demand forecasting model that cut stock-outs by 18%

Education
MS Statistics, Example University, 2020

Skills
Languages: Python, R, SQL
Tools: Tableau, Airflow, dbt
`,
    expect: {
      name: 'Wei Zhang', email: 'wei.zhang@example.com',
      experiences: [{ title: 'Data Scientist', company: 'Lotus Retail', start: '2020-03', end: 'present' }],
      education: [{ institution: 'Example University', year: '2020' }],
      skills: ['Python', 'R', 'SQL', 'Tableau', 'Airflow', 'dbt'],
      metricsMin: 1,
    },
  },
  {
    id: 'b04-wrapped-bullets',
    layout: 'bullets wrapped onto continuation lines, en-dash glyphs',
    text: `Olivia Grant
olivia.grant@example.com | +61 2 5550 0100

Work Experience
Registered Nurse, Cedar Valley Hospital
Jan 2019 - Present
– Provided care for up to 12 patients per shift on a
  busy surgical ward
– Coordinated discharge plans with 3 social workers
  and the patients' families

Education
Bachelor of Nursing, University of Sydney, 2018

Skills
Patient assessment, Wound care, Electronic health records
`,
    expect: {
      name: 'Olivia Grant', email: 'olivia.grant@example.com',
      experiences: [{ title: 'Registered Nurse', company: 'Cedar Valley Hospital', start: '2019-01', end: 'present' }],
      education: [{ institution: 'University of Sydney', year: '2018' }],
      skills: ['Patient assessment', 'Wound care', 'Electronic health records'],
      metricsMin: 2,
    },
  },
  {
    id: 'b05-two-columns-interleaved',
    layout: 'two-column resume read left-to-right (sidebar lines interleaved)',
    text: `Ahmed Khalil                          SKILLS
ahmed.khalil@example.com              Project planning
+20 100 555 0100                      Budgeting
                                       Risk management

EXPERIENCE                            EDUCATION
Project Manager, Delta Build          BSc Civil Engineering
Feb 2018 - Present                    Cairo University, 2014
- Delivered 6 projects on budget
`,
    expect: {
      name: 'Ahmed Khalil', email: 'ahmed.khalil@example.com',
      experiences: [{ title: 'Project Manager', company: 'Delta Build', start: '2018-02', end: 'present' }],
      education: [{ institution: 'Cairo University', year: '2014' }],
      skills: ['Project planning', 'Budgeting', 'Risk management'],
      metricsMin: 1,
    },
  },
  {
    id: 'b06-tab-table',
    layout: 'tab separated table rows',
    text: `Sofia Rossi
sofia.rossi@example.com\t+39 333 555 0100

Experience
Role\tEmployer\tDates
Graphic Designer\tStudio Verde\tApr 2021 - Present
Junior Designer\tPixel House\tJul 2018 - Mar 2021

Education
BA Design, Politecnico di Milano, 2018

Skills
Illustration, Typography, Adobe Photoshop
`,
    expect: {
      name: 'Sofia Rossi', email: 'sofia.rossi@example.com',
      experiences: [
        { title: 'Graphic Designer', company: 'Studio Verde', start: '2021-04', end: 'present' },
        { title: 'Junior Designer', company: 'Pixel House', start: '2018-07', end: '2021-03' },
      ],
      education: [{ institution: 'Politecnico di Milano', year: '2018' }],
      skills: ['Illustration', 'Typography', 'Adobe Photoshop'],
      metricsMin: 0,
    },
  },
  {
    id: 'b07-intern-and-gpa',
    layout: 'student: internships, GPA, no full-time job',
    text: `Ethan Park
ethan.park@example.com | +1 555 0166 | Seattle, WA

Education
BS Computer Science, University of Washington, 2024
GPA 3.8 / 4.0

Experience
Software Engineering Intern, Cascade Cloud
Jun 2023 - Aug 2023
- Built a dashboard used by 40 engineers

Teaching Assistant, University of Washington
Sep 2022 - Jun 2023
- Graded assignments for 120 students

Skills
Java, Python, React
`,
    expect: {
      name: 'Ethan Park', email: 'ethan.park@example.com',
      experiences: [
        { title: 'Software Engineering Intern', company: 'Cascade Cloud', start: '2023-06', end: '2023-08' },
        { title: 'Teaching Assistant', company: 'University of Washington', start: '2022-09', end: '2023-06' },
      ],
      education: [{ institution: 'University of Washington', year: '2024' }],
      skills: ['Java', 'Python', 'React'],
      metricsMin: 2,
    },
  },
  {
    id: 'b08-career-break',
    layout: 'a stated career break and a current role "Current"',
    text: `Rachel Cohen
rachel.cohen@example.com | +44 20 7946 0000

Employment History
Finance Manager, Oakridge Group
Mar 2023 - Current
- Led the annual budget for 4 departments

Career Break (family care)
Jan 2021 - Feb 2023

Finance Analyst, Oakridge Group
Jul 2016 - Dec 2020
- Produced monthly reports for 9 stakeholders

Education
BSc Accounting, University of Manchester, 2016

Skills
Budgeting, Reporting, SAP
`,
    expect: {
      name: 'Rachel Cohen', email: 'rachel.cohen@example.com',
      experiences: [
        { title: 'Finance Manager', company: 'Oakridge Group', start: '2023-03', end: 'present' },
        { title: 'Finance Analyst', company: 'Oakridge Group', start: '2016-07', end: '2020-12' },
      ],
      education: [{ institution: 'University of Manchester', year: '2016' }],
      skills: ['Budgeting', 'Reporting', 'SAP'],
      metricsMin: 2,
    },
  },
  {
    id: 'b09-company-with-suffix-and-comma',
    layout: 'company names with Inc., Ltd. and an ampersand',
    text: `Victor Lindqvist
victor.lindqvist@example.com | +46 70 555 01 00

Experience
Operations Manager, Nordic Freight & Co., Ltd.
Oct 2019 - Present
- Ran a warehouse of 55 staff

Logistics Coordinator, Baltic Shipping Inc.
Feb 2015 - Sep 2019
- Scheduled 200 shipments a month

Education
BSc Logistics, Chalmers University of Technology, 2014

Skills
Logistics, Supply chain, SAP
`,
    expect: {
      name: 'Victor Lindqvist', email: 'victor.lindqvist@example.com',
      experiences: [
        { title: 'Operations Manager', company: 'Nordic Freight & Co., Ltd.', start: '2019-10', end: 'present' },
        { title: 'Logistics Coordinator', company: 'Baltic Shipping Inc.', start: '2015-02', end: '2019-09' },
      ],
      education: [{ institution: 'Chalmers University of Technology', year: '2014' }],
      skills: ['Logistics', 'Supply chain', 'SAP'],
      metricsMin: 2,
    },
  },
  {
    id: 'b10-two-degrees',
    layout: 'two degrees and certifications',
    text: `Fatima Zahra
fatima.zahra@example.com | +212 600 000000

Experience
Research Scientist, Atlas Biotech
Sep 2021 - Present
- Authored 4 papers and filed 2 patents

Education
PhD Chemistry, Mohammed V University, 2021
MSc Chemistry, Mohammed V University, 2017

Certifications
Good Laboratory Practice (GLP)

Skills
Chromatography, Mass spectrometry, Python
`,
    expect: {
      name: 'Fatima Zahra', email: 'fatima.zahra@example.com',
      experiences: [{ title: 'Research Scientist', company: 'Atlas Biotech', start: '2021-09', end: 'present' }],
      education: [
        { institution: 'Mohammed V University', year: '2021' },
        { institution: 'Mohammed V University', year: '2017' },
      ],
      skills: ['Chromatography', 'Mass spectrometry', 'Python'],
      metricsMin: 2,
    },
  },
  {
    id: 'b11-lowercase-and-urls',
    layout: 'plain text, lower-case headings, several links',
    text: `Kenji Tanaka
kenji.tanaka@example.com | +81 90 5550 0100
github.com/kenji-example | linkedin.com/in/kenji-tanaka-example | kenji.example.dev

summary
Backend developer who likes small, well tested services.

experience
Backend Developer, Sakura Pay
Apr 2020 - Present
- Cut p95 latency of the payments API from 800ms to 250ms

education
BE Information Engineering, Example Institute of Technology, 2020

skills
Rust, Go, PostgreSQL
`,
    expect: {
      name: 'Kenji Tanaka', email: 'kenji.tanaka@example.com', phone: '+819055500100',
      experiences: [{ title: 'Backend Developer', company: 'Sakura Pay', start: '2020-04', end: 'present' }],
      education: [{ institution: 'Example Institute of Technology', year: '2020' }],
      skills: ['Rust', 'Go', 'PostgreSQL'],
      metricsMin: 1,
    },
  },
  {
    id: 'b12-title-with-parentheses-and-slash',
    layout: 'titles with slashes and parentheses',
    text: `Isabella Moretti
isabella.moretti@example.com | +39 02 5550 0100

Experience
Marketing & Communications Manager (Maternity cover), Aurora Foods
Jan 2022 - Dec 2022
- Ran 8 campaigns across 3 channels

Content Writer / Social Media Lead, Aurora Foods
Mar 2019 - Dec 2021
- Grew followers from 5,000 to 30,000

Education
BA Communication Sciences, University of Milan, 2018

Skills
Content strategy, Social media, Copywriting
`,
    expect: {
      name: 'Isabella Moretti', email: 'isabella.moretti@example.com',
      experiences: [
        { title: 'Marketing & Communications Manager (Maternity cover)', company: 'Aurora Foods', start: '2022-01', end: '2022-12' },
        { title: 'Content Writer / Social Media Lead', company: 'Aurora Foods', start: '2019-03', end: '2021-12' },
      ],
      education: [{ institution: 'University of Milan', year: '2018' }],
      skills: ['Content strategy', 'Social media', 'Copywriting'],
      metricsMin: 3,
    },
  },
];
