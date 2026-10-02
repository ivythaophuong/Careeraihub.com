import { AXES, QUESTIONS } from './questions';
import { PERSONAS } from './personas';

// Each axis appears in 4 questions and can earn at most 2 points per question.
export const MAX_POINTS_PER_AXIS = 8;

// answers: { [questionId]: 2 | 1 | -1 | -2 }
export function scoreAnswers(answers) {
  const points = Object.fromEntries(AXES.map((a) => [a, 0]));

  for (const q of QUESTIONS) {
    const v = answers[q.id];
    if (!v) continue;
    if (v > 0) points[q.a.axis] += v;
    else points[q.b.axis] += -v;
  }

  return Object.fromEntries(
    AXES.map((a) => [a, Math.round((points[a] / MAX_POINTS_PER_AXIS) * 100)])
  );
}

// Top two axes (ties broken by the fixed axis order) pick one of the 10 personas.
export function topTwoAxes(scores) {
  const ranked = [...AXES].sort((x, y) => scores[y] - scores[x] || AXES.indexOf(x) - AXES.indexOf(y));
  return ranked.slice(0, 2).sort((x, y) => AXES.indexOf(x) - AXES.indexOf(y));
}

export function personaFor(scores) {
  const key = topTwoAxes(scores).join('+');
  return PERSONAS[key];
}

export function bandFor(score) {
  if (score >= 63) return 'high';
  if (score <= 25) return 'low';
  return 'mid';
}

export function isComplete(answers) {
  return QUESTIONS.every((q) => answers[q.id]);
}
