// The four stages of the guided journey (design: docs/architecture/plans/DESIGN-guided-journey.md), as pure functions from where the user is. No screen, no AI,
// no storage. The strip built on them says "you are here" and "visited"; it never says a stage is done, because the product keeps neither whether an issue was
// left aside nor whether a file was downloaded, and a guess about the resume is not allowed.
export const STAGES = [
  { id: 1, label: 'Add your resume' },
  { id: 2, label: 'See what to improve' },
  { id: 3, label: 'Improve' },
  { id: 4, label: 'Choose a layout and download' },
];

// The stage the user is in. `tab` is the Resume Builder tab ('parse', 'builder', 'templates' or 'history'; anything else is read as the first one), `hasProfile`
// is whether a resume is loaded, `fixOpen` is whether the Fix page is open, which wins over the tab it is shown in.
export function journeyStage(state) {
  const { tab, hasProfile, fixOpen } = state && typeof state === 'object' ? state : {};
  if (fixOpen === true) return 3;
  if (tab === 'builder') return 3;
  if (tab === 'templates' || tab === 'history') return 4;
  return hasProfile ? 2 : 1;
}

// The stages the user has been in during this visit, with one more added. A new sorted list; a value that is not a stage number is left out.
export function addVisited(visited, stage) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= STAGES.length;
  const set = new Set((Array.isArray(visited) ? visited : []).filter(ok));
  if (ok(stage)) set.add(stage);
  return [...set].sort((a, b) => a - b);
}

// What the strip shows for each stage: 'here' (the stage the user is in), 'visited' or 'other', with its label and "Step n of 4" for a screen reader.
export function stageStates(current, visited) {
  const seen = new Set(Array.isArray(visited) ? visited : []);
  return STAGES.map(s => ({ id: s.id, label: s.label, position: `Step ${s.id} of ${STAGES.length}`, state: s.id === current ? 'here' : seen.has(s.id) ? 'visited' : 'other' }));
}
