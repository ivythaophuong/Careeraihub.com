// Third corpus (C): written BEFORE the fixes for the failures found in corpus B, so it can measure them on text the fixes were not
// written against. Rule for whoever works on the extractor: fix causes found in A and B, not failures read off C. Look at C only as
// the summary counts; once C's individual failures are used to tune the extractor, C becomes a regression set and a corpus D is needed.
// All people, companies and numbers are invented. Dates "YYYY-MM", "YYYY" or "present".

export const CASES_C = [
  {
    id: 'z01-at-sign-and-parenthesised-dates',
    layout: '"Title @ Company (dates)" on one line',
    text: `Naomi Adeyemi
naomi.adeyemi@example.com | +234 803 555 0100 | Lagos

Experience
Product Designer @ Greenline Mobility (Jan 2021 – Present)
- Redesigned the rider app, lifting weekly active riders by 14%
Visual Designer @ Hexa Agency (Feb 2018 – Dec 2020)
- Delivered branding for 20 clients

Education
BA Fine Art, University of Lagos, 2017

Skills
Figma, Branding, Prototyping
`,
    expect: {
      name: 'Naomi Adeyemi', email: 'naomi.adeyemi@example.com',
      experiences: [
        { title: 'Product Designer', company: 'Greenline Mobility', start: '2021-01', end: 'present' },
        { title: 'Visual Designer', company: 'Hexa Agency', start: '2018-02', end: '2020-12' },
      ],
      education: [{ institution: 'University of Lagos', year: '2017' }],
      skills: ['Figma', 'Branding', 'Prototyping'],
      metricsMin: 2,
    },
  },
  {
    id: 'z02-markdown-table',
    layout: 'experience as a pipe table',
    text: `Pedro Almeida
pedro.almeida@example.com | +351 912 555 010

Experience
| Role | Employer | Dates |
| Site Engineer | Costa Build | Mar 2019 - Present |
| Trainee Engineer | Atlantic Works | Sep 2017 - Feb 2019 |

Education
BEng Civil Engineering, University of Porto, 2017

Skills
AutoCAD, Site supervision, Scheduling
`,
    expect: {
      name: 'Pedro Almeida', email: 'pedro.almeida@example.com',
      experiences: [
        { title: 'Site Engineer', company: 'Costa Build', start: '2019-03', end: 'present' },
        { title: 'Trainee Engineer', company: 'Atlantic Works', start: '2017-09', end: '2019-02' },
      ],
      education: [{ institution: 'University of Porto', year: '2017' }],
      skills: ['AutoCAD', 'Site supervision', 'Scheduling'],
      metricsMin: 0,
    },
  },
  {
    id: 'z03-sabbatical-between-jobs',
    layout: 'a sabbatical with its own dates between two jobs',
    text: `Grace Liu
grace.liu@example.com | +1 555 0123

Experience
Engineering Manager, Pylon Systems
Jun 2022 - Present
- Grew the team from 5 to 11 engineers

Sabbatical (travel and study)
Jan 2021 - May 2022

Senior Developer, Pylon Systems
Mar 2016 - Dec 2020
- Shipped 9 major releases

Education
BS Computer Science, Example State University, 2015

Skills
Leadership, Java, System design
`,
    expect: {
      name: 'Grace Liu', email: 'grace.liu@example.com',
      experiences: [
        { title: 'Engineering Manager', company: 'Pylon Systems', start: '2022-06', end: 'present' },
        { title: 'Senior Developer', company: 'Pylon Systems', start: '2016-03', end: '2020-12' },
      ],
      education: [{ institution: 'Example State University', year: '2015' }],
      skills: ['Leadership', 'Java', 'System design'],
      metricsMin: 2,
    },
  },
  {
    id: 'z04-phone-with-single-digit-group',
    layout: 'international number with a one-digit group',
    text: `Diego Salazar
diego.salazar@example.com
+52 1 55 5555 0100

Experience
Sales Representative, Mercado Verde
Aug 2021 - Present
- Visited 25 stores a week

Education
BBA, Tecnologico Example, 2021

Skills
Negotiation, CRM, Spanish
`,
    expect: {
      name: 'Diego Salazar', email: 'diego.salazar@example.com', phone: '+5215555550100',
      experiences: [{ title: 'Sales Representative', company: 'Mercado Verde', start: '2021-08', end: 'present' }],
      education: [{ institution: 'Tecnologico Example', year: '2021' }],
      skills: ['Negotiation', 'CRM', 'Spanish'],
      metricsMin: 1,
    },
  },
  {
    id: 'z05-indian-degrees',
    layout: 'BE and ME degrees',
    text: `Ananya Iyer
ananya.iyer@example.com | +91 90000 55501

Experience
Firmware Engineer, Quanta Devices
Jul 2019 - Present
- Cut boot time from 4 seconds to 1.5 seconds

Education
ME Embedded Systems, Example College of Engineering, 2019
BE Electronics and Communication, Example College of Engineering, 2017

Skills
C, RTOS, Embedded Linux
`,
    expect: {
      name: 'Ananya Iyer', email: 'ananya.iyer@example.com',
      experiences: [{ title: 'Firmware Engineer', company: 'Quanta Devices', start: '2019-07', end: 'present' }],
      education: [
        { institution: 'Example College of Engineering', year: '2019' },
        { institution: 'Example College of Engineering', year: '2017' },
      ],
      skills: ['C', 'RTOS', 'Embedded Linux'],
      metricsMin: 1,
    },
  },
  {
    id: 'z06-latency-figures',
    layout: 'figures in ms, s and rps',
    text: `Lucas Meyer
lucas.meyer@example.com | +49 30 5550 0100

Experience
Site Reliability Engineer, Nimbus Hosting
Nov 2020 - Present
- Brought p99 latency from 900ms to 180ms
- Raised throughput to 12k requests per second
- Cut deploy time from 40 minutes to 6 minutes

Education
MSc Informatics, Example Technical University, 2020

Skills
Linux, Terraform, Prometheus
`,
    expect: {
      name: 'Lucas Meyer', email: 'lucas.meyer@example.com',
      experiences: [{ title: 'Site Reliability Engineer', company: 'Nimbus Hosting', start: '2020-11', end: 'present' }],
      education: [{ institution: 'Example Technical University', year: '2020' }],
      skills: ['Linux', 'Terraform', 'Prometheus'],
      metricsMin: 3,
    },
  },
  {
    id: 'z07-two-column-sidebar',
    layout: 'sidebar contact and skills lines interleaved with the main column',
    text: `Hana Sato                     CONTACT
Account Executive             hana.sato@example.com
                               +81 80 5550 0100
EXPERIENCE                     SKILLS
Account Executive, Kobu Tech   Negotiation
Jan 2020 - Present             Pipeline management
- Closed 30 deals in a year    CRM
`,
    expect: {
      name: 'Hana Sato', email: 'hana.sato@example.com',
      experiences: [{ title: 'Account Executive', company: 'Kobu Tech', start: '2020-01', end: 'present' }],
      education: [],
      skills: ['Negotiation', 'Pipeline management', 'CRM'],
      metricsMin: 1,
    },
  },
  {
    id: 'z08-iso-and-dotted-dates',
    layout: 'ISO and dotted date formats',
    text: `Tariq Mahmood
tariq.mahmood@example.com | +92 300 5550100

Experience
Business Analyst, Indus Insights
2021-04 – 2024-02
- Mapped 15 processes and removed 6 redundant steps

Junior Analyst, Indus Insights
03.2019 – 03.2021
- Built 20 weekly reports

Education
BBA Management, Example Business School, 2018

Skills
Business analysis, SQL, Power BI
`,
    expect: {
      name: 'Tariq Mahmood', email: 'tariq.mahmood@example.com',
      experiences: [
        { title: 'Business Analyst', company: 'Indus Insights', start: '2021-04', end: '2024-02' },
        { title: 'Junior Analyst', company: 'Indus Insights', start: '2019-03', end: '2021-03' },
      ],
      education: [{ institution: 'Example Business School', year: '2018' }],
      skills: ['Business analysis', 'SQL', 'Power BI'],
      metricsMin: 2,
    },
  },
  {
    id: 'z09-the-company-and-ampersand-title',
    layout: '"The ..." company and a title with an ampersand',
    text: `Chloe Dubois
chloe.dubois@example.com | +33 1 55 50 01 00

Experience
Research & Insights Analyst, The Harbour Group
Feb 2020 - Present
- Ran 40 surveys with 10,000 respondents

Education
MA Sociology, Sorbonne Example, 2019

Skills
Survey design, SPSS, Data storytelling
`,
    expect: {
      name: 'Chloe Dubois', email: 'chloe.dubois@example.com',
      experiences: [{ title: 'Research & Insights Analyst', company: 'The Harbour Group', start: '2020-02', end: 'present' }],
      education: [{ institution: 'Sorbonne Example', year: '2019' }],
      skills: ['Survey design', 'SPSS', 'Data storytelling'],
      metricsMin: 2,
    },
  },
  {
    id: 'z10-languages-and-projects',
    layout: 'Languages, Projects and Volunteering sections after the job',
    text: `Marcus Bell
marcus.bell@example.com | +1 555 0190

Experience
Full Stack Developer, Brightpath
Sep 2019 - Present
- Built a booking platform used by 3,000 customers

Projects
Open source CLI for log parsing
2022 - 2023
- 400 stars on GitHub

Volunteering
Mentor, Code for Good
2020 - 2022

Education
BS Software Engineering, Example University, 2019

Skills
TypeScript, Node.js, PostgreSQL

Languages
English, French
`,
    expect: {
      name: 'Marcus Bell', email: 'marcus.bell@example.com',
      experiences: [{ title: 'Full Stack Developer', company: 'Brightpath', start: '2019-09', end: 'present' }],
      education: [{ institution: 'Example University', year: '2019' }],
      skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
      metricsMin: 1,
    },
  },
  {
    id: 'z11-entry-level',
    layout: 'entry level: education and skills only',
    text: `Zoe Williams
zoe.williams@example.com | +44 7700 900456

Education
BSc Biology, University of Bristol, 2025

Skills
Laboratory techniques, Data analysis, Teamwork
`,
    expect: {
      name: 'Zoe Williams', email: 'zoe.williams@example.com', phone: '+447700900456',
      experiences: [],
      education: [{ institution: 'University of Bristol', year: '2025' }],
      skills: ['Laboratory techniques', 'Data analysis', 'Teamwork'],
      metricsMin: 0,
    },
  },
  {
    id: 'z12-numbered-bullets-and-all-caps-company',
    layout: 'numbered achievements and an ALL CAPS company',
    text: `Omar Haddad
omar.haddad@example.com | +962 79 555 0100

Experience
Procurement Officer, ACME TRADING COMPANY
Mar 2018 - Present
1. Negotiated contracts saving 12% on annual spend
2. Managed 45 suppliers

Education
BA Economics, Example University of Jordan, 2017

Skills
Procurement, Negotiation, Excel
`,
    expect: {
      name: 'Omar Haddad', email: 'omar.haddad@example.com',
      experiences: [{ title: 'Procurement Officer', company: 'ACME TRADING COMPANY', start: '2018-03', end: 'present' }],
      education: [{ institution: 'Example University of Jordan', year: '2017' }],
      skills: ['Procurement', 'Negotiation', 'Excel'],
      metricsMin: 2,
    },
  },
];
