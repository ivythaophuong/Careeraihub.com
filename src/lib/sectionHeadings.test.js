import { describe, it, expect } from 'vitest';
import { splitSections } from './resumeDigest';
import { classifyHeading } from './sectionHeadings';
import { extractResumeFacts } from '../extraction/resumeFacts';
import { computeDeterministicScore } from '../scoring/computeDeterministicScore';
import { describePart } from './describeScorePart';

const names = (text) => splitSections(text).map((s) => s.name);
const sectionOf = (heading) => names(`${heading}\nbody`)[1] ?? 'header';

// What splitSections returned for each of these headings BEFORE the classifier existed (captured from the code on main).
// The classifier is only a fallback for lines the exact table does not know, so none of these may change.
const BEFORE = {
  "Summary": "summary",
  "Profile": "profile",
  "Objective": "objective",
  "About me": "about me",
  "Experience": "experience",
  "Work Experience": "work experience",
  "Professional Experience": "professional experience",
  "Employment": "employment",
  "Employment History": "employment history",
  "Projects": "projects",
  "Project": "project",
  "Skills": "skills",
  "Skill": "skill",
  "Technical Skills": "technical skills",
  "Core Competencies": "core competencies",
  "Education": "education",
  "Certifications": "certifications",
  "Certification": "certification",
  "Licenses": "licenses",
  "License": "license",
  "Awards": "awards",
  "Award": "award",
  "Publications": "publications",
  "Languages": "languages",
  "Language": "language",
  "Volunteer": "volunteer",
  "Volunteering": "volunteering",
  "Volunteer Experience": "volunteer experience",
  "Interests": "interests",
  "Contact": "contact",
  "Contact Info": "contact info",
  "Contact Information": "contact information",
  "Contact Details": "contact details",
  "Personal Information": "personal information",
  "Personal Details": "personal details",
  "Personal Info": "personal info",
  "Work History": "work experience",
  "Career History": "work experience",
  "Professional History": "work experience",
  "Professional Background": "work experience",
  "Relevant Experience": "work experience",
  "Academic Background": "education",
  "Academic Qualifications": "education",
  "Educational Background": "education",
  "Education & Training": "education",
  "Key Skills": "skills",
  "Skills & Tools": "skills",
  "Professional Summary": "summary",
  "Career Objective": "summary",
  "Career Summary": "summary",
  "Kỹ năng": "skills",
  "Học vấn": "education",
  "Kinh nghiệm làm việc": "work experience",
  "Chứng chỉ": "certifications",
  "Dự án": "projects",
  "SKILLS": "skills",
  "EXPERIENCE:": "experience",
  "education :": "education",
};

describe('headings that were already recognised are read exactly as before', () => {
  it.each(Object.entries(BEFORE))('%s', (heading, expected) => {
    expect(sectionOf(heading)).toBe(expected);
  });
});

describe('headings in other wordings are recognised as the section they stand for', () => {
  it.each([
    ['Technical Skills & Tools', 'skills'],
    ['Technical Skills and Tools', 'skills'],
    ['Core Skills', 'skills'],
    ['Skills and Tools', 'skills'],
    ['Areas of Expertise', 'skills'],
    ['TECHNICAL PROFICIENCIES', 'skills'],
    ['Technologies & Tools:', 'skills'],
    ['Tech Stack', 'skills'],
    ['Selected Professional Experience', 'work experience'],
    ['Industry Experience', 'work experience'],
    ['Relevant Work Experience', 'work experience'],
    ['Research Experience', 'work experience'],
    ['Other Experience', 'work experience'],
    ['Education and Qualifications', 'education'],
    ['Licenses & Certifications', 'certifications'],
    ['Professional Certifications', 'certifications'],
    ['Selected Projects', 'projects'],
    ['Personal Projects', 'projects'],
    ['Professional Profile', 'summary'],
  ])('%s -> %s', (heading, expected) => {
    expect(classifyHeading(heading)?.canonical).toBe(expected);
    expect(sectionOf(heading)).toBe(expected);
  });
});

