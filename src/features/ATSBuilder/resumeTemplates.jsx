import React from 'react';

// All templates accept the same data shape:
// { contact:{name,email,phone,linkedin,location}, summary, experience[], education[], skills[], awards[], extras[] }
// experience[i]: { id, company, title, period, bullets[] }
// education[i]:  { id, institution, degree, year }
// extras[i]:     { heading, items[] }  ← catch-all for any other resume section

const ph = (v, fallback) => v || fallback;

// ── Modern Professional ────────────────────────────────────────────────────────
export function ModernTemplate({ contact = {}, summary = '', experience = [], education = [], skills = [], awards = [], extras = [] }) {
  const rule = { height: 1, background: '#111', margin: '16px 0 14px' };
  const ruleLight = { height: 1, background: '#ddd', margin: '14px 0' };
  const sectionTitle = { fontSize: 10.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#111', marginBottom: 10 };

  return (
    <div style={{ padding: '48px 52px', color: '#1a1a1a', fontFamily: 'Georgia, serif', background: '#fff', minHeight: 1122, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1, color: '#111' }}>{ph(contact.name, 'Your Name')}</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {contact.phone && <><span>{contact.phone}</span><span style={{ color: '#bbb' }}>·</span></>}
        {contact.email && <><span>{contact.email}</span><span style={{ color: '#bbb' }}>·</span></>}
        {contact.linkedin && <><span>{contact.linkedin}</span></>}
        {contact.location && <><span style={{ color: '#bbb' }}>·</span><span>{contact.location}</span></>}
      </div>

      {summary && (<>
        <div style={rule} />
        <div style={sectionTitle}>Professional Summary</div>
        <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7 }}>{summary}</div>
      </>)}

      {experience.filter(j => j.company).length > 0 && (<>
        <div style={ruleLight} />
        <div style={sectionTitle}>Work Experience</div>
        {experience.filter(j => j.company).map((job, i) => (
          <div key={job.id ?? i} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{job.company}</span>
              <span style={{ fontSize: 11, color: '#777' }}>{job.period}</span>
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#444', marginTop: 2 }}>{job.title}</div>
            {(job.bullets || []).filter(b => b.trim()).map((b, bi) => (
              <div key={bi} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginTop: 4 }}>
                <span style={{ position: 'absolute', left: 0 }}>•</span>{b}
              </div>
            ))}
          </div>
        ))}
      </>)}

      {education.filter(e => e.institution).length > 0 && (<>
        <div style={ruleLight} />
        <div style={sectionTitle}>Education</div>
        {education.filter(e => e.institution).map((edu, i) => (
          <div key={edu.id ?? i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>{edu.institution}</div>
              <div style={{ fontSize: 11.5, color: '#444', fontStyle: 'italic' }}>{edu.degree}</div>
            </div>
            <div style={{ fontSize: 11, color: '#777' }}>{edu.year}</div>
          </div>
        ))}
      </>)}

      {skills.filter(s => s.trim()).length > 0 && (<>
        <div style={ruleLight} />
        <div style={sectionTitle}>Skills</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skills.filter(s => s.trim()).map((sk, i) => (
            <span key={i} style={{ fontSize: 11, color: '#333', border: '1px solid #ccc', borderRadius: 3, padding: '3px 8px' }}>{sk}</span>
          ))}
        </div>
      </>)}

      {awards.filter(a => a.trim()).length > 0 && (<>
        <div style={ruleLight} />
        <div style={sectionTitle}>Awards</div>
        {awards.filter(a => a.trim()).map((award, i) => (
          <div key={i} style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>{award}</div>
        ))}
      </>)}

      {extras.filter(s => s.items?.length).map((section, i) => (<React.Fragment key={i}>
        <div style={ruleLight} />
        <div style={sectionTitle}>{section.heading}</div>
        {section.items.map((item, j) => (
          <div key={j} style={{ fontSize: 12, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginBottom: 4 }}>
            <span style={{ position: 'absolute', left: 0 }}>•</span>{item}
          </div>
        ))}
      </React.Fragment>))}
    </div>
  );
}

