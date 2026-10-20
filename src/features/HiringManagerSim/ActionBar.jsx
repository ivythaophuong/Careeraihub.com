import React from 'react';
import { C } from '../../styles/theme';
import { primaryBtn, quietBtn } from './calmUi';

// The actions of the page, kept in view at the bottom: what state you are in, one primary action, and the others.
export default function ActionBar({ status, detail, primary, secondary }) {
  const others = Array.isArray(secondary) ? secondary : secondary ? [secondary] : [];
  return (
    <div role="group" aria-label="Actions" style={{ position: 'sticky', bottom: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px' }}>
      <div role="status" aria-live="polite" style={{ minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>{status}</div>
        {detail && <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {others.map((a) => <button key={a.label} type="button" onClick={a.onClick} disabled={a.disabled} style={quietBtn(a.disabled)}>{a.label}</button>)}
        {primary && <button type="button" onClick={primary.onClick} disabled={primary.disabled} style={{ ...primaryBtn(primary.disabled), minWidth: 190 }}>{primary.label}</button>}
      </div>
    </div>
  );
}
