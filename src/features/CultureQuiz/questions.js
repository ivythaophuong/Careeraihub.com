// Five cultural axes. Every pair of axes is compared exactly once (10 pairs = 10 questions),
// and both options in a pair are positive, so there is no "right" answer to game.
export const AXES = ['innovation', 'autonomy', 'collaboration', 'structure', 'pace'];

export const AXIS_LABELS = {
  innovation: 'Innovation',
  autonomy: 'Autonomy',
  collaboration: 'Collaboration',
  structure: 'Structure',
  pace: 'Pace',
};

export const QUESTIONS = [
  {
    id: 1,
    prompt: 'Which sounds more like your best days at work?',
    a: { axis: 'innovation', text: 'I am inventing a new way to solve a problem.' },
    b: { axis: 'structure', text: 'I am making a proven process run flawlessly.' },
  },
  {
    id: 2,
    prompt: 'When a hard problem lands on your desk, you prefer to...',
    a: { axis: 'autonomy', text: 'Own it end to end and report back with a result.' },
    b: { axis: 'collaboration', text: 'Work through it side by side with teammates.' },
  },
  {
    id: 3,
    prompt: 'Which environment helps you do your best work?',
    a: { axis: 'pace', text: 'Fast-moving, with priorities that shift as we learn.' },
    b: { axis: 'structure', text: 'Steady, with clear plans that let me go deep.' },
  },
  {
    id: 4,
    prompt: 'In a team discussion, you are more likely to...',
    a: { axis: 'innovation', text: 'Challenge the current approach and propose another.' },
    b: { axis: 'collaboration', text: 'Build agreement so everyone moves forward together.' },
  },
  {
    id: 5,
    prompt: 'What matters more to you in a new role?',
    a: { axis: 'autonomy', text: 'The freedom to decide how I get my work done.' },
    b: { axis: 'pace', text: 'A high tempo where things get done quickly.' },
  },
  {
    id: 6,
    prompt: 'How do you prefer decisions to be made?',
    a: { axis: 'collaboration', text: 'Through open discussion, even if it takes longer.' },
    b: { axis: 'structure', text: 'Through clear roles, so ownership is never in doubt.' },
  },
  {
    id: 7,
    prompt: 'When the deadline is tight, you would rather...',
    a: { axis: 'innovation', text: 'Take the time to explore an original solution.' },
    b: { axis: 'pace', text: 'Deliver quickly using the best-known approach.' },
  },
  {
    id: 8,
    prompt: 'Which kind of manager suits you better?',
    a: { axis: 'autonomy', text: 'One who sets the goal and lets me choose the method.' },
    b: { axis: 'structure', text: 'One who sets clear expectations and a defined process.' },
  },
  {
    id: 9,
    prompt: 'What makes a team great in your eyes?',
    a: { axis: 'collaboration', text: 'Deep trust and strong working relationships.' },
    b: { axis: 'pace', text: 'Visible momentum and fast, measurable results.' },
  },
  {
    id: 10,
    prompt: 'Which kind of energy do you want from your workplace?',
    a: { axis: 'innovation', text: 'Room to experiment with new approaches.' },
    b: { axis: 'autonomy', text: 'Ownership of my decisions with little oversight.' },
  },
];

// Answer values: how strongly the person leans toward option A (positive) or option B (negative).
export const ANSWER_CHOICES = [
  { value: 2, label: 'A, strongly' },
  { value: 1, label: 'A, slightly' },
  { value: -1, label: 'B, slightly' },
  { value: -2, label: 'B, strongly' },
];