// ── Creative ───────────────────────────────────────────────────────────────────
export function CreativeTemplate({ contact = {}, summary = '', experience = [], education = [], skills = [], awards = [], extras = [] }) {
  const accent = '#4a6fa5';
  const sidebar = '#1e2235';

  return (
    <div style={{ display: 'flex', minHeight: 1122, fontFamily: "'Helvetica Neue', Arial, sans-serif", background: '#fff' }}>
      {/* Sidebar */}
      <div style={{ width: 220, minWidth: 220, background: sidebar, padding: '36px 20px', flexShrink: 0 }}>
        <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#2d3250', border: `3px solid ${accent}`, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>👤</div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>{ph(contact.name, 'Your Name')}</div>
        <div style={{ color: '#7db3e8', fontSize: 10, textAlign: 'center', marginTop: 4, letterSpacing: 1 }}>{experience.find(j => j.title)?.title || ''}</div>

        <div style={{ height: 1, background: '#2d3250', margin: '16px 0' }} />

        <div style={{ color: '#a0b0c8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Contact</div>
        {contact.phone && <div style={{ color: '#ccd', fontSize: 10.5, marginBottom: 5 }}>📞 {contact.phone}</div>}
        {contact.email && <div style={{ color: '#ccd', fontSize: 10.5, marginBottom: 5 }}>✉ {contact.email}</div>}
        {contact.linkedin && <div style={{ color: '#ccd', fontSize: 10.5, marginBottom: 5 }}>🔗 {contact.linkedin}</div>}
        {contact.location && <div style={{ color: '#ccd', fontSize: 10.5, marginBottom: 5 }}>📍 {contact.location}</div>}

        {skills.filter(s => s.trim()).length > 0 && (<>
          <div style={{ height: 1, background: '#2d3250', margin: '14px 0' }} />
          <div style={{ color: '#a0b0c8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Skills</div>
          {skills.filter(s => s.trim()).slice(0, 7).map((sk, i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ color: '#ccd', fontSize: 10.5, marginBottom: 3 }}>{sk}</div>
              <div style={{ height: 4, background: '#2d3250', borderRadius: 2 }}>
                <div style={{ height: 4, background: accent, borderRadius: 2, width: `${90 - i * 7}%` }} />
              </div>
            </div>
          ))}
        </>)}

        {education.filter(e => e.institution).length > 0 && (<>
          <div style={{ height: 1, background: '#2d3250', margin: '14px 0' }} />
          <div style={{ color: '#a0b0c8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Education</div>
          {education.filter(e => e.institution).map((edu, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{edu.institution}</div>
              <div style={{ color: '#ccd', fontSize: 10 }}>{edu.degree}</div>
              {edu.year && <div style={{ color: '#7db3e8', fontSize: 10 }}>{edu.year}</div>}
            </div>
          ))}
        </>)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '36px 28px', overflow: 'hidden' }}>
        {summary && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10 }}>Professional Summary</div>
            <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7 }}>{summary}</div>
          </div>
        )}
        {experience.filter(j => j.company).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 12 }}>Work Experience</div>
            {experience.filter(j => j.company).map((job, i) => (
              <div key={job.id ?? i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2235' }}>{job.company}</span>
                  <span style={{ fontSize: 10.5, color: accent, fontWeight: 600 }}>{job.period}</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#555', marginTop: 2 }}>{job.title}</div>
                {(job.bullets || []).filter(b => b.trim()).map((b, bi) => (
                  <div key={bi} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginTop: 4 }}>
                    <span style={{ position: 'absolute', left: 0, color: accent, fontSize: 8 }}>▸</span>{b}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {awards.filter(a => a.trim()).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10 }}>Awards</div>
            {awards.filter(a => a.trim()).map((award, i) => (
              <div key={i} style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>🏆 {award}</div>
            ))}
          </div>
        )}
        {extras.filter(s => s.items?.length).map((section, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, borderBottom: `2px solid ${accent}`, paddingBottom: 4, marginBottom: 10 }}>{section.heading}</div>
            {section.items.map((item, j) => (
              <div key={j} style={{ fontSize: 12, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginBottom: 4 }}>
                <span style={{ position: 'absolute', left: 0, color: accent, fontSize: 8 }}>▸</span>{item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Two-Column ─────────────────────────────────────────────────────────────────
export function TwoColumnTemplate({ contact = {}, summary = '', experience = [], education = [], skills = [], awards = [], extras = [] }) {
  const accent = '#2563eb';

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: '#fff', minHeight: 1122, boxSizing: 'border-box' }}>
      <div style={{ padding: '28px 36px 18px', borderBottom: `3px solid ${accent}` }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: '#111', letterSpacing: -0.5 }}>{ph(contact.name, 'Your Name')}</div>
        <div style={{ fontSize: 13, color: accent, fontWeight: 600, marginTop: 2 }}>{experience.find(j => j.title)?.title || ''}</div>
      </div>
      <div style={{ display: 'flex' }}>
        {/* Main */}
        <div style={{ flex: 1, padding: '22px 28px', minWidth: 0 }}>
          {summary && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>Summary</div>
              <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7 }}>{summary}</div>
            </div>
          )}
          {experience.filter(j => j.company).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 10 }}>Work Experience</div>
              {experience.filter(j => j.company).map((job, i) => (
                <div key={job.id ?? i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{job.company}</span>
                    <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{job.period}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#555' }}>{job.title}</div>
                  {(job.bullets || []).filter(b => b.trim()).map((b, bi) => (
                    <div key={bi} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginTop: 4 }}>
                      <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{b}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {extras.filter(s => s.items?.length).map((section, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>{section.heading}</div>
              {section.items.map((item, j) => (
                <div key={j} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6, paddingLeft: 14, position: 'relative', marginTop: 4 }}>
                  <span style={{ position: 'absolute', left: 0, color: accent }}>•</span>{item}
                </div>
              ))}
            </div>
          ))}
        </div>
        {/* Side */}
        <div style={{ width: 200, minWidth: 200, background: '#f0f4ff', padding: '22px 16px', borderLeft: '1px solid #dde4ff' }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>Contact</div>
            {contact.phone && <div style={{ fontSize: 10.5, color: '#444', marginBottom: 4, wordBreak: 'break-all' }}>📞 {contact.phone}</div>}
            {contact.email && <div style={{ fontSize: 10.5, color: '#444', marginBottom: 4, wordBreak: 'break-all' }}>✉ {contact.email}</div>}
            {contact.linkedin && <div style={{ fontSize: 10.5, color: '#444', marginBottom: 4 }}>🔗 {contact.linkedin}</div>}
            {contact.location && <div style={{ fontSize: 10.5, color: '#444', marginBottom: 4 }}>📍 {contact.location}</div>}
          </div>
          {education.filter(e => e.institution).length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>Education</div>
              {education.filter(e => e.institution).map((edu, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111' }}>{edu.institution}</div>
                  <div style={{ fontSize: 10.5, color: '#555', marginTop: 2, lineHeight: 1.4 }}>{edu.degree}</div>
                  {edu.year && <div style={{ fontSize: 10, color: accent, fontWeight: 600, marginTop: 2 }}>{edu.year}</div>}
                </div>
              ))}
            </div>
          )}
          {skills.filter(s => s.trim()).length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {skills.filter(s => s.trim()).map((sk, i) => (
                  <span key={i} style={{ display: 'inline-block', background: '#dde4ff', color: accent, fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '3px 7px', marginBottom: 3 }}>{sk}</span>
                ))}
              </div>
            </div>
          )}
          {awards.filter(a => a.trim()).length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: accent, marginBottom: 8 }}>Awards</div>
              {awards.filter(a => a.trim()).map((award, i) => (
                <div key={i} style={{ fontSize: 10.5, color: '#333', marginBottom: 4 }}>{award}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Minimalist ─────────────────────────────────────────────────────────────────
export function MinimalistTemplate({ contact = {}, summary = '', experience = [], education = [], skills = [], awards = [], extras = [] }) {
  const sectionLabel = { fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: '#999', marginBottom: 12 };

  return (
    <div style={{ padding: '52px 60px', color: '#1a1a1a', fontFamily: "'Helvetica Neue', Arial, sans-serif", background: '#fff', minHeight: 1122, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: 6, textTransform: 'uppercase', color: '#111' }}>{ph(contact.name, 'YOUR NAME')}</div>
      <div style={{ height: 0.5, background: '#111', margin: '10px 0' }} />
      <div style={{ fontSize: 10.5, color: '#888', display: 'flex', gap: 18, marginBottom: 30, flexWrap: 'wrap' }}>
        {contact.phone && <span>{contact.phone}</span>}
        {contact.email && <span>{contact.email}</span>}
        {contact.linkedin && <span>{contact.linkedin}</span>}
        {contact.location && <span>{contact.location}</span>}
      </div>

      {summary && (
        <div style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>Profile</div>
          <div style={{ fontSize: 12, color: '#444', lineHeight: 1.8 }}>{summary}</div>
        </div>
      )}

      {experience.filter(j => j.company).length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>Experience</div>
          {experience.filter(j => j.company).map((job, i) => (
            <div key={job.id ?? i} style={{ display: 'flex', gap: 18, marginBottom: 16 }}>
              <div style={{ width: 76, fontSize: 10.5, color: '#999', flexShrink: 0, paddingTop: 2, lineHeight: 1.4 }}>{job.period}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>{job.company}</div>
                <div style={{ fontSize: 11.5, color: '#666', marginTop: 1 }}>{job.title}</div>
                {(job.bullets || []).filter(b => b.trim()).map((b, bi) => (
                  <div key={bi} style={{ fontSize: 11.5, color: '#444', lineHeight: 1.7, paddingLeft: 12, position: 'relative', marginTop: 4 }}>
                    <span style={{ position: 'absolute', left: 0, color: '#bbb', fontSize: 10 }}>—</span>{b}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {education.filter(e => e.institution).length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>Education</div>
          {education.filter(e => e.institution).map((edu, i) => (
            <div key={i} style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
              <div style={{ width: 76, fontSize: 10.5, color: '#999', flexShrink: 0 }}>{edu.year}</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>{edu.institution}</div>
                {edu.degree && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{edu.degree}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {skills.filter(s => s.trim()).length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>Skills</div>
          <div>
            {skills.filter(s => s.trim()).map((sk, i, arr) => (
              <span key={i} style={{ fontSize: 10.5, color: '#666' }}>{sk}{i < arr.length - 1 ? '  ·  ' : ''}</span>
            ))}
          </div>
        </div>
      )}

      {awards.filter(a => a.trim()).length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>Awards</div>
          {awards.filter(a => a.trim()).map((award, i) => (
            <div key={i} style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{award}</div>
          ))}
        </div>
      )}

      {extras.filter(s => s.items?.length).map((section, i) => (
        <div key={i} style={{ marginBottom: 26 }}>
          <div style={sectionLabel}>{section.heading}</div>
          {section.items.map((item, j) => (
            <div key={j} style={{ display: 'flex', gap: 18, marginBottom: 6 }}>
              <div style={{ width: 76, flexShrink: 0 }} />
              <div style={{ fontSize: 11.5, color: '#444', lineHeight: 1.7, paddingLeft: 12, position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 0, color: '#bbb', fontSize: 10 }}>—</span>{item}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Bold ──────────────────────────────────────────────────────────────────────
export function BoldTemplate({ contact = {}, summary = '', experience = [], education = [], skills = [], awards = [], extras = [] }) {
  const gold = '#f0a500';
  const sectionHead = { fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#111', borderLeft: `4px solid ${gold}`, paddingLeft: 10, marginBottom: 10 };

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", background: '#fff', minHeight: 1122, boxSizing: 'border-box' }}>
      <div style={{ background: '#111', padding: '32px 40px' }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: -1, lineHeight: 1 }}>{ph(contact.name, 'YOUR NAME')}</div>
        <div style={{ fontSize: 12, color: gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6 }}>{experience.find(j => j.title)?.title || ''}</div>
      </div>
      <div style={{ background: gold, padding: '7px 40px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {contact.phone && <span style={{ fontSize: 10.5, color: '#111', fontWeight: 700 }}>{contact.phone}</span>}
        {contact.email && <span style={{ fontSize: 10.5, color: '#111', fontWeight: 700 }}>{contact.email}</span>}
        {contact.linkedin && <span style={{ fontSize: 10.5, color: '#111', fontWeight: 700 }}>{contact.linkedin}</span>}
        {contact.location && <span style={{ fontSize: 10.5, color: '#111', fontWeight: 700 }}>{contact.location}</span>}
      </div>
      <div style={{ padding: '28px 40px' }}>
        {summary && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionHead}>Summary</div>
            <div style={{ fontSize: 12, color: '#333', lineHeight: 1.7 }}>{summary}</div>
          </div>
        )}
        {experience.filter(j => j.company).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionHead}>Experience</div>
            {experience.filter(j => j.company).map((job, i) => (
              <div key={job.id ?? i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#111' }}>{job.company}</span>
                  <span style={{ fontSize: 11, color: gold, fontWeight: 700 }}>{job.period}</span>
                </div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{job.title}</div>
                {(job.bullets || []).filter(b => b.trim()).map((b, bi) => (
                  <div key={bi} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.6, paddingLeft: 16, position: 'relative', marginTop: 5 }}>
                    <span style={{ position: 'absolute', left: 0, color: gold, fontSize: 7, top: 4 }}>▶</span>{b}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 28 }}>
          {education.filter(e => e.institution).length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={sectionHead}>Education</div>
              {education.filter(e => e.institution).map((edu, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>{edu.institution}</div>
                  {edu.degree && <div style={{ fontSize: 11.5, color: '#555', marginTop: 2 }}>{edu.degree}</div>}
                  {edu.year && <div style={{ fontSize: 11, color: gold, fontWeight: 700, marginTop: 2 }}>{edu.year}</div>}
                </div>
              ))}
            </div>
          )}
          {skills.filter(s => s.trim()).length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={sectionHead}>Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {skills.filter(s => s.trim()).map((sk, i) => (
                  <span key={i} style={{ fontSize: 10.5, color: '#111', background: '#f5f5f5', borderLeft: `3px solid ${gold}`, padding: '3px 9px', fontWeight: 600 }}>{sk}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {awards.filter(a => a.trim()).length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={sectionHead}>Awards</div>
            {awards.filter(a => a.trim()).map((award, i) => (
              <div key={i} style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>🏆 {award}</div>
            ))}
          </div>
        )}
        {extras.filter(s => s.items?.length).map((section, i) => (
          <div key={i} style={{ marginTop: 24 }}>
            <div style={sectionHead}>{section.heading}</div>
            {section.items.map((item, j) => (
              <div key={j} style={{ fontSize: 12, color: '#333', lineHeight: 1.6, paddingLeft: 16, position: 'relative', marginBottom: 4 }}>
                <span style={{ position: 'absolute', left: 0, color: gold, fontSize: 7, top: 4 }}>▶</span>{item}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const TEMPLATES = [
  { id: 'modern',   label: 'Modern Professional', accent: '#111',    component: ModernTemplate    },
  { id: 'creative', label: 'Creative',             accent: '#4a6fa5', component: CreativeTemplate  },
  { id: 'twocol',   label: 'Two-Column',           accent: '#2563eb', component: TwoColumnTemplate },
  { id: 'minimal',  label: 'Minimalist',           accent: '#999',    component: MinimalistTemplate},
  { id: 'bold',     label: 'Bold',                 accent: '#f0a500', component: BoldTemplate      },
];
