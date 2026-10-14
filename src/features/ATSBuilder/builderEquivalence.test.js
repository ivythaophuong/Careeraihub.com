import { describe, it, expect } from 'vitest';
import { computeDeterministicScore } from '../../scoring/computeDeterministicScore';
import { scoreBuilderData } from './builderText.js';

// Same synthetic resume written two ways: as the text of an uploaded file, and as Builder data.
// The Builder score is meant to be the upload score of the same content; these cases show where it is and where it is not.
const mk = (jobs, skills=['SQL','Excel','Python'], edu=[{institution:'State University',degree:'BSc Economics',year:'2016'}]) => ({contact:{name:'Jordan A. Lee',email:'jordan@example.com',phone:'+1 555 0100',location:'Austin, TX'},summary:'Operations analyst with reporting experience.',experience:jobs,education:edu,skills});
const J=(company,title,period,bullets)=>({company,title,period,bullets});
const cases = [
 { name:'standard-bullets-dot', data: mk([J('Acme Corp','Senior Analyst','Jan 2020 - Mar 2023',['Cut report time by 30% across 4 teams','Built 3 dashboards']),J('Beta Ltd','Analyst','Jun 2017 - Dec 2019',['Reduced errors by 25%'])]),
   text:`Jordan A. Lee\njordan@example.com | +1 555 0100 | Austin, TX\n\nSUMMARY\nOperations analyst with reporting experience.\n\nEXPERIENCE\nSenior Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30% across 4 teams\n• Built 3 dashboards\n\nAnalyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%\n\nEDUCATION\nBSc Economics, State University, 2016\n\nSKILLS\nSQL, Excel, Python\n`},
 { name:'present-and-year-only', data: mk([J('Acme Corp','Senior Analyst','2020 - Present',['Cut report time by 30%','Managed 5 reports']),J('Beta Ltd','Analyst','2017 - 2020',['Reduced errors by 25%'])]),
   text:`Jordan A. Lee\n+1 555 0100 · jordan@example.com\n\nProfessional Experience\nAcme Corp — Senior Analyst (2020 – Present)\n- Cut report time by 30%\n- Managed 5 reports\nBeta Ltd — Analyst (2017 – 2020)\n- Reduced errors by 25%\n\nEducation\nState University — BSc Economics (2016)\n\nTechnical Skills\nSQL | Excel | Python\n`},
 { name:'no-bullet-markers', data: mk([J('Acme Corp','Senior Analyst','Jan 2020 - Mar 2023',['Cut report time by 30% across 4 teams','Built 3 dashboards'])]),
   text:`Jordan A. Lee\njordan@example.com\n\nWork Experience\nSenior Analyst | Acme Corp | Jan 2020 - Mar 2023\nCut report time by 30% across 4 teams\nBuilt 3 dashboards\n\nEducation\nBSc Economics, State University 2016\n\nSkills\nSQL, Excel, Python\n`},
 { name:'thin-no-numbers', data: mk([J('Acme Corp','Analyst','2020 - 2023',['Helped with reports','Worked with the team'])]),
   text:`Jordan A. Lee\njordan@example.com\n\nExperience\nAnalyst, Acme Corp, 2020 - 2023\n• Helped with reports\n• Worked with the team\n\nEducation\nState University, BSc Economics, 2016\n\nSkills\nSQL, Excel, Python\n`},
 { name:'no-skills-section', data: mk([J('Acme Corp','Analyst','2020 - 2023',['Cut costs by 12%'])],[]),
   text:`Jordan A. Lee\njordan@example.com\n\nExperience\nAnalyst, Acme Corp, 2020 - 2023\n• Cut costs by 12%\n\nEducation\nState University, BSc Economics, 2016\n`},
 { name:'student-edu-only', data: {contact:{name:'Sam Doe',email:'sam@example.com'},summary:'',experience:[],education:[{institution:'State University',degree:'BSc Economics',year:'2026'}],skills:['Excel','R']},
   text:`Sam Doe\nsam@example.com\n\nEducation\nBSc Economics, State University, 2026\n\nSkills\nExcel, R\n`},
 { name:'overlapping-dates', data: mk([J('Acme','Analyst','2019 - 2022',['Cut costs by 12%']),J('Beta','Consultant','2021 - 2023',['Served 4 clients'])]),
   text:`Jordan A. Lee\njordan@example.com\n\nExperience\nAnalyst, Acme, 2019 - 2022\n• Cut costs by 12%\nConsultant, Beta, 2021 - 2023\n• Served 4 clients\n\nEducation\nState University, BSc Economics, 2016\n\nSkills\nSQL, Excel, Python\n`},
];

const upload = (text) => computeDeterministicScore(text).score.score;

describe('Builder score vs upload score on the same content (synthetic resumes)', () => {
  for (const c of cases) {
    it(`${c.name}: same score`, () => {
      expect(scoreBuilderData(c.data).score).toBe(upload(c.text));
    });
  }
});
