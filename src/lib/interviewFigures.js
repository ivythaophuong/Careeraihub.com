// The interview figures shown in the app are NOT one number. Two different questions are answered in two places:
//   - "latest session": the average of the newest Mock Interview session (Dashboard, Career Roadmap, Interview Coach Overview). This file.
//   - "average of the last 5": the Weakness Radar's interview axis (WeaknessRadar.buildEvidence) and the database's interview_score
//     for Trust Match (recompute_trust_score). Those keep their own rules; this file does not replace them.
// A missing figure is null, never 0: "no session yet" must not read as a score of zero.
export function latestSessionScore(sessions) {
  const s = Array.isArray(sessions) ? sessions[0] : null;
  return Number.isFinite(s?.avgScore) ? s.avgScore : null;
}