describe('lines that are NOT headings stay body text', () => {
  it.each([
    'Tools',                                                  // a lone generic word is a label inside a skills list, not a new section
    'Technologies',
    'Strengths',
    'Research',                                               // a lone generic word is not a section
    'Other',
    'Research and Education',                                 // two different sections: ambiguous
    'Skills and Experience',                                  // two different sections: ambiguous, so not a heading
    'Education and Certifications',
    'Skills: SQL, Excel',                                     // heading word followed by content
    'Top 5 skills',                                           // digits
    'Built a skills assessment tool for the team.',           // a sentence
    'Responsible for tools and technologies used across the stack',
    'Skills.',
    'Strong technical skills and a good eye for detail in all my work',  // too long
    'jordan.lee@example.com',
  ])('%s', (line) => {
    expect(classifyHeading(line)).toBeNull();
    expect(sectionOf(line)).toBe('header'); // it stays inside the header text, no new section
  });
});

describe('a CV whose skills heading is worded differently is read as having skills', () => {
  const cv = (skillsHeading) => `Jordan Lee
jordan.lee@example.com | +65 5555 0100 | Singapore

Experience
Product Analyst, Northwind Logistics
Mar 2022 - Present
- Built a weekly report used by 6 regional managers

Education
BSc Business Administration, 2019

${skillsHeading}
SQL, Excel, Power BI, Python
`;
  it('"Technical Skills & Tools" gives the same skills and the same checklist as "Skills"', () => {
    const a = extractResumeFacts(cv('Skills')).skills.map((s) => s.value);
    const b = extractResumeFacts(cv('Technical Skills & Tools')).skills.map((s) => s.value);
    expect(b).toEqual(a);
    expect(b.length).toBeGreaterThan(0);
    const items = (t) => describePart(computeDeterministicScore(t).score.parts.find((p) => p.id === 'completeness')).items;
    expect(items(cv('Technical Skills & Tools'))).toEqual(items(cv('Skills')));
    expect(items(cv('Technical Skills & Tools')).find((i) => i.label === 'Skills').ok).toBe(true);
  });
});

describe('compound skills headings and labels nested inside a job', () => {
  it.each([
    ['LANGUAGES AND SKILLS', 'skills'],
    ['Skills & Languages', 'skills'],
    ['Programming Languages', 'skills'],
    ['Languages and Technical Skills', 'skills'],
  ])('%s is read as the skills section', (heading, expected) => {
    expect(classifyHeading(heading)?.canonical).toBe(expected);
    expect(sectionOf(heading)).toBe(expected);
  });

  it('a plain "Languages" heading is still the languages section, and "Languages and Interests" is ambiguous, so not a heading', () => {
    expect(sectionOf('Languages')).toBe('languages');
    expect(classifyHeading('Languages and Interests')).toBeNull();
  });

  const cv = (nested) => `Alex Morgan
alex@example.com

Work Experience
Northwind Advisory Singapore
Associate Director, M&A, December 2021 - present
- Led diligence on a USD 250M acquisition
${nested}
- Built the valuation model used by the deal team
Harbor Capital Singapore
Senior Associate, June 2017 - November 2021
- Advised on 12 transactions
Education
BSc Finance, 2013
LANGUAGES AND SKILLS
Skills: Financial modelling, Valuation, Excel, Python
`;
  const read = (t) => { const f = extractResumeFacts(t); return { jobs: f.experiences.length, bullets: f.experiences.reduce((n, e) => n + e.bullets.length, 0), skills: f.skills.length }; };

  it('a label like "Key projects:" inside a job stays in the job: no job or bullet is cut away', () => {
    const withLabel = read(cv('Key projects:'));
    const withoutLabel = read(cv('Notable work:'));
    expect(withLabel).toEqual(withoutLabel);
    expect(withLabel.jobs).toBe(2);
    expect(withLabel.bullets).toBeGreaterThanOrEqual(3); // the extractor also counts the line under a job's date line; what matters is that the label changes nothing
  });

  it('the skills under "LANGUAGES AND SKILLS" are found', () => {
    expect(read(cv('Key projects:')).skills).toBe(4);
  });

  it('a real projects heading is still a heading outside an experience section, and an exact "Projects" heading still splits', () => {
    expect(sectionOf('Selected Projects')).toBe('projects');
    const t = 'Work Experience\nAnalyst, Acme\nJan 2020 - Present\n- Built a report\nProjects\nPersonal site\n- Built a site\n';
    expect(splitSections(t).map((s) => s.name)).toEqual(['header', 'work experience', 'projects']);
  });
});
