import React from 'react';

// The template gallery: its own screen. Every template shows the user's own resume, scaled down, so choosing is about the look and not about guessing.
// Choosing a template changes the layout only; the content is the Builder's data, untouched. Reached from the Templates tab and from the end of the Fix page.
const A4 = 794;
const THUMB = 230;                        // width of a preview in px
const SCALE = THUMB / A4;

export default function TemplateGallery({ data, templates = [], selectedId, onSelect, onBack, sample = false }) {
  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--lp-text)' }}>Choose a template</h2>
        {onBack && <button type="button" onClick={onBack} style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 800, borderRadius: 8, cursor: 'pointer', border: '1px solid var(--lp-bdr)', background: 'transparent', color: 'var(--lp-text2)' }}>Back to Builder</button>}
      </div>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text3)' }}>
        Each preview is your own resume. Your content stays the same; only the layout changes. You can change it again at any time.
      </p>
      {sample && <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#FFB84D' }}>These previews use a sample resume. Upload yours to see your own in each template.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB + 24}px, 1fr))`, gap: 18 }}>
        {templates.map(t => {
          const chosen = t.id === selectedId;
          const Template = t.component;
          return (
            <button key={t.id} type="button" aria-pressed={chosen} onClick={() => onSelect?.(t.id)}
              style={{ textAlign: 'left', padding: 12, borderRadius: 12, cursor: 'pointer', background: 'var(--lp-bg2)', color: 'var(--lp-text)',
                border: chosen ? '2px solid var(--lp-teal)' : '1px solid var(--lp-bdr)', fontFamily: 'var(--lp-ff)' }}>
              <div data-template-preview aria-hidden="true" style={{ width: THUMB, height: Math.round(THUMB * 1.414), overflow: 'hidden', margin: '0 auto', background: '#fff', borderRadius: 4, pointerEvents: 'none', boxShadow: '0 2px 10px rgba(0,0,0,.25)' }}>
                <div style={{ width: A4, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
                  <Template {...data} />
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{t.label}</span>
                {chosen && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--lp-teal)' }}>✓ Selected</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
