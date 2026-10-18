import React from 'react';
import { C } from '../../styles/theme';
import { Card } from '../../components/CommonUI';

const OUTCOME_COLOR = { pass: C.green, partial: C.gold, fail: C.red, not_evaluated: C.muted };
const OUTCOME_TEXT = { pass: 'Met', partial: 'Partly', fail: 'Not met', not_evaluated: 'Not checked' };
const STATE_TEXT = {
  insufficient_data: 'There is not enough text to assess: the answer is too short. No score was computed, and none is counted as zero.',
  unsupported_language: 'The rules do not cover this language or writing system yet. No score was computed.',
  processing_error: 'The rules could not run on this answer. No score was computed.',
};

// A separate, clearly labelled panel: the rule-based Structure Score and its evidence. Not the AI feedback, never saved, never a hiring signal.
export default function StructurePanel({ result }) {
  const scored = result?.status === 'scored' && Number.isInteger(result.score);
  return (
    <section role="region" aria-label="Structure Score (rules, beta preview)" style={{ border: `1px dashed ${C.accent}88`, borderRadius: 12, padding: 14, background: C.accent + '08' }}>
      <div style={{ color: C.accent, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Structure Score · rules · beta · owner preview</div>
      {scored ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <span aria-label="Structure Score" style={{ color: C.text, fontSize: 28, fontWeight: 900 }}>{result.score}</span>
            <span style={{ color: C.muted, fontSize: 12 }}>out of 100 · {result.language === 'vi' ? 'Vietnamese' : 'English'} rules{result.score_version ? ` · ${result.score_version}` : ''}</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.evidence.map((e) => (
              <li key={e.id} style={{ fontSize: 12, lineHeight: 1.5 }}>
                <span style={{ color: OUTCOME_COLOR[e.outcome] || C.muted, fontWeight: 800, marginRight: 6 }}>{OUTCOME_TEXT[e.outcome] || e.outcome}</span>
                <span style={{ color: C.text }}>{e.label}</span>
                {e.note && <span style={{ color: C.muted }}> · {e.note}</span>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>{STATE_TEXT[result?.status] || STATE_TEXT.processing_error}</div>
      )}
      <div role="note" style={{ color: C.muted, fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
        This measures how the answer is built, not how good it is, not whether it is true, and not your competence or fit for a job. It is a beta preview of rules that have not been calibrated yet.
        It is not saved, is not sent anywhere, and does not change your score.
      </div>
    </section>
  );
}
