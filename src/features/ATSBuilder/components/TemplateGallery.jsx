import React, { useState, useRef, useEffect } from 'react';
import { exportPdf, exportDocx, makeVersion } from '../exportActions.js';

// The template screen: its own screen, with its own value. The user's own resume is shown LARGE, in the layout they are looking at, so they can judge the
// style; a list switches the layout; and two steps say what to do next: 1 pick a layout, 2 download or save.
// Choosing a layout changes the look only; the content is the Builder's data, untouched.
const A4 = 794;
const THUMB = 96;                         // width of a small preview in the list, in px

const btn = (primary) => ({
  padding: primary ? '12px 22px' : '9px 16px', fontSize: primary ? 14 : 12.5, fontWeight: 800, borderRadius: 10, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--lp-bdr)', background: primary ? 'var(--lp-teal)' : 'transparent', color: primary ? '#000' : 'var(--lp-text2)',
});
const link = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lp-text2)', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline' };

const css = `
@media (max-width: 768px) { .atb-gallery-grid { grid-template-columns: 1fr !important; } .atb-gallery-grid > section { height: auto !important; } }`;

export default function TemplateGallery({ data, templates = [], selectedId, onSelect, onBack, sample = false, onSaveVersion, versionsCount = 0, onOpenHistory }) {
  const [step, setStep] = useState('pick');
  const [label, setLabel] = useState('');
  const [savedAs, setSavedAs] = useState(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyDocx, setBusyDocx] = useState(false);

  const selected = templates.find(t => t.id === selectedId) || templates[0];
  const Selected = selected?.component;

  // The large preview is scaled to the width of its column: as large as the room allows (0.3 to 1; 1 while it is not measured).
  const boxRef = useRef(null);
  const previewRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!boxRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const fit = (width) => { const w = width - 32; setScale(w > 0 ? Math.max(0.3, Math.min(1, w / A4)) : 1); };
    if (boxRef.current.clientWidth) fit(boxRef.current.clientWidth);
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  const pdf = async () => { setBusyPdf(true); try { await exportPdf({ el: previewRef.current, data, templateLabel: selected.label }); } finally { setBusyPdf(false); } };
  const docx = async () => { setBusyDocx(true); try { await exportDocx(data); } finally { setBusyDocx(false); } };
  const save = () => {
    const v = makeVersion({ data, templateId: selected.id, templateLabel: selected.label, label, count: versionsCount });
    onSaveVersion?.(v);
    setSavedAs(v.label);
    setLabel('');
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>   {/* a fixed width, so the layout does not shift between the steps */}
      <style>{css}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--lp-text)' }}>Choose a template</h2>
        {onBack && <button type="button" onClick={onBack} style={btn(false)}>Back to Builder</button>}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text3)' }}>
        The large page is your own resume. Your content stays the same; only the layout changes. You can change it again at any time.
      </p>
      {sample && <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#FFB84D' }}>The preview uses a sample resume. Upload yours to see your own.</p>}

      <div className="atb-gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 330px) 1fr', gap: 20, alignItems: 'start' }}>
        {/* The guide: where the user is, and what to do next */}
        <section aria-label="Layouts and next step" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)' }}>
            {step === 'pick' ? 'Step 1 of 2 · Pick a layout' : 'Step 2 of 2 · Download or save'}
          </div>

          {step === 'pick' ? (<>
            {sample ? (
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>Upload or write your resume first, then come back to download or save it in this layout.</div>
            ) : (<>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--lp-text2)' }}>Click a layout below to see your resume in it. When you like one, go on:</div>
              <button type="button" data-primary="true" onClick={() => setStep('finish')} style={btn(true)}>Next: download or save →</button>
            </>)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {templates.map(t => {
                const chosen = t.id === selected?.id;
                const Template = t.component;
                return (
                  <button key={t.id} type="button" aria-pressed={chosen} onClick={() => onSelect?.(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: 10, borderRadius: 12, cursor: 'pointer', background: 'var(--lp-bg2)', color: 'var(--lp-text)',
                      border: chosen ? '2px solid var(--lp-teal)' : '1px solid var(--lp-bdr)', fontFamily: 'var(--lp-ff)' }}>
                    <div data-template-preview aria-hidden="true" style={{ width: THUMB, height: Math.round(THUMB * 1.414), overflow: 'hidden', flex: 'none', background: '#fff', borderRadius: 3, pointerEvents: 'none', boxShadow: '0 1px 6px rgba(0,0,0,.3)' }}>
                      <div style={{ width: A4, transform: `scale(${THUMB / A4})`, transformOrigin: 'top left' }}><Template {...data} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{t.label}</div>
                      {chosen && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: 'var(--lp-teal)' }}>✓ Selected</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>) : (<>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--lp-text2)' }}>
              You chose <strong style={{ color: 'var(--lp-text)' }}>{selected.label}</strong>. <button type="button" onClick={() => setStep('pick')} style={link}>Back to layouts</button>
            </div>
            <button type="button" data-primary="true" onClick={pdf} disabled={busyPdf} style={btn(true)}>{busyPdf ? 'Generating PDF…' : '⬇ Download PDF'}</button>
            <button type="button" onClick={docx} disabled={busyDocx} style={btn(false)}>{busyDocx ? 'Generating Word file…' : '⬇ Download Word (.docx)'}</button>
            <div style={{ borderTop: '1px solid var(--lp-bdr)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input aria-label="Version label" value={label} onChange={e => setLabel(e.target.value)} placeholder={`Version ${versionsCount + 1} — add a label (optional)`}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 12.5, borderRadius: 8, border: '1px solid var(--lp-bdr)', background: 'var(--lp-bg3)', color: 'var(--lp-text)', fontFamily: 'var(--lp-ff)' }} />
              <button type="button" onClick={save} style={btn(false)}>Save this version</button>
              {savedAs && (
                <div role="status" style={{ fontSize: 12.5, lineHeight: 1.6, color: '#00E5A0' }}>
                  ✓ Saved as “{savedAs}” in Saved versions.{onOpenHistory && <> <button type="button" onClick={onOpenHistory} style={{ ...link, color: 'var(--lp-text2)' }}>See your versions</button></>}
                </div>
              )}
            </div>
          </>)}
        </section>

        {/* The user's resume, large, in the layout in use */}
        <section aria-label="Preview of your resume" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: 'calc(100vh - 260px)', minHeight: 480 }}>
          <div style={{ fontSize: 12, color: 'var(--lp-text3)', padding: '0 4px 8px' }}>Preview · {selected?.label}</div>
          <div ref={boxRef} style={{ background: '#e0e0e0', padding: 16, overflow: 'auto', flex: 1, minHeight: 0, borderRadius: 10 }}>
            <div style={{ width: scale < 1 ? Math.round(A4 * scale) : A4, overflow: 'hidden', margin: '0 auto' }}>
              <div ref={previewRef} data-template={selected?.id} style={{ width: A4, transform: `scale(${scale})`, transformOrigin: 'top left', boxShadow: '0 4px 24px rgba(0,0,0,.2)' }}>
                {Selected && <Selected {...data} />}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
