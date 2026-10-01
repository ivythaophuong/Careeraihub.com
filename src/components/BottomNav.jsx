import React, { useState } from 'react';
import { C, MODULES } from '../styles/theme';

export const BOTTOM_NAV_HEIGHT = 64;
const PRIMARY = ['jobs', 'scan', 'ats', 'star'];

// Phone-only navigation: four primary modules + a "More" sheet with the rest.
export default function BottomNav({ activeModule, setActiveModule, onOpenLegal }) {
  const [sheet, setSheet] = useState(false);
  const primary = PRIMARY.map(id => MODULES.find(m => m.id === id)).filter(Boolean);
  const moreActive = !PRIMARY.includes(activeModule);

  const go = (id) => { setActiveModule(id); setSheet(false); };

  const tab = (active) => ({
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    color: active ? C.accent : C.muted, fontSize: 10, fontWeight: active ? 800 : 600, minWidth: 0, padding: '6px 2px',
  });

  return (
    <>
      {sheet && (
        <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 900, animation: 'fadeIn 0.2s ease' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
              background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: '18px 18px 0 0',
              padding: '14px 16px 18px', maxHeight: '70vh', overflowY: 'auto',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 14px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {MODULES.map(m => (
                <button
                  key={m.id}
                  onClick={() => go(m.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 4px',
                    background: activeModule === m.id ? `${m.color}18` : C.card,
                    border: `1px solid ${activeModule === m.id ? `${m.color}66` : C.border}`,
                    borderRadius: 12, cursor: 'pointer', color: C.text, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
              <button onClick={() => { onOpenLegal('privacy'); setSheet(false); }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Privacy Policy</button>
              <button onClick={() => { onOpenLegal('terms'); setSheet(false); }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Terms of Service</button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 950, display: 'flex',
          height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))`, paddingBottom: 'env(safe-area-inset-bottom)',
          background: `${C.surface}F2`, backdropFilter: 'blur(16px)', borderTop: `1px solid ${C.border}`,
        }}
      >
        {primary.map(m => (
          <button key={m.id} onClick={() => go(m.id)} style={tab(activeModule === m.id)}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{m.icon}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{m.label}</span>
          </button>
        ))}
        <button onClick={() => setSheet(s => !s)} style={tab(moreActive || sheet)} aria-expanded={sheet}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
