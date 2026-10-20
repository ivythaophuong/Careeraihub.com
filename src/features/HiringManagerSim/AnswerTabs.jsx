import React from 'react';
import { C } from '../../styles/theme';

// "Type answer" and "Voice answer" as tabs above the answer. Voice answer is locked until a timed round has been finished (the unlock reads no AI score).
// When voice is not available at all there are no tabs, only the heading.
const tab = (active, locked) => ({ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 4px', marginRight: 22, background: 'transparent', border: 'none', borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
  color: active ? C.text : C.muted, fontSize: 14, fontWeight: active ? 800 : 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.6 : 1, fontFamily: 'inherit' });

export default function AnswerTabs({ mode, onChange, voiceAvailable, voiceUnlocked, draftKept }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8, borderBottom: `1px solid ${C.border}` }}>
      {voiceAvailable ? (
        <div role="tablist" aria-label="How you answer" style={{ display: 'flex', flexWrap: 'wrap' }}>
          <button type="button" role="tab" aria-selected={mode === 'text'} onClick={() => onChange('text')} style={tab(mode === 'text', false)}><span aria-hidden="true">⌨️</span>Type answer</button>
          <button type="button" role="tab" aria-selected={mode === 'voice'} aria-disabled={voiceUnlocked ? undefined : 'true'} aria-describedby={voiceUnlocked ? undefined : 'voice-tab-note'}
            onClick={() => { if (voiceUnlocked) onChange('voice'); }} style={tab(mode === 'voice', !voiceUnlocked)}><span aria-hidden="true">{voiceUnlocked ? '🎙️' : '🔒'}</span>Voice answer</button>
        </div>
      ) : (
        <div style={{ color: C.text, fontSize: 14, fontWeight: 800, padding: '12px 0' }}>Your answer</div>
      )}
      {draftKept && <div style={{ color: C.muted, fontSize: 11, padding: '0 0 12px' }}>Draft kept on this device. It is not saved to your account.</div>}
      {voiceAvailable && !voiceUnlocked && (
        <div id="voice-tab-note" style={{ flexBasis: '100%', color: C.muted, fontSize: 11, padding: '0 0 10px' }}>Voice answer unlocks after you finish one timed round and answer at least 4 of 5 questions. It is optional: you can always type.</div>
      )}
    </div>
  );
}
