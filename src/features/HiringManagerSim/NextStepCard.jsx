import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn } from '../../components/CommonUI';
import { STEP_COPY, OPTIONS_COPY } from './guidanceCopy';

const ghostBtn = { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };

// One suggested next step, with the reason, and always the other ways forward. Nothing here is locked or graded.
export default function NextStepCard({ step, color, busy, onPrimary, onReview, onOwnPace }) {
  const [preview, setPreview] = useState(false);
  const copy = STEP_COPY[step.id];
  return (
    <Card style={{ border: `1px solid ${color}44` }}>
      <div style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Next challenge</div>
      <div style={{ color: C.text, fontWeight: 900, fontSize: 16, marginBottom: 6 }}>{copy.heading}</div>
      <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{copy.reason}</div>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>{copy.challengeLine}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn onClick={onPrimary} color={color} dark disabled={!!busy}>{copy.primaryLabel}</Btn>
        <button type="button" onClick={onReview} style={ghostBtn}>{OPTIONS_COPY.review}</button>
        {step.id !== 'again_untimed' && <button type="button" onClick={onOwnPace} disabled={!!busy} style={ghostBtn}>{OPTIONS_COPY.ownPace}</button>}
        <button type="button" onClick={() => setPreview(v => !v)} aria-expanded={preview} style={ghostBtn}>{OPTIONS_COPY.preview}</button>
      </div>
      {preview && <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginTop: 10 }}>{OPTIONS_COPY.previewText}</div>}
    </Card>
  );
}
