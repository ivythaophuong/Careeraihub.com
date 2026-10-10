import React, { useState, useRef, useEffect } from 'react';
import mammoth from 'mammoth';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { extractTextFromPdfFile } from '../../lib/resumeParser.js';
import { digestResume } from '../../lib/resumeDigest.js';
import { OrbitSpinner } from '../../components/OrbitMark';
import { arrayBufferToBase64 } from './atsBuilderUtils.js';
import { TEMPLATES } from './resumeTemplates.jsx';
import html2pdf from 'html2pdf.js';
import './atsBuilder.css';
import { resumeContent } from '../../lib/resumeText';
import { computeDeterministicScore } from '../../scoring/computeDeterministicScore';

// ── Helpers ────────────────────────────────────────────────────────────────────
function base64ToBlobUrl(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}


// ── Resume Builder Tab Bar ────────────────────────────────────────────────────
const RB_TABS = [
  { id: 'parse',   label: 'Upload & Parse'  },
  { id: 'builder', label: 'Builder'         },
  { id: 'history', label: 'Version History' },
];

function ResumeBuilderTabBar({ active, onTab }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 24px', borderBottom: '1px solid var(--lp-bdr)',
      background: 'var(--lp-bg3)', overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {RB_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          style={{
            padding: '12px 16px', fontSize: 13, fontWeight: active === t.id ? 700 : 500,
            color: active === t.id ? 'var(--lp-teal)' : 'var(--lp-text3)',
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${active === t.id ? 'var(--lp-teal)' : 'transparent'}`,
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-ff)',
            transition: 'all .15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Upload & Parse Tab ────────────────────────────────────────────────────────
const PART_LABELS = { completeness: 'Completeness', measurable_impact: 'Measurable impact', chronology_health: 'Date consistency' };

function UploadAndParseTab({ user, memory, resumeText: globalResumeText, initialProfile, onResumeExtracted, onPdfUploaded, onProfileParsed, onGoToBuilder, setActiveModule }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [rawText, setRawText]   = useState(globalResumeText || '');
  const [fileInfo, setFileInfo] = useState(
    globalResumeText ? { name: 'resume (from memory)', words: globalResumeText.trim().split(/\s+/).length } : null
  );
  const [profile, setProfile]   = useState(initialProfile || null);
  const [error, setError]       = useState('');
  const [localSkills, setLocalSkills] = useState(initialProfile?.skills?.filter(s => s.trim()) || []);
  const [skillInputVal, setSkillInputVal] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  // The ATS readiness score shown to the user. Product decision 2026-10-09 (later): the number is computed by code (src/scoring/), never by the
  // model, so the same resume always gets the same score and the score survives an AI outage. Covers all three ways rawText changes here (loaded from memory, a file upload, or the paste
  // textarea) in one place. Pure/synchronous (no AI, no network — src/scoring/'s own tests enforce that),
  // so no loading state is needed for it.
  const [detResult, setDetResult] = useState(null);

  useEffect(() => {
    if (profile?.skills) setLocalSkills(profile.skills.filter(s => s.trim()));
  }, [profile]);

  useEffect(() => {
    const result = rawText && rawText.trim() ? computeDeterministicScore(rawText) : null;
    setDetResult(result);
    if (result) console.log('[ATS Builder] computed ATS readiness score:', result.score);
  }, [rawText]);

  const parseResume = async (text) => {
    setLoading(true); setProfile(null); setError('');
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Parse this resume and extract all structured data for a resume builder.
Resume text:
${text.slice(0, 5000)}

Return ONLY raw JSON (no markdown, start with {):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "linkedin handle or URL",
  "location": "city / region",
  "targetRole": "most recent or target role title",
  "experience": "X years",
  "topSkills": ["skill1","skill2","skill3"],
  "market": "city / region",
  "summary": "professional summary paragraph if present, else empty string",
  "workExperience": [{"title":"job title","company":"company name","period":"date range","duration":"X years","bullets":["bullet point 1","bullet point 2"]}],
  "education": [{"degree":"degree name","institution":"school","year":"graduation year","gpa":"if present"}],
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "awards": ["award 1","award 2"],
  "extras": [{"heading":"Section Name as written in resume","items":["item 1","item 2"]}],
  "issues": [
    {"severity":"critical","title":"4-6 word specific title","description":"2-3 sentences: what is wrong and why it hurts.","before":"exact weak text quoted from resume","after":"improved version with specifics","builderStep":2,"module":null}
  ]
}
For extras: include every section not already captured above (e.g. Certifications, Publications, Projects, Volunteer, Languages, Interests, Patents, etc.). Do NOT put work experience, education, skills, awards, or summary into extras.

issues: List 3-6 specific, actionable problems found in THIS resume. Rules:
- severity: "critical" (the resume is likely rejected because of it), "high" (clearly hurts screening), "medium" (worth fixing)
- title: 4-6 words, hyper-specific (NOT "Improve bullet quality" — instead "No metrics in any bullet")
- description: 2-3 sentences. Name the exact problem and why it hurts ATS or recruiter screening.
- before: quote exact weak text from the resume (keep short, max 12 words)
- after: rewritten version showing the fix for that specific text
- builderStep: 1=Contact, 2=Experience, 3=Education, 4=Skills, 5=Summary — the builder step where this is fixed; null if not fixable in builder
- module: "scan" if this issue requires comparing against a JD (keyword gaps); null otherwise
Only include issues that are genuinely present. Do not fabricate problems.

Do NOT output any overall score or per-dimension scores: the score is computed by code, not by you. Your job here is to extract the data and to explain concrete problems.` }], 4000);
      const parsed = extractJSON(raw);
      if (!parsed.error) {
        setProfile(parsed);
        if (onProfileParsed) onProfileParsed(parsed);
      } else {
        setError('Could not parse resume — try a different file.');
      }
    } catch (err) {
      console.error('[parseResume]', err);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit'))
        setError('Too many requests — wait 30 seconds and try again.');
      else if (msg.includes('suspended') || msg.includes('permission denied') || msg.includes('403') || msg.includes('401') || msg.includes('api key'))
        setError('AI service unavailable — contact support.');
      else
        setError('Parse failed — try again or paste your resume text instead.');
    }
    setLoading(false);
  };

  const handleFile = async (file) => {
    setError(''); setFileInfo(null); setProfile(null);
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const ab = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
        text = value;
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const ab = await file.arrayBuffer();
        // Store base64 for memory persistence — also feeds Live Editor without re-upload
        const b64 = arrayBufferToBase64(ab);
        if (onPdfUploaded) onPdfUploaded(b64);
        text = await extractTextFromPdfFile(file);
      } else {
        const ab = await file.arrayBuffer();
        text = new TextDecoder().decode(ab);
      }
      if (!text.trim()) { setError('Could not extract text — try a DOCX or paste your resume.'); return; }
      const words = text.trim().split(/\s+/).length;
      setFileInfo({ name: file.name, words });
      setRawText(text);
      if (onResumeExtracted) onResumeExtracted(text);
      await parseResume(text);
    } catch (err) {
      setError('Could not read file — try a DOCX or paste your resume below.');
    }
  };

  // The score shown to the user is computed by code from the resume text (src/scoring/), never by the model.
  const detScore = Number.isFinite(detResult?.score?.score) ? detResult.score.score : null;
  const atsColor = detScore !== null
    ? detScore >= 80 ? '#00E5A0' : detScore >= 60 ? '#FFB84D' : '#FF5A5A'
    : 'var(--lp-text3)';

  return (
    <div className="atb-parse-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: 500 }}>
      {/* Left */}
      <div className="atb-parse-left-pane" style={{ borderRight: '1px solid var(--lp-bdr)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          Import Resume
        </div>

        {/* Drop zone — success state when file loaded, upload prompt otherwise */}
        <div
          style={{
            border: `2px dashed ${fileInfo ? '#00E5A0' : dragOver ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
            borderRadius: 10, padding: '24px 20px', textAlign: 'center',
            cursor: fileInfo ? 'default' : 'pointer', transition: 'all .15s',
            background: fileInfo ? 'rgba(0,229,160,.05)' : dragOver ? 'rgba(236,72,153,.04)' : 'transparent',
          }}
          onDragOver={e => { if (!fileInfo) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => { if (!fileInfo) inputRef.current?.click(); }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

          {fileInfo ? (
            <>
              <div style={{ color: '#00E5A0', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                ✓ {fileInfo.name}
              </div>
              <div style={{ color: 'var(--lp-text3)', fontSize: 11 }}>
                {fileInfo.words.toLocaleString()} words · extracted
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFileInfo(null); setRawText(''); setProfile(null); inputRef.current?.click(); }}
                style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'var(--lp-text3)', fontSize: 10, padding: '3px 10px', cursor: 'pointer' }}
              >
                Replace file
              </button>
            </>
          ) : (
            <>
              <div style={{ color: 'var(--lp-text2)', fontSize: 13, marginBottom: 6 }}>
                Drop your PDF or{' '}
                <span style={{ color: 'var(--lp-teal)', fontWeight: 700 }}>browse files</span>
              </div>
              <div style={{ color: 'var(--lp-text3)', fontSize: 11 }}>PDF · DOCX · TXT accepted</div>
            </>
          )}
        </div>

        {/* Paste textarea — shown when no file is loaded, and also after a failed parse so the error's advice (paste the text) is possible */}
        {(!fileInfo || error) ? (
          <>
            <div style={{ textAlign: 'center', color: 'var(--lp-text3)', fontSize: 12 }}>or paste resume text</div>
            <textarea
              value={rawText}
              onChange={e => { setRawText(e.target.value); setProfile(null); setError(''); }}
              placeholder="Paste your resume text here..."
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical',
                background: 'rgba(236,72,153,0.03)', border: '1px solid var(--lp-bdr)',
                borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
                fontSize: 13, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(236,72,153,0.4)'}
              onBlur={e => e.target.style.borderColor = 'var(--lp-bdr)'}
            />
          </>
        ) : null}

        <button
          onClick={() => { if (rawText.trim()) { if (onResumeExtracted) onResumeExtracted(rawText); parseResume(rawText); } }}
          disabled={loading || !rawText.trim()}
          style={{
            width: '100%', padding: '12px 0',
            background: loading || !rawText.trim() ? 'var(--lp-bdr)' : 'var(--lp-teal)',
            color: loading || !rawText.trim() ? 'var(--lp-text3)' : '#000',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800,
            cursor: loading || !rawText.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Parsing…' : profile ? 'Re-parse →' : 'Parse and build profile →'}
        </button>

        {error && (
          <div style={{ color: '#FF5A5A', fontSize: 12, padding: '8px 12px', background: 'rgba(255,90,90,.08)', borderRadius: 8, border: '1px solid rgba(255,90,90,.2)' }}>
            {error}
          </div>
        )}

        {/* Profile Extracted table */}
        {profile && (
          <div style={{ background: 'var(--lp-bg2)', borderRadius: 10, border: '1px solid var(--lp-bdr)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
              Profile Extracted
            </div>
            {[
              { k: 'Target role',  v: profile.targetRole  },
              { k: 'Experience',   v: profile.experience  },
              { k: 'Market',       v: profile.market      },
              { k: 'Resume readiness', v: detScore !== null ? `${detScore}/100` : '—', color: atsColor },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
                <span style={{ color: 'var(--lp-text3)', fontSize: 12 }}>{row.k}</span>
                <span style={{ color: row.color || 'var(--lp-text)', fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{row.v || '—'}</span>
              </div>
            ))}
            {/* Top skills as pills */}
            {(profile.topSkills || []).length > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
                <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginBottom: 8 }}>Top skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(profile.topSkills || []).map((s, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(0,229,160,.10)', color: '#00E5A0',
                      border: '1px solid rgba(0,229,160,.25)',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {/* ATS score contextual CTA */}
            {detScore !== null && setActiveModule && (
              <div style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--lp-text3)', lineHeight: 1.6 }}>
                {detScore < 80
                  ? <>Score below 80 — <button onClick={() => setActiveModule('scan')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lp-teal)', fontSize: 11.5, cursor: 'pointer', fontWeight: 700 }}>scan vs a JD in Resume Scanner →</button></>
                  : <>Strong resume — <button onClick={() => setActiveModule('scan')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lp-teal)', fontSize: 11.5, cursor: 'pointer', fontWeight: 700 }}>scan vs a target JD to optimise keywords →</button></>
                }
              </div>
            )}
          </div>
        )}

        {/* Verify extracted content accordion */}
        {profile && (
          <div style={{ border: '1px solid var(--lp-bdr)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setVerifyOpen(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--lp-bg2)', border: 'none', cursor: 'pointer', color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              <span>Verify extracted content</span>
              <span style={{ fontSize: 9 }}>{verifyOpen ? '▲' : '▼'}</span>
            </button>
            {verifyOpen && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--lp-bg3)' }}>
                {profile.workExperience?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Work Experience ({profile.workExperience.length})
                    </div>
                    {profile.workExperience.slice(0, 3).map((w, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: i < Math.min(profile.workExperience.length, 3) - 1 ? '1px solid var(--lp-bdr2)' : 'none' }}>
                        <div style={{ color: 'var(--lp-text)', fontSize: 12, fontWeight: 700 }}>{w.title} · {w.company}</div>
                        <div style={{ color: 'var(--lp-text3)', fontSize: 10, marginTop: 2 }}>{w.period}{w.duration ? ` · ${w.duration}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                {profile.education?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Education</div>
                    {profile.education.slice(0, 2).map((e, i) => (
                      <div key={i} style={{ color: 'var(--lp-text)', fontSize: 12, fontWeight: 700 }}>{e.degree} · {e.institution}</div>
                    ))}
                  </div>
                )}
                {profile.skills?.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--lp-text3)' }}>{profile.skills.length} skills extracted</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right — Diagnostic Report */}
      <div className="atb-parse-preview-pane" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Empty state */}
        {!loading && !profile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--lp-text3)', gap: 8, opacity: .5 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div style={{ fontSize: 12 }}>Upload a resume to see your diagnostic report</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--lp-text3)', fontSize: 13 }}>
            <OrbitSpinner size={40} />
            Analysing resume…
          </div>
        )}

        {!loading && profile && (() => {
          const hasScore = detScore !== null;
          const score = hasScore ? detScore : 0;
          const scoreColor = score >= 80 ? '#00E5A0' : score >= 60 ? '#FFB84D' : '#FF5A5A';
          const scoreLabel = !hasScore ? 'Not enough readable content to score' : score >= 80 ? 'Strong Resume' : score >= 60 ? 'Needs Improvement' : 'Needs Major Work';
          const circumference = 2 * Math.PI * 28;
          const goToBuilder = () => { if (onProfileParsed) onProfileParsed({ ...profile, skills: localSkills }); if (onGoToBuilder) onGoToBuilder(); };

          return (
            <>
              {/* Section 1 — Score Hero */}
              <div className="atb-score-hero" style={{ background: 'var(--lp-bg2)', borderRadius: 12, border: '1px solid var(--lp-bdr)', padding: '20px 20px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', marginBottom: 18 }}>
                  Resume Readiness
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                  <svg className="atb-score-ring" width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="var(--lp-bdr2, rgba(255,255,255,.13))" strokeWidth="6"/>
                    <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor} strokeWidth="6"
                      strokeDasharray={`${circumference * score / 100} ${circumference}`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                      style={{ transition: 'stroke-dasharray .6s ease' }}
                    />
                  </svg>
                  <div>
                    <div className="atb-score-number" style={{ fontSize: 42, fontWeight: 900, color: scoreColor, lineHeight: 1, letterSpacing: '-2px' }}>{hasScore ? score : '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text3)', marginTop: 2 }}>{hasScore ? 'out of 100' : 'no score yet'}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor, marginTop: 6 }}>{scoreLabel}</div>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--lp-bdr)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 2, transition: 'width .6s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--lp-text3)', marginTop: 10, lineHeight: 1.5 }}>
                  Calculated by fixed rules from your resume text (completeness, quantified bullets, date consistency): the same resume always gets the same score. The AI does not set this number; it only explains the problems below. It is not a prediction of interviews or hiring: real recruiting systems do not publish one universal ATS score.
                </div>
              </div>

              {/* Section 2 — Score Breakdown (computed by code; each part says what was counted) */}
              {detResult?.score?.parts?.length > 0 && (
                <div style={{ background: 'var(--lp-bg2)', borderRadius: 12, border: '1px solid var(--lp-bdr)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--lp-bdr)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)' }}>
                    Score Breakdown
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {detResult.score.parts.map(part => {
                      const assessed = Number.isFinite(part.score);
                      const c = !assessed ? 'var(--lp-text3)' : part.score >= 80 ? '#00E5A0' : part.score >= 60 ? '#FFB84D' : '#FF5A5A';
                      return (
                        <div key={part.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="atb-dim-label" style={{ fontSize: 11.5, color: 'var(--lp-text2)', width: 118, flexShrink: 0 }}>{PART_LABELS[part.id] || part.id}</span>
                            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--lp-bdr)' }}>
                              <div style={{ height: '100%', width: `${assessed ? part.score : 0}%`, background: c, borderRadius: 2, transition: 'width .5s ease' }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: c, width: 26, textAlign: 'right', flexShrink: 0 }}>{assessed ? part.score : '—'}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--lp-text3)', marginTop: 3, marginLeft: 128, lineHeight: 1.4 }}>
                            {assessed ? (part.evidence || []).join(' · ') : 'Not assessed: this resume has nothing to check here yet.'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3 — Issues */}
              {profile.issues?.length > 0 && (
                <div className="atb-issues-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Issues to Fix
                    <span style={{ background: 'rgba(255,90,90,.12)', color: '#FF5A5A', border: '1px solid rgba(255,90,90,.25)', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                      {profile.issues.length} found
                    </span>
                  </div>
                  {profile.issues.map((issue, i) => {
                    const sev = issue.severity === 'critical'
                      ? { color: '#FF5A5A', label: 'CRITICAL' }
                      : issue.severity === 'high'
                      ? { color: '#FFB84D', label: 'HIGH' }
                      : { color: '#8B9CC8', label: 'MEDIUM' };
                    return (
                      <div key={i} className="atb-issue-card" style={{ background: 'var(--lp-bg2)', borderRadius: 10, border: '1px solid var(--lp-bdr)', borderLeft: `3px solid ${sev.color}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', lineHeight: 1.3 }}>{issue.title}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: `${sev.color}18`, color: sev.color, border: `1px solid ${sev.color}30`, letterSpacing: .5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {sev.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--lp-text2)', lineHeight: 1.65 }}>{issue.description}</p>
                        {(issue.before || issue.after) && (
                          <div className="atb-before-after" style={{ background: 'var(--lp-bg3)', borderRadius: 7, padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--lp-bdr)' }}>
                            {issue.before && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: '#FF5A5A', fontWeight: 700, flexShrink: 0 }}>Before</span>
                                <span style={{ color: 'var(--lp-text2)' }}>{issue.before}</span>
                              </div>
                            )}
                            {issue.after && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: '#00E5A0', fontWeight: 700, flexShrink: 0 }}>After  </span>
                                <span style={{ color: 'var(--lp-text)' }}>{issue.after}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {issue.builderStep != null
                          ? <button onClick={goToBuilder} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--lp-teal)', color: 'var(--lp-teal)', borderRadius: 7, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Fix in Builder →
                            </button>
                          : issue.module === 'scan' && setActiveModule
                          ? <button onClick={() => setActiveModule('scan')} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text2)', borderRadius: 7, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Scan vs JD →
                            </button>
                          : null
                        }
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom CTA */}
              {onGoToBuilder && (
                <button onClick={goToBuilder} style={{ width: '100%', padding: '14px 0', background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}>
                  Fix These Issues in Builder →
                </button>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── AI Bullet Rewrite Tab (kept for potential future use) ─────────────────────
function BulletRewriteTab({ resumeText: sharedResume, targetRole: sharedRole }) {
  const [bullets, setBullets]   = useState('');
  const [context, setContext]   = useState(sharedRole || '');
  const [loading, setLoading]   = useState(false);
  const [rewrites, setRewrites] = useState([]);

  const resumeCtx = sharedResume ? digestResume(sharedResume, 3000).text : null;

  const rewrite = async () => {
    if (!bullets.trim()) return;
    setLoading(true); setRewrites([]);
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Rewrite these resume bullets to be stronger, more quantified, and ATS-optimised.
Context/role: ${context || 'general'}${resumeCtx ? `\nResume context:\n${resumeCtx}` : ''}
Bullets:
${bullets}

Return ONLY raw JSON array (no markdown, start with [):
[{"before":"original bullet","after":"rewritten bullet with numbers and strong verbs"}]
Rewrite every bullet. Never use placeholders.` }], 4000);
      const parsed = extractJSON(raw);
      if (Array.isArray(parsed)) setRewrites(parsed);
    } catch { /* silent */ }
    setLoading(false);
  };

  const inp = {
    width: '100%', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)',
    borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <div style={{ color: 'var(--lp-text)', fontWeight: 700, fontSize: 15 }}>AI Bullet Rewrite</div>
      <div style={{ color: 'var(--lp-text3)', fontSize: 12 }}>
        Paste weak bullets — AI rewrites them with numbers, strong action verbs, and ATS keywords.
      </div>

      {sharedResume && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,229,160,.06)', border: '1px solid rgba(0,229,160,.2)', borderRadius: 8 }}>
          <span style={{ color: '#00E5A0', fontSize: 13 }}>✓</span>
          <span style={{ color: 'var(--lp-text2)', fontSize: 12 }}>Resume loaded from Upload & Parse — AI will use it as context for rewrites.</span>
        </div>
      )}

      <div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Target role / context</div>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. Senior Product Manager" style={{ ...inp, resize: 'none', minHeight: 'auto' }} />
      </div>

      <div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Your bullets (one per line)</div>
        <textarea value={bullets} onChange={e => setBullets(e.target.value)}
          placeholder={"Helped drive product roadmap\nWorked with teams on deliverables\nAssisted with customer research"}
          style={{ ...inp, minHeight: 120 }} />
      </div>

      <button onClick={rewrite} disabled={loading || !bullets.trim()}
        style={{
          padding: '12px 24px', background: loading ? 'var(--lp-bdr)' : 'var(--lp-teal)',
          color: loading ? 'var(--lp-text3)' : '#000', border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', width: 'fit-content',
        }}>
        {loading ? 'Rewriting…' : 'Rewrite with AI →'}
      </button>

      {rewrites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rewrites.map((r, i) => (
            <div key={i} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', fontSize: 12, fontStyle: 'italic' }}>
                {r.before}
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--lp-teal)', fontSize: 16 }}>→</span>
                <span style={{ color: 'var(--lp-text)', fontSize: 13, fontWeight: 600, flex: 1 }}>{r.after}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Version History Tab ───────────────────────────────────────────────────────
function VersionHistoryTab({ memory, onRestore }) {
  const versions = memory?.resumeVersions || [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ color: 'var(--lp-text)', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Version History</div>
      <div style={{ color: 'var(--lp-text3)', fontSize: 12, marginBottom: 20 }}>Saved resume snapshots. Restore any version back into the Builder.</div>

      {versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--lp-text3)', fontSize: 13, opacity: .6 }}>
          No versions saved yet. Build your resume in the Builder tab and save a version.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...versions].reverse().map((v, i) => (
            <div key={i} style={{
              background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)',
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--lp-text)', fontSize: 13, fontWeight: 600 }}>{v.label || `Version ${versions.length - i}`}</div>
                <div style={{ color: 'var(--lp-text3)', fontSize: 11, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                  {v.templateLabel && <span>· {v.templateLabel}</span>}
                  {v.data?.contact?.name && <span>· {v.data.contact.name}</span>}
                </div>
              </div>
              <button
                onClick={() => onRestore && onRestore(v)}
                style={{
                  background: 'transparent', border: '1px solid var(--lp-bdr)',
                  color: 'var(--lp-text2)', borderRadius: 6, padding: '5px 14px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Restore →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Builder Tab ───────────────────────────────────────────────────────────────
const BUILDER_STEPS = ['Contact', 'Experience', 'Education', 'Skills', 'Summary', 'Review'];

// Sample resume shown in template carousel before user uploads their own
const SAMPLE_DATA = {
  contact: { name: 'Alex Chen', email: 'alex.chen@email.com', phone: '+1 (415) 555-0192', linkedin: 'linkedin.com/in/alexchen', location: 'San Francisco, CA' },
  summary: 'Product Manager with 6 years driving 0→1 launches in fintech and SaaS. Shipped features that grew DAU 40% and added $2.4M ARR. Strong in data-driven roadmaps, stakeholder alignment, and cross-functional execution.',
  experience: [
    { id: 0, company: 'Stripe', title: 'Senior Product Manager', period: '2022 – Present', bullets: ['Led 0→1 launch of Stripe Capital, acquiring 12,000 SMBs in first 6 months', 'Defined 3 OKR cycles delivering $2.4M incremental ARR', 'Reduced onboarding drop-off 38% via targeted checkout experiments'] },
    { id: 1, company: 'Intercom', title: 'Product Manager', period: '2019 – 2022', bullets: ['Owned messaging inbox — 2M+ DAU across 25,000 customers', 'Shipped AI reply suggestions, cutting avg handle time 22%', 'Ran 40+ A/B tests improving trial-to-paid conversion by 18%'] },
    { id: 2, company: 'Deloitte', title: 'Business Analyst', period: '2018 – 2019', bullets: ['Delivered digital transformation roadmap for Fortune 500 retail client', 'Built Tableau dashboards tracking $180M supply chain KPIs'] },
  ],
  education: [{ id: 0, institution: 'UC Berkeley', degree: 'B.S. Business Administration', year: '2018' }],
  skills: ['Product Strategy', 'OKR Frameworks', 'SQL', 'Figma', 'A/B Testing', 'Stakeholder Management', 'Agile / Scrum', 'Mixpanel'],
  awards: ['Product Hunt #1 — Stripe Capital', 'Intercom Innovation Award 2021'],
  extras: [{ heading: 'Certifications', items: ['AWS Certified Cloud Practitioner', 'Google Analytics Certified'] }],
};

function mapProfileToData(profile) {
  if (!profile) return JSON.parse(JSON.stringify(SAMPLE_DATA));
  return {
    contact: {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      linkedin: profile.linkedin || '',
      location: profile.location || profile.market || '',
    },
    summary: profile.summary || '',
    experience: (profile.workExperience?.length
      ? profile.workExperience
      : [{ id: 0, company: '', title: '', period: '', bullets: [''] }]
    ).map((w, i) => ({
      id: i,
      company: w.company || '',
      title: w.title || '',
      period: w.period || '',
      bullets: w.bullets?.length ? w.bullets : [''],
    })),
    education: (profile.education?.length
      ? profile.education
      : [{ id: 0, institution: '', degree: '', year: '' }]
    ).map((e, i) => ({
      id: i,
      institution: e.institution || '',
      degree: e.degree || '',
      year: e.year || '',
    })),
    skills: profile.skills?.filter(s => s).length ? profile.skills : [''],
    awards: profile.awards || [],
    extras: (profile.extras || [])
      .map(s => ({ heading: s.heading || '', items: (s.items || []).filter(i => i?.trim()) }))
      .filter(s => s.heading && s.items.length),
  };
}

// The builder draft lives in this browser, so it is stored per signed-in user. The old unscoped key leaked one person's resume into the next
// account used on the same browser; it is removed the first time a scoped draft is looked up.
const DRAFT_PREFIX = 'careerai_builder_draft';
const LEGACY_DRAFT_KEY = 'careerai_builder_draft';
export const builderDraftKey = (userId) => `${DRAFT_PREFIX}:${userId || 'guest'}`;
export const clearBuilderDraft = (userId) => { try { localStorage.removeItem(builderDraftKey(userId)); } catch {} };

function BuilderTab({ initialProfile, memory, onSaveVersion, restoredData, setActiveModule, user }) {
  const draftKey = builderDraftKey(user?.id);
  const [step, setStep] = useState(0);
  const [activeTemplate, setActiveTemplate] = useState('modern');
  const [skillInput, setSkillInput] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef(null);
  const [data, setData] = useState(() => {
    if (restoredData) return restoredData;
    try {
      localStorage.removeItem(LEGACY_DRAFT_KEY);
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return mapProfileToData(initialProfile);
  });
  const [isSample, setIsSample] = useState(!initialProfile && !restoredData && !localStorage.getItem(draftKey));
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const previewRef = useRef(null);

  // Autosave draft to localStorage on every change (skip sample placeholder data)
  useEffect(() => {
    if (isSample) return;
    try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch {}
  }, [data, isSample, draftKey]);

  // Sync restored data when user clicks Restore in history — only fires when non-null
  useEffect(() => {
    if (!restoredData) return;
    setData(JSON.parse(JSON.stringify(restoredData)));
    setIsSample(false);
    setSaved(false);
    setStep(0);
  }, [restoredData]);

  // Scale live preview to fit the panel width without horizontal overflow
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const available = e.contentRect.width - 32;
      setPreviewScale(available < 794 ? available / 794 : 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const inp = {
    width: '100%', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)',
    color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 13,
    fontFamily: 'var(--lp-ff)', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 10.5, color: 'var(--lp-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };
  const field = { display: 'flex', flexDirection: 'column', gap: 4 };

  const edit = (fn) => { setIsSample(false); setData(fn); };

  // Contact
  const setContact = (k, v) => edit(d => ({ ...d, contact: { ...d.contact, [k]: v } }));

  // Experience
  const setExpField = (i, k, v) => edit(d => {
    const exp = [...d.experience]; exp[i] = { ...exp[i], [k]: v }; return { ...d, experience: exp };
  });
  const setExpBullets = (i, text) => setExpField(i, 'bullets', text.split('\n'));
  const addExp = () => edit(d => ({ ...d, experience: [...d.experience, { id: Date.now(), company: '', title: '', period: '', bullets: [''] }] }));
  const removeExp = i => edit(d => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  // Education
  const setEduField = (i, k, v) => edit(d => {
    const edu = [...d.education]; edu[i] = { ...edu[i], [k]: v }; return { ...d, education: edu };
  });
  const addEdu = () => edit(d => ({ ...d, education: [...d.education, { id: Date.now(), institution: '', degree: '', year: '' }] }));
  const removeEdu = i => edit(d => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  // Skills / Summary
  const setSkills = text => edit(d => ({ ...d, skills: text.split('\n') }));
  const setSummary = v => edit(d => ({ ...d, summary: v }));

  const handleDownloadPdf = async () => {
    if (!previewRef.current || !ActiveTemplate) return;
    if (!previewRef.current.textContent?.trim()) return;
    setDownloading(true);
    const el = previewRef.current;
    const savedTransform = el.style.transform;
    const savedTransformOrigin = el.style.transformOrigin;
    el.style.transform = '';
    el.style.transformOrigin = '';
    const name = (data.contact.name || 'resume').replace(/\s+/g, '_');
    const tplLabel = TEMPLATES.find(t => t.id === activeTemplate)?.label || activeTemplate;
    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: `${name}_${tplLabel}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(el)
        .save();
    } finally {
      el.style.transform = savedTransform;
      el.style.transformOrigin = savedTransformOrigin;
      setDownloading(false);
    }
  };

  const handleSave = () => {
    const tpl = TEMPLATES.find(t => t.id === activeTemplate);
    const autoLabel = `Version ${(memory?.resumeVersions?.length || 0) + 1}`;
    const version = {
      date: new Date().toISOString(),
      template: activeTemplate,
      templateLabel: tpl?.label || activeTemplate,
      label: versionLabel.trim() || autoLabel,
      data: JSON.parse(JSON.stringify(data)),
    };
    onSaveVersion(version);
    setVersionLabel('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ActiveTemplate = TEMPLATES.find(t => t.id === activeTemplate)?.component;

  const navBtn = (label, onClick, primary) => (
    <button onClick={onClick} style={{
      padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
      border: primary ? 'none' : '1px solid var(--lp-bdr)',
      background: primary ? 'var(--lp-teal)' : 'transparent',
      color: primary ? '#000' : 'var(--lp-text2)',
    }}>{label}</button>
  );

  const sectionBox = (content) => (
    <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: 16 }}>
      {content}
    </div>
  );

  return (
    <div className="atb-builder-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 640 }}>

      {/* ── LEFT: step form ── */}
      <div style={{ borderRight: '1px solid var(--lp-bdr)', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Sample data banner */}
        {isSample && (
          <div style={{ background: 'rgba(236,72,153,.08)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--lp-teal)', lineHeight: 1.5 }}>
            👆 Sample resume shown — go to <strong>Upload & Parse</strong> tab to load yours
          </div>
        )}

        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {BUILDER_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              flex: 1, height: 3, borderRadius: 2, cursor: 'pointer',
              background: i <= step ? 'var(--lp-teal)' : 'var(--lp-bdr)', transition: 'background .2s',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Step {step + 1} of {BUILDER_STEPS.length}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 20 }}>
          {BUILDER_STEPS[step]}
        </div>

        {/* ── Contact ── */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={field}><label style={lbl}>Full Name</label><input style={inp} value={data.contact.name} onChange={e => setContact('name', e.target.value)} placeholder="Aman Ashwin" /></div>
            <div style={field}><label style={lbl}>Email</label><input style={inp} value={data.contact.email} onChange={e => setContact('email', e.target.value)} placeholder="you@email.com" /></div>
            <div style={field}><label style={lbl}>Phone</label><input style={inp} value={data.contact.phone} onChange={e => setContact('phone', e.target.value)} placeholder="+1 234 567 8900" /></div>
            <div style={field}><label style={lbl}>LinkedIn</label><input style={inp} value={data.contact.linkedin} onChange={e => setContact('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" /></div>
            <div style={field}><label style={lbl}>Location</label><input style={inp} value={data.contact.location} onChange={e => setContact('location', e.target.value)} placeholder="City, Country" /></div>
          </div>
        )}

        {/* ── Experience ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.experience.map((job, i) => (
              <div key={job.id ?? i}>
                {sectionBox(<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text2)' }}>Role {i + 1}</span>
                    {data.experience.length > 1 && <button onClick={() => removeExp(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', cursor: 'pointer', fontSize: 11 }}>✕ Remove</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={field}><label style={lbl}>Company</label><input style={inp} value={job.company} onChange={e => setExpField(i, 'company', e.target.value)} placeholder="Company Name" /></div>
                      <div style={field}><label style={lbl}>Period</label><input style={inp} value={job.period} onChange={e => setExpField(i, 'period', e.target.value)} placeholder="2020 – Present" /></div>
                    </div>
                    <div style={field}><label style={lbl}>Job Title</label><input style={inp} value={job.title} onChange={e => setExpField(i, 'title', e.target.value)} placeholder="Senior Engineer" /></div>
                    <div style={field}>
                      <label style={lbl}>Bullet Points (one per line)</label>
                      <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                        value={(job.bullets || ['']).join('\n')}
                        onChange={e => setExpBullets(i, e.target.value)}
                        placeholder={'Led a team of 5 to deliver X\nImproved performance by 30%'} />
                    </div>
                  </div>
                </>)}
              </div>
            ))}
            <button onClick={addExp} style={{ background: 'transparent', border: '1px dashed var(--lp-bdr)', color: 'var(--lp-teal)', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Role</button>
          </div>
        )}

        {/* ── Education ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.education.map((edu, i) => (
              <div key={edu.id ?? i}>
                {sectionBox(<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text2)' }}>Education {i + 1}</span>
                    {data.education.length > 1 && <button onClick={() => removeEdu(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', cursor: 'pointer', fontSize: 11 }}>✕ Remove</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={field}><label style={lbl}>Institution</label><input style={inp} value={edu.institution} onChange={e => setEduField(i, 'institution', e.target.value)} placeholder="University Name" /></div>
                    <div style={field}><label style={lbl}>Degree</label><input style={inp} value={edu.degree} onChange={e => setEduField(i, 'degree', e.target.value)} placeholder="B.Tech Computer Science" /></div>
                    <div style={field}><label style={lbl}>Year</label><input style={inp} value={edu.year} onChange={e => setEduField(i, 'year', e.target.value)} placeholder="2020" /></div>
                  </div>
                </>)}
              </div>
            ))}
            <button onClick={addEdu} style={{ background: 'transparent', border: '1px dashed var(--lp-bdr)', color: 'var(--lp-teal)', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Education</button>
          </div>
        )}

        {/* ── Skills ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Skill pills */}
            {data.skills.filter(s => s.trim()).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 8, alignContent: 'flex-start' }}>
                {data.skills.filter(s => s.trim()).map((skill, i) => (
                  <span key={skill + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(236,72,153,.1)', border: '1px solid rgba(236,72,153,.25)', color: 'var(--lp-teal)', borderRadius: 5, padding: '3px 8px 3px 10px', fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                    {skill}
                    <button
                      type="button"
                      onClick={() => edit(d => { const filled = d.skills.filter(s => s.trim()); filled.splice(i, 1); return { ...d, skills: filled }; })}
                      style={{ background: 'none', border: 'none', color: 'rgba(236,72,153,.6)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1, fontFamily: 'inherit', minHeight: 'unset' }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            {/* Add skill row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="skill-inp"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = skillInput.trim();
                    if (val) { edit(d => ({ ...d, skills: [...d.skills.filter(s => s.trim()), val] })); setSkillInput(''); }
                  }
                }}
                placeholder="e.g. Python"
                style={{ ...inp, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => { const val = skillInput.trim(); if (val) { edit(d => ({ ...d, skills: [...d.skills.filter(s => s.trim()), val] })); setSkillInput(''); document.getElementById('skill-inp')?.focus(); } }}
                style={{ padding: '8px 18px', background: 'var(--lp-teal)', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Add</button>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>2-3 sentences: years of experience, key skills, what you bring.</div>
            <textarea style={{ ...inp, minHeight: 120, resize: 'vertical' }}
              value={data.summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Data scientist with 7 years of experience in ML applied to real world problems…" />
          </div>
        )}

        {/* ── Review ── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>Pick a template from the right panel, then save your version.</div>
            {sectionBox(<>
              <div style={{ fontSize: 10.5, color: 'var(--lp-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Resume Summary</div>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 2 }}>
                <div>👤 {data.contact.name || '—'}</div>
                <div>💼 {data.experience.filter(j => j.company).length} role{data.experience.filter(j => j.company).length !== 1 ? 's' : ''}</div>
                <div>🎓 {data.education.filter(e => e.institution).length} education entr{data.education.filter(e => e.institution).length !== 1 ? 'ies' : 'y'}</div>
                <div>🛠 {data.skills.filter(s => s.trim()).length} skills</div>
                <div>📄 Template: {TEMPLATES.find(t => t.id === activeTemplate)?.label}</div>
              </div>
            </>)}
            <input
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder={`Version ${(memory?.resumeVersions?.length || 0) + 1} — add a label (optional)`}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', fontSize: 12, borderRadius: 8,
                border: '1px solid var(--lp-bdr)', background: 'var(--lp-bg3)',
                color: 'var(--lp-text)', outline: 'none', fontFamily: 'var(--lp-ff)',
              }}
            />
            <button onClick={handleSave} style={{
              width: '100%', padding: '14px 0', fontSize: 14, fontWeight: 800, borderRadius: 10, cursor: 'pointer', border: 'none',
              background: saved ? '#00E5A0' : 'var(--lp-teal)', color: '#000', transition: 'background .2s',
            }}>
              {saved ? '✓ Saved to history!' : 'Save Version'}
            </button>
            <button onClick={handleDownloadPdf} disabled={downloading} style={{
              width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 800, borderRadius: 10, cursor: downloading ? 'not-allowed' : 'pointer',
              border: '1px solid var(--lp-bdr)', background: 'transparent', color: 'var(--lp-teal)', transition: 'all .2s',
            }}>
              {downloading ? 'Generating PDF…' : '⬇ Download PDF'}
            </button>
            {setActiveModule && (
              <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--lp-bg3)', borderRadius: 10, border: '1px solid var(--lp-bdr)' }}>
                <div style={{ fontSize: 10, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>What's next?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Scan vs JD', module: 'scan' },
                    { label: 'Cover Letter', module: 'cover' },
                    { label: 'Browse Jobs', module: 'jobs' },
                  ].map(({ label, module }) => (
                    <button key={module} onClick={() => setActiveModule(module)} style={{
                      flex: 1, minWidth: 90, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--lp-bdr)', background: 'transparent', color: 'var(--lp-text2)', transition: 'all .15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lp-teal)'; e.currentTarget.style.color = 'var(--lp-teal)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-bdr)'; e.currentTarget.style.color = 'var(--lp-text2)'; }}
                    >{label} →</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 10, borderTop: '1px solid var(--lp-bdr)', marginTop: 16 }}>
          {step > 0 ? navBtn('← Back', () => setStep(s => s - 1), false) : <div />}
          {step < BUILDER_STEPS.length - 1 && navBtn('Next →', () => setStep(s => s + 1), true)}
        </div>
      </div>

      {/* ── RIGHT: template carousel + live preview ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Carousel */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--lp-bg3)', flexShrink: 0 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setActiveTemplate(t.id)} style={{
              padding: '5px 13px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all .15s', borderLeft: `3px solid ${t.accent}`,
              background: activeTemplate === t.id ? 'var(--lp-teal)' : 'transparent',
              color: activeTemplate === t.id ? '#000' : 'var(--lp-text2)',
              border: `1px solid ${activeTemplate === t.id ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
              borderLeftColor: t.accent, borderLeftWidth: 3,
            }}>
              {activeTemplate === t.id ? '✓ ' : ''}{t.label}
            </button>
          ))}
        </div>

        {/* Download button */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--lp-bdr)', background: 'var(--lp-bg3)', flexShrink: 0 }}>
          <button onClick={handleDownloadPdf} disabled={downloading} style={{
            width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 800, borderRadius: 7, cursor: downloading ? 'not-allowed' : 'pointer',
            border: 'none', background: downloading ? 'var(--lp-bg2)' : 'var(--lp-teal)', color: '#000', transition: 'background .2s',
          }}>
            {downloading ? 'Generating PDF…' : '⬇ Download PDF'}
          </button>
        </div>

        {/* Live preview — A4 width (794px = 210mm @ 96dpi) */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#e0e0e0', padding: '16px' }}>
          <div style={{ fontSize: 9, color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }}>
            Live Preview · A4
          </div>
          {/* Clip wrapper prevents horizontal layout overflow when scaled */}
          <div style={{ width: previewScale < 1 ? Math.round(794 * previewScale) : 794, overflow: 'hidden', margin: '0 auto' }}>
            <div ref={previewRef} style={{
              width: 794,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              boxShadow: '0 4px 24px rgba(0,0,0,.2)',
            }}>
              {ActiveTemplate && <ActiveTemplate {...data} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ATSBuilder ────────────────────────────────────────────────────────────
const ATSBuilder = ({ user, memory, updateMemory, onProTrigger, form, setActiveModule, resumeText: globalResumeRaw, setResumeText: setGlobalResumeText }) => {
  const globalResume = resumeContent(globalResumeRaw); // Resume Scan stores an object here, not a string
  const [mainTab, setMainTab] = useState('parse');
  const [entryMode, setEntryMode] = useState(null); // null=choose, 'scratch', 'existing'

  // Resume data
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [resumeText, setResumeTextState] = useState(globalResume || '');

  // Called by UploadAndParseTab — shares text + persists to Supabase + localStorage
  const handleResumeExtracted = (text) => {
    setResumeTextState(text);
    if (setGlobalResumeText) setGlobalResumeText(text);
    else if (updateMemory) updateMemory(m => ({ ...m, resumeText: text }));
  };

  // Called by UploadAndParseTab when PDF uploaded — store b64 so Live Editor + re-login can restore PDF without re-upload
  const handlePdfUploaded = (b64) => {
    setPdfBase64(b64);
    setPdfUrl(base64ToBlobUrl(b64));
    if (updateMemory) updateMemory(m => ({ ...m, scanPdfBase64: b64 }));
  };

  // Called by UploadAndParseTab when parse succeeds — persist profile so re-login shows cards without re-parsing
  const handleProfileParsed = (parsedProfile) => {
    clearBuilderDraft(user?.id); // a newly parsed resume must win over an older saved draft
    if (updateMemory) updateMemory(m => ({ ...m, parseProfile: parsedProfile }));
  };

  // Builder tab state
  const [restoredData, setRestoredData] = useState(null);

  const handleSaveVersion = (version) => {
    if (updateMemory) {
      updateMemory(m => ({ ...m, resumeVersions: [...(m.resumeVersions || []), version] }));
    }
  };

  const handleRestore = (version) => {
    setRestoredData(version.data);
    setEntryMode('existing');
    setMainTab('builder');
  };

  // Sync globalResume into local state when memory loads after mount
  useEffect(() => {
    if (globalResume && !resumeText) setResumeTextState(globalResume);
  }, [globalResume]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="atb">
      {/* Page header + tab bar */}
      <div style={{ padding: '16px 24px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
        <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22 }}>Resume Builder</div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13, marginTop: 2, marginBottom: 0 }}>
          Upload your resume, build it with 5 templates, and save versions.
        </div>
        <ResumeBuilderTabBar active={mainTab} onTab={tab => { if (tab === 'builder') setEntryMode(null); setMainTab(tab); }} />
      </div>

      {/* Tab routing */}
      {mainTab === 'parse' && (
        <UploadAndParseTab
          user={user}
          memory={memory}
          resumeText={globalResume || resumeText}
          initialProfile={memory?.parseProfile || null}
          onResumeExtracted={handleResumeExtracted}
          onPdfUploaded={handlePdfUploaded}
          onProfileParsed={handleProfileParsed}
          onGoToBuilder={() => { setEntryMode('existing'); setMainTab('builder'); }}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'builder' && entryMode === null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 8 }}>How do you want to start?</div>
            <div style={{ fontSize: 13, color: 'var(--lp-text3)' }}>Choose a path to build your resume.</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
            <button
              onClick={() => { if (memory?.parseProfile) { setEntryMode('existing'); } else { setMainTab('parse'); } }}
              style={{ flex: '1 1 260px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lp-teal)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lp-bdr)'}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 6 }}>Upload existing resume</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>
                {memory?.parseProfile
                  ? 'Resume from memory detected — load it straight into the builder pre-filled.'
                  : "Upload your current CV. We'll parse it, check it against the universal resume standard, and load it into the builder pre-filled."}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--lp-teal)' }}>
                {memory?.parseProfile ? 'Load from memory →' : 'Go to Upload & Parse →'}
              </div>
            </button>
            <button
              onClick={() => setEntryMode('scratch')}
              style={{ flex: '1 1 260px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lp-teal)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lp-bdr)'}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>✍️</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 6 }}>Build from scratch</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>Start with a blank resume. Fill in your details step-by-step, pick a template, and download a professional PDF.</div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--lp-teal)' }}>Start blank →</div>
            </button>
          </div>
        </div>
      )}
      {mainTab === 'builder' && entryMode === 'existing' && (
        <BuilderTab
          user={user}
          initialProfile={memory?.parseProfile || null}
          memory={memory}
          onSaveVersion={handleSaveVersion}
          restoredData={restoredData}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'builder' && entryMode === 'scratch' && (
        <BuilderTab
          user={user}
          initialProfile={null}
          memory={memory}
          onSaveVersion={handleSaveVersion}
          restoredData={null}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'history' && (
        <VersionHistoryTab memory={memory} onRestore={handleRestore} />
      )}

    </div>
  );
};

export default ATSBuilder;
