// Generates tests/fixtures/coach-eval/conversations.json: 20 synthetic multi-turn conversations for judging the AI Coach after the history window.
// Deterministic (no randomness, no AI, no real data). Run: node scripts/audit/coachEvalSet.mjs
import fs from 'node:fs';

const FILLER = [
  'How should I structure a two-minute introduction about myself?',
  'What is a good way to answer a question about a gap in my work history?',
  'How many bullet points should each job have on my resume?',
  'Should I include a summary at the top of my resume?',
  'How do I prepare for a behavioural interview in one evening?',
  'What should I ask the interviewer at the end?',
  'How do I follow up after an interview without being pushy?',
  'Is it better to apply early in the week or later?',
  'How do I describe a project I led but did not finish?',
  'What is the difference between a CV and a resume?',
  'How do I explain why I am leaving my current job?',
  'What should I do if I do not know the answer to a technical question?',
];

// Each case plants ONE fact early (turn 2) and later asks for something that needs it. A fact planted late (turn 10) is the control: it is still inside the window.
const FACTS = [
  { id: 'interview-company', plant: 'By the way, my interview is at Northwind Logistics next Thursday.', recall: 'Given what I told you about my interview, what should I prepare tonight?', expect: 'Northwind Logistics, next Thursday' },
  { id: 'salary-now', plant: 'For context, I currently earn 4,200 a month and I want to move up.', recall: 'What number should I aim for when they ask my expectations?', expect: '4,200 a month' },
  { id: 'remote-only', plant: 'I can only take remote roles because I care for a family member.', recall: 'Which of the roles we discussed should I prioritise?', expect: 'remote only' },
  { id: 'sql-years', plant: 'I have four years of SQL experience but no Python.', recall: 'Which skills should I show first on my resume?', expect: 'four years SQL, no Python' },
  { id: 'career-change', plant: 'I am changing careers from teaching into data analysis.', recall: 'How should I explain my background in the interview?', expect: 'teaching to data analysis' },
  { id: 'deadline', plant: 'I have to accept or decline another offer by the 20th.', recall: 'How should I schedule my applications this week?', expect: 'deadline the 20th' },
  { id: 'visa', plant: 'I need visa sponsorship, so that limits which employers I can apply to.', recall: 'How do I raise this in the first call?', expect: 'needs visa sponsorship' },
  { id: 'manager', plant: 'My current manager does not know I am looking, so references are a problem.', recall: 'Who should I list as references?', expect: 'manager does not know' },
  { id: 'team-size', plant: 'At my last job I managed a team of six people.', recall: 'How do I describe my leadership experience?', expect: 'team of six' },
  { id: 'language', plant: 'I am fluent in Vietnamese and English and would like to use both.', recall: 'Should I mention languages on my resume, and where?', expect: 'Vietnamese and English' },
];

const conversations = [];
FACTS.forEach((f, i) => {
  // EARLY: fact at user turn 2, recall at turn 13: far outside the 8 most recent exchanges.
  const early = Array.from({ length: 13 }, (_, t) => FILLER[(i + t) % FILLER.length]);
  early[1] = f.plant; early[12] = f.recall;
  conversations.push({ id: `early-${f.id}`, kind: 'early_fact_far_recall', plantedAtUserTurn: 2, recallAtUserTurn: 13, expectedFact: f.expect, userTurns: early });
  // CONTROL: fact at user turn 10, recall at turn 13: inside the window.
  const control = Array.from({ length: 13 }, (_, t) => FILLER[(i + t + 3) % FILLER.length]);
  control[9] = f.plant; control[12] = f.recall;
  conversations.push({ id: `control-${f.id}`, kind: 'recent_fact_near_recall', plantedAtUserTurn: 10, recallAtUserTurn: 13, expectedFact: f.expect, userTurns: control });
});

fs.writeFileSync(new URL('../../tests/fixtures/coach-eval/conversations.json', import.meta.url), JSON.stringify({ version: 1, synthetic: true, count: conversations.length, conversations }, null, 1) + '\n');
console.log('wrote', conversations.length, 'conversations');
