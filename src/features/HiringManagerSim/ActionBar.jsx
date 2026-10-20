import React from 'react';
import { C } from '../../styles/theme';
import { Btn } from '../../components/CommonUI';

// The actions of the page, kept in view at the bottom: what state you are in, one primary action, and the others.
export default function ActionBar({ status, detail, primary, secondary, color }) {
  const others = Array.isArray(secondary) ? secondary : secondary ? [secondary] : [];
  return (
    <div role="group" aria-label="Actions" style={{ position: 'sticky', bottom: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', boxShadow: '0 -8px 24px rgba(0,0,0,.25)' }}>
      <div role="status" aria-live="polite" style={{ minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>{status}</div>
        {detail && <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {others.map((a) => <Btn key={a.label} onClick={a.onClick} disabled={a.disabled} color={C.border} style={{ padding: '11px 20px' }}>{a.label}</Btn>)}
        {primary && <Btn onClick={primary.onClick} disabled={primary.disabled} color={color || C.accent} dark style={{ padding: '11px 26px', minWidth: 190 }}>{primary.label}</Btn>}
      </div>
    </div>
  );
}
