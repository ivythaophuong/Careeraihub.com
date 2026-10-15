import React from 'react';

// Renders sections from legalContent.js. The caller passes its own colours so the same text fits the app theme and the landing page.
export default function LegalDocument({ sections, headColor, textColor }) {
  const bullet = (b, i) => (Array.isArray(b)
    ? <li key={i}><strong>{b[0]}</strong> {b[1]}</li>
    : <li key={i}>{b}</li>);
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, color: headColor, marginBottom: 12 }}>{s.heading}</h2>
          {(s.paras || []).map((p, i) => <p key={i} style={{ color: textColor, marginBottom: 12 }}>{p}</p>)}
          {s.bullets && <ul style={{ color: textColor, paddingLeft: 20, marginBottom: 12 }}>{s.bullets.map(bullet)}</ul>}
          {(s.paras2 || []).map((p, i) => <p key={`b${i}`} style={{ color: textColor, marginBottom: 12 }}>{p}</p>)}
        </section>
      ))}
    </>
  );
}
