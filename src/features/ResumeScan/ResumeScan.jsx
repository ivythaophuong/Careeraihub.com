import React, { useState, useRef, useEffect } from 'react';
import './resumeScan.css';
import { OrbitSpinner } from '../../components/OrbitMark';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { TEMPLATES } from '../ATSBuilder/resumeTemplates.jsx';
import html2pdf from 'html2pdf.js';
import mammoth from 'mammoth';
import { extractTextFromPdfFile } from '../../lib/resumeParser.js';
import { neutralizeInventedFigures, hasPlaceholder, revertInsertion } from '../../lib/factGuard.js';

// ── Preserved scan logic ──────────────────────────────────────────────────────

function buildScanPrompt(targetRole) {
  return `You are a ruthless hiring expert. Analyze this resume${targetRole ? ` for the role: ${targetRole}` : ''}.
Return ONLY raw JSON (no markdown, start with {):
{"credibilityScore":0-100,"metricsFound":0,"summary":"2-3 sentence verdict","issues":[{"severity":"critical|warning|ok","type":"Vague Bullet|Missing Metric|Weak Ownership|Strong Claim","original":"short quote max 8 words","fix":"specific XYZ-format fix: Achieved X, measured by Y, by doing Z"}],"interrogationQuestions":[{"source":"which claim","question":"tough specific question"}]}
Generate 4-6 issues and 5-7 questions hyper-specific to this resume's actual companies, roles, and claims.`;
}

function buildSnarkyPrompt(targetRole) {
  return `You are a brutally honest, entertainingly savage hiring expert who has seen 10,000 bad resumes and has zero patience for corporate fluff. Analyze this resume${targetRole ? ` for the role: ${targetRole}` : ''}.
Roast each issue with sharp wit — then immediately follow it with a specific XYZ-format fix (Achieved X, measured by Y, by doing Z) so the candidate knows exactly how to fix it.
Return ONLY raw JSON (no markdown, start with {):
{"credibilityScore":0-100,"metricsFound":0,"summary":"2-3 sentence brutally honest roast of this resume — be specific to the actual content, not generic","issues":[{"severity":"critical|warning|ok","type":"Vague Bullet|Missing Metric|Weak Ownership|Strong Claim","original":"short quote max 8 words","roast":"1 snarky sentence calling this out specifically","fix":"XYZ-format fix: Achieved X, measured by Y, by doing Z"}],"interrogationQuestions":[{"source":"which claim","question":"the most uncomfortable question a skeptical hiring manager would ask about this exact claim"}]}
Generate 4-6 issues. Be specific to this resume's actual content, companies, and claims.`;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Log steps shown during scanning ──────────────────────────────────────────

const LOG_STEPS = [
  { t: '00:01', c: 'rs-tc-parse', cat: 'PARSE', msg: 'Parsing resume structure...' },
  { t: '00:02', c: 'rs-tc-ats',   cat: 'ATS',   msg: 'Running ATS compatibility check...' },
  { t: '00:03', c: 'rs-tc-xyz',   cat: 'XYZ',   msg: 'Detecting XYZ-format bullets...' },
  { t: '00:04', c: 'rs-tc-ats',   cat: 'ATS',   msg: 'Scoring metric density...' },
  { t: '00:05', c: 'rs-tc-cover', cat: 'QUES',  msg: 'Generating interrogation questions...' },
  { t: '00:06', c: 'rs-tc-skill', cat: 'SCORE', msg: 'Finalising credibility score...' },
];

// ── ScoreGauge SVG ────────────────────────────────────────────────────────────

function ScoreGauge({ score = 0, color = '#00c8ff' }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270° sweep
  const filled = (score / 100) * arc;
  return (
    <svg width="110" height="100" viewBox="0 0 100 96">
      <defs>
        <filter id="rs-glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* background arc */}
      <circle
        cx="50" cy="54" r={r}
        fill="none" stroke="#1c1f2c" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${arc} ${circ - arc}`}
        transform="rotate(-135 50 54)"
      />
      {/* filled arc */}
      <circle
        cx="50" cy="54" r={r}
        fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform="rotate(-135 50 54)"
        style={{
          filter: `drop-shadow(0 0 7px ${color})`,
          transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)',
        }}
      />
      <text x="50" y="59" textAnchor="middle" fill="#e8eaf0" fontSize="22" fontWeight="800" fontFamily="'Bricolage Grotesque',Inter,sans-serif">{score}</text>
      <text x="50" y="72" textAnchor="middle" fill="#3d4560" fontSize="8" fontFamily="JetBrains Mono,monospace">ATS SCORE</text>
    </svg>
  );
}

// ── ProgBar ───────────────────────────────────────────────────────────────────

function ProgBar({ label, value, color }) {
  return (
    <div className="rs-prog-item">
      <div className="rs-prog-row">
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div className="rs-prog-track">
        <div
          className="rs-prog-fill"
          style={{ width: `${value}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

// ── KeywordBox ────────────────────────────────────────────────────────────────

function KeywordBox({ title, keywords = [], variant }) {
  return (
    <div className={`rs-kw-box ${variant}`}>
      <div className="rs-kw-title" style={{ color: variant === 'missing' ? 'var(--rs-red)' : 'var(--rs-green)' }}>
        {title}
      </div>
      <div className="rs-kw-list">
        {keywords.map((kw, i) => (
          <span key={i} className={`rs-kw-chip ${variant}`}>{kw}</span>
        ))}
        {keywords.length === 0 && (
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-text3)' }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── IssueCard ─────────────────────────────────────────────────────────────────

function IssueCard({ issue }) {
  const sevColor = issue.severity === 'critical' ? 'var(--rs-red)'
    : issue.severity === 'warning' ? 'var(--rs-gold)'
    : 'var(--rs-green)';

  const badgeBg = issue.severity === 'critical' ? 'rgba(255,95,110,0.12)'
    : issue.severity === 'warning' ? 'rgba(245,200,66,0.12)'
    : 'rgba(0,229,160,0.12)';

  return (
    <div className={`rs-issue-card sev-${issue.severity}`}>
      <div className="rs-issue-header">
        <span
          className="rs-sev-badge"
          style={{ background: badgeBg, color: sevColor, border: `1px solid ${sevColor}44` }}
        >
          {issue.severity}
        </span>
        <span className="rs-issue-type">{issue.type}</span>
      </div>
      <div className="rs-issue-original">"{issue.original}"</div>
      {issue.roast && (
        <div className="rs-issue-roast">{issue.roast}</div>
      )}
      <div className="rs-issue-fix">
        <span className="rs-xyz-badge rs-xyz-x">X</span>
        <span className="rs-xyz-badge rs-xyz-y">Y</span>
        <span className="rs-xyz-badge rs-xyz-z">Z</span>
        {' '}{issue.fix}
      </div>
    </div>
  );
}

// ── ScanHistoryCard (collapsible, restyled) ───────────────────────────────────

function ScanHistoryCard({ item, initExpanded }) {
  const [expanded, setExpanded] = useState(initExpanded);
  const res = item.result || { credibilityScore: item.score, issues: item.issues || [] };
  const score = res.credibilityScore || 0;
  const scoreColor = score >= 70 ? 'var(--rs-green)' : score >= 50 ? 'var(--rs-gold)' : 'var(--rs-red)';

  return (
    <div className="rs-hist-card">
      <div className="rs-hist-card-head" onClick={() => setExpanded(!expanded)}>
        <span className="rs-hist-card-name">{item.fileName}</span>
        <div className="rs-hist-card-meta">
          <span className="rs-hist-card-score" style={{ color: scoreColor }}>{score}</span>
          <span className={`rs-hist-card-chevron${expanded ? ' open' : ''}`}>▼</span>
        </div>
      </div>
      {expanded && (
        <div className="rs-hist-card-body">
          {res.summary && (
            <div style={{ fontSize: 11, color: 'var(--rs-text2)', lineHeight: 1.6 }}>{res.summary}</div>
          )}
          {res.issues?.length > 0 && res.issues.map((issue, i) => {
            const sc = issue.severity === 'critical' ? 'var(--rs-red)'
              : issue.severity === 'warning' ? 'var(--rs-gold)'
              : 'var(--rs-green)';
            return (
              <div key={i} className="rs-hist-issue" style={{ borderLeftColor: sc }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 8, fontFamily: 'JetBrains Mono,monospace', color: sc, textTransform: 'uppercase' }}>
                    {issue.severity}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-text3)' }}>
                    {issue.type}
                  </span>
                </div>
                <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-cyan)', marginBottom: 4 }}>
                  "{issue.original}"
                </div>
                {issue.roast && (
                  <div style={{ fontSize: 10, color: 'var(--rs-gold)', fontStyle: 'italic', marginBottom: 4 }}>{issue.roast}</div>
                )}
                <div style={{ fontSize: 10, color: 'var(--rs-green)' }}>{issue.fix}</div>
              </div>
            );
          })}
          {res.interrogationQuestions?.length > 0 && (
            <div>
              <div className="rs-section-head" style={{ marginBottom: 4 }}>Interrogation Questions</div>
              {res.interrogationQuestions.slice(0, 3).map((q, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 8, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-text3)', marginBottom: 2 }}>
                    From: {q.source}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--rs-text2)' }}>{q.question}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Derive keyword lists from scan result ─────────────────────────────────────
function deriveKeywords(result) {
  if (!result) return { missing: [], matched: [] };
  const missing = [];
  const matched = [];
  (result.issues || []).forEach(issue => {
    if (issue.severity === 'critical' || issue.severity === 'warning') {
      const words = issue.fix?.match(/\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?\b/g) || [];
      words.slice(0, 2).forEach(w => { if (!missing.includes(w)) missing.push(w); });
    }
    if (issue.severity === 'ok') {
      const words = issue.original?.match(/\b[A-Z][a-zA-Z]+\b/g) || [];
      words.slice(0, 1).forEach(w => { if (!matched.includes(w)) matched.push(w); });
    }
  });
  return { missing: missing.slice(0, 6), matched: matched.slice(0, 6) };
}

function deriveProgBars(result) {
  if (!result) return { bullet: 0, metrics: 0, ownership: 0 };
  const score = result.credibilityScore || 0;
  const issues = result.issues || [];
  const critCount = issues.filter(i => i.severity === 'critical').length;
  const bullet = Math.max(20, Math.min(100, score - critCount * 5));
  const metrics = Math.min(100, (result.metricsFound || 0) * 14);
  const ownership = Math.max(10, Math.min(100, score + 5 - critCount * 8));
  return { bullet, metrics, ownership };
}

// ── Clean text-to-PDF renderer used for scanner PDF export ────────────────────
function TextResumePDF({ text, accent }) {
  const lines = text.split('\n');
  const firstNonEmpty = lines.findIndex(l => l.trim());
  const SECTION_RE = /^(EXPERIENCE|EDUCATION|SKILLS?|SUMMARY|PROFILE|WORK|PROJECTS?|AWARDS?|CERTIF|PUBLICATIONS?|LANGUAGES?|REFERENCES?|CONTACT|PROFESSIONAL|ACHIEVEMENTS?|VOLUNTEER)/i;
  const effectiveAccent = accent === '#111' ? '#333' : accent;
  return (
    <div style={{ padding: '48px 52px', fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', color: '#222', width: 794, minHeight: 1122, boxSizing: 'border-box' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 7 }} />;
        if (i === firstNonEmpty) return <div key={i} style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 6, letterSpacing: 0.3 }}>{trimmed}</div>;
        const isSection = SECTION_RE.test(trimmed) && trimmed.length < 60 && trimmed === trimmed.toUpperCase();
        if (isSection) return (
          <div key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: effectiveAccent, borderBottom: `1.5px solid ${effectiveAccent}`, paddingBottom: 3, marginTop: 20, marginBottom: 8 }}>{trimmed}</div>
        );
        if (trimmed.match(/^[•\-·*]/)) return (
          <div key={i} style={{ fontSize: 11, color: '#333', lineHeight: 1.65, paddingLeft: 14, position: 'relative', marginBottom: 3 }}>
            <span style={{ position: 'absolute', left: 0, color: effectiveAccent }}>•</span>
            {trimmed.replace(/^[•\-·*]\s*/, '')}
          </div>
        );
        return <div key={i} style={{ fontSize: 11.5, color: '#333', lineHeight: 1.65, marginBottom: 2 }}>{trimmed}</div>;
      })}
    </div>
  );
}

// ── ATS Scanner main view (matches reference: no tabs, left card + right results) ──
function dataToResumeText(data) {
  const lines = [];
  if (data.contact?.name) lines.push(data.contact.name);
  const ct = [data.contact?.email, data.contact?.phone, data.contact?.location, data.contact?.linkedin].filter(Boolean);
  if (ct.length) lines.push(ct.join(' | '));
  if (data.summary) { lines.push(''); lines.push('SUMMARY'); lines.push(data.summary); }
  if (data.experience?.some(j => j.company || j.title)) {
    lines.push(''); lines.push('EXPERIENCE');
    data.experience.forEach(j => {
      if (!j.company && !j.title) return;
      lines.push(`${j.title || ''} — ${j.company || ''} (${j.period || ''})`);
      (j.bullets || []).filter(b => b.trim()).forEach(b => lines.push(`• ${b}`));
    });
  }
  if (data.education?.some(e => e.institution)) {
    lines.push(''); lines.push('EDUCATION');
    data.education.forEach(e => { if (e.institution) lines.push(`${e.degree || ''} — ${e.institution} (${e.year || ''})`); });
  }
  const skills = (data.skills || []).filter(s => s.trim());
  if (skills.length) { lines.push(''); lines.push('SKILLS'); lines.push(skills.join(', ')); }
  return lines.join('\n');
}

// A rewrite may only reuse figures the resume already contains; any other figure becomes a [X] blank.
function guardIssues(issues, resume) {
  return (issues || []).map(issue => {
    const g = neutralizeInventedFigures(issue.fix, resume);
    return { ...issue, fix: g.text, needsInput: hasPlaceholder(g.text) };
  });
}

function JDMatchTab({ resumeText, setResumeText, form, setActiveModule, updateMemory, memory }) {
  const [jd, setJd]           = useState('');
  const [loading, setLoading] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [result, setResult]   = useState(null);
  const [prevMatchScore, setPrevMatchScore] = useState(null);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [appliedFixes, setAppliedFixes]       = useState({});
  const [editingIdx, setEditingIdx]           = useState(null);
  const [editDraft, setEditDraft]             = useState('');
  const [editMode, setEditMode]               = useState(false);
  const [editorText, setEditorText]           = useState('');
  const [copyDone, setCopyDone]               = useState(false);
  const [editorPatchStatus, setEditorPatchStatus] = useState({});
  const [patchRecords, setPatchRecords]     = useState({}); // idx -> { inserted, original } so Revert can restore the source text

  const patchResume = (fixText, original, idx, trueOriginal) => {
    const base = editorText || resumeCtx;
    const clean = (original?.replace(/^["'"]+|["'"]+$/g, '') || '').trim();
    let patchedText = null;
    let matched = null;
    if (clean) {
      const exactPos = base.indexOf(clean);
      if (exactPos !== -1) {
        matched = clean;
        patchedText = base.slice(0, exactPos) + fixText + base.slice(exactPos + clean.length);
      } else {
        const escaped = clean.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\n]+');
        const m = base.match(new RegExp(escaped, 'i'));
        if (m) {
          const start = base.indexOf(m[0]);
          matched = m[0];
          patchedText = base.slice(0, start) + fixText + base.slice(start + m[0].length);
        }
      }
    }
    if (patchedText !== null) {
      setEditorText(patchedText);
      setEditorPatchStatus(s => ({ ...s, [idx]: 'patched' }));
      setPatchRecords(r => ({ ...r, [idx]: { inserted: fixText, original: trueOriginal ?? matched } }));
    } else {
      if (!editorText) setEditorText(base);
      setEditorPatchStatus(s => ({ ...s, [idx]: 'not_found' }));
    }
  };

  // Undo a fix in the resume text itself, not just on the card. If the user has since rewritten that passage
  // in the editor we cannot find it, so we say so and keep the fix applied rather than pretend it was undone.
  const revertFix = (idx) => {
    const rec = patchRecords[idx];
    if (rec) {
      const restored = revertInsertion(editorText, rec);
      if (restored === null) {
        setEditorPatchStatus(s => ({ ...s, [idx]: 'revert_failed' }));
        return;
      }
      setEditorText(restored);
    }
    setAppliedFixes(f => { const n = { ...f }; delete n[idx]; return n; });
    setEditorPatchStatus(s => { const n = { ...s }; delete n[idx]; return n; });
    setPatchRecords(r => { const n = { ...r }; delete n[idx]; return n; });
  };
  const [selectedTpl, setSelectedTpl]         = useState('modern');
  const [pdfDownloading, setPdfDownloading]   = useState(false);
  const [pdfExported, setPdfExported]         = useState(false);
  const [showRawEditor, setShowRawEditor]     = useState(false);
  const [failDismissed, setFailDismissed]     = useState(false);
  const [uploadParsing, setUploadParsing]     = useState(false);
  const [uploadErr, setUploadErr]             = useState('');
  const [uploadDragOver, setUploadDragOver]   = useState(false);
  const [templateProfile, setTemplateProfile] = useState(null);
  const [parsingTemplate, setParsingTemplate] = useState(false);
  const uploadRef = useRef(null);
  const pdfExportRef = useRef(null);

  const resumeCtx = resumeText
    ? (typeof resumeText === 'string' ? resumeText : resumeText.content || '') : '';

  const parseForTemplate = async (textToUse) => {
    if (templateProfile || parsingTemplate) return;
    const src = (textToUse || resumeCtx).trim();
    if (!src) return;
    setParsingTemplate(true);
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Parse this resume and extract structured data. Return ONLY raw JSON (no markdown, start with {):
{"name":"full name","email":"email","phone":"phone","linkedin":"linkedin url or handle","location":"city/region","summary":"professional summary","workExperience":[{"title":"job title","company":"company","period":"date range","bullets":["bullet 1"]}],"education":[{"degree":"degree","institution":"school","year":"graduation year"}],"skills":["skill1","skill2"],"awards":["award 1"],"extras":[{"heading":"Section Name","items":["item 1"]}]}

Resume:
${src.slice(0, 4000)}` }], 3000);
      const parsed = extractJSON(raw);
      if (!parsed.error) setTemplateProfile(parsed);
    } catch (_) { /* silently fall back to TextResumePDF */ } finally {
      setParsingTemplate(false);
    }
  };

  const profileToTemplateData = (p) => ({
    contact: { name: p.name || '', email: p.email || '', phone: p.phone || '', linkedin: p.linkedin || '', location: p.location || '' },
    summary: p.summary || '',
    experience: (p.workExperience || []).map((w, i) => ({ id: i, company: w.company || '', title: w.title || '', period: w.period || '', bullets: w.bullets || [] })),
    education: (p.education || []).map((e, i) => ({ id: i, institution: e.institution || '', degree: e.degree || '', year: e.year || '' })),
    skills: p.skills || [],
    awards: p.awards || [],
    extras: (p.extras || []).filter(s => s.heading && s.items?.length),
  });

  const handleResumeUpload = async (file) => {
    if (!file) return;
    setUploadErr('');
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') { setUploadErr('Only PDF or DOCX supported.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadErr('File too large — max 10 MB.'); return; }
    setUploadParsing(true);
    try {
      let text = '';
      if (ext === 'pdf') {
        text = await extractTextFromPdfFile(file);
      } else {
        const ab = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
        text = value;
      }
      if (text.trim().length < 50) throw new Error('Could not extract text from file.');
      setResumeText?.({ type: 'text', content: text, fileName: file.name });
    } catch (e) {
      setUploadErr(e.message || 'Parse failed. Try another file.');
    } finally {
      setUploadParsing(false);
    }
  };

  const scan = async () => {
    if (!jd.trim()) return;
    const lastAnalysis = (memory?.jdAnalyses || []).find(a => a.matchScore > 0);
    setPrevMatchScore(lastAnalysis?.matchScore ?? null);
    setLoading(true); setResult(null); setScanErr(''); setAppliedFixes({}); setEditingIdx(null); setEditDraft(''); setEditMode(false); setEditorPatchStatus({}); setPatchRecords({}); setFailDismissed(false); setPdfExported(false);
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Compare this resume against the job description and return a match analysis.
Resume:
${resumeCtx.slice(0, 3000) || 'No resume provided — infer from context.'}

Job Description:
${jd.slice(0, 2000)}

Return ONLY raw JSON (no markdown, start with {):
{
  "matchScore": 0-100,
  "roleTitle": "job title from the JD",
  "company": "company name from the JD or empty string",
  "verdict": "one phrase like Good match — 3 critical gaps to fix",
  "bars": [
    {"label":"Keywords matched","score":0-100},
    {"label":"Skills alignment","score":0-100},
    {"label":"Format score","score":0-100}
  ],
  "missingKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6","keyword7"],
  "aiInsight": "2-sentence specific advice about the biggest gap, without promising a score improvement",
  "issues": [
    {"severity":"critical|warning","type":"Vague Bullet|Missing Metric|Weak Ownership|Weak Impact","original":"exact short quote max 8 words from the resume","fix":"XYZ rewrite of the SAME bullet — keep the exact same role, company, and technologies already in the resume. Only improve structure and clarity. Never add a number, percentage, count, team size, timeline, tool, certification, or any level of ownership or scope that the resume does not already state. Where a figure would strengthen the bullet, write [X] (for example by [X]%) so the candidate fills in their real value, or leave it out."}
  ]
}
Generate 3-5 issues. Each issue must target an actual weak bullet from the resume. Fix must rewrite that bullet only — same context, better structure and impact. Do NOT reference the target company's specific tools, products, or proprietary services unless the candidate already mentions them in their resume.` }], 1500);
      const parsed = extractJSON(raw);
      if (!parsed.error) {
        setResult({ ...parsed, issues: guardIssues(parsed.issues, resumeCtx) });
        if (updateMemory) {
          updateMemory(
            m => ({ jdAnalyses: [{ date: new Date().toISOString(), roleTitle: parsed.roleTitle, matchScore: parsed.matchScore }, ...(m.jdAnalyses || [])].slice(0, 20) }),
            { table: 'jd_analyses', data: { role_title: parsed.roleTitle || form?.role || '', company: parsed.company || '', match_score: parsed.matchScore, keywords: parsed.bars || [], gaps: parsed.missingKeywords || [], advice: parsed.aiInsight || '' } }
          );
        }
      }
    } catch (e) {
      setScanErr(e?.message || 'Scan failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyApplied = () => {
    const text = Object.entries(appliedFixes).map(([, fix]) => `• ${fix}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const openEditor = () => { if (!editorText) setEditorText(resumeCtx); setEditMode(true); parseForTemplate(editorText || resumeCtx); };

  const copyEditor = () => {
    navigator.clipboard.writeText(editorText).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1500);
  };

  const downloadTxt = () => {
    const blob = new Blob([editorText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'resume-edited.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const appendKeyword = (kw) => {
    setEditorText(t => t + (t.endsWith('\n') ? '' : '\n') + `[Add: ${kw}]`);
  };

  const handleExportPdf = async () => {
    if (!pdfExportRef.current) return;
    setPdfDownloading(true);
    const tpl = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];
    const exportText = editorText || resumeCtx;
    const firstName = ((templateProfile?.name || exportText.split('\n').find(l => l.trim()) || 'resume')).replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 30);
    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: `${firstName}_${tpl.label.replace(/\s+/g, '_')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(pdfExportRef.current)
        .save();
      setPdfExported(true);
    } finally {
      setPdfDownloading(false);
    }
  };

  // Reset templateProfile when resume changes so export re-parses
  useEffect(() => { setTemplateProfile(null); }, [resumeCtx]);

  const phase = loading ? 'scanning' : editMode ? 'edit' : result ? 'results' : 'input';
  const scoreColor = result
    ? result.matchScore >= 80 ? '#00E5A0' : result.matchScore >= 60 ? '#FFB84D' : '#FF5A5A'
    : '#EC4899';
  const barColor = (s) => s >= 80 ? '#00E5A0' : s >= 60 ? '#FFB84D' : '#FF5A5A';

  /* ─── Hidden PDF render target — always mounted so ref is valid ─── */
  const pdfModal = (
    <div ref={pdfExportRef} style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1, width: 794 }}>
      {(() => {
        const tpl = TEMPLATES.find(t => t.id === selectedTpl) || TEMPLATES[0];
        if (templateProfile && tpl.component) {
          const T = tpl.component;
          return <T {...profileToTemplateData(templateProfile)} />;
        }
        return <TextResumePDF text={editorText || resumeCtx} accent={tpl.accent === '#111' ? '#333' : tpl.accent} />;
      })()}
    </div>
  );

  /* ════════════════════ INPUT PHASE ════════════════════ */
  if (phase === 'input') return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, animation: 'rs-fadein .3s ease' }}>
      <style>{`@keyframes rs-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="rs-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'stretch' }}>

        {/* Resume zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 10 }}>Your Resume</div>
          {/* Loaded resume state */}
          {resumeCtx && !showVersionPicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,229,160,.04)', border: '1.5px solid rgba(0,229,160,.25)', borderRadius: 14, padding: '20px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,229,160,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#00E5A0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resumeText?.fileName || 'Resume loaded'}</div>
                  <div style={{ fontSize: 10, color: 'var(--lp-text3)', marginTop: 2 }}>{resumeCtx.length.toLocaleString()} characters</div>
                </div>
              </div>
              <input ref={uploadRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => handleResumeUpload(e.target.files[0])} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => uploadRef.current?.click()} style={{ background: 'none', border: '1px solid rgba(0,229,160,.3)', color: '#00E5A0', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Upload new
                </button>
                {(memory?.resumeVersions?.length > 0) && (
                  <button onClick={() => setShowVersionPicker(true)} style={{ background: 'none', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Choose version
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Version picker */}
          {showVersionPicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Saved versions</div>
                <button onClick={() => setShowVersionPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', cursor: 'pointer', fontSize: 13, padding: 0, fontFamily: 'inherit' }}>✕</button>
              </div>
              {(memory?.resumeVersions || []).slice().reverse().map((v, i) => (
                <button key={i} onClick={() => { setResumeText({ content: dataToResumeText(v.data), fileName: v.label || `Version ${i + 1}` }); setShowVersionPicker(false); }} style={{ textAlign: 'left', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 9, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text)' }}>{v.label || `Version ${i + 1}`}</div>
                  <div style={{ fontSize: 10, color: 'var(--lp-text3)', marginTop: 2 }}>{v.templateLabel} · {new Date(v.date).toLocaleDateString()}</div>
                </button>
              ))}
              <input ref={uploadRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => { handleResumeUpload(e.target.files[0]); setShowVersionPicker(false); }} />
              <button onClick={() => uploadRef.current?.click()} style={{ background: 'none', border: '1px dashed var(--lp-bdr)', borderRadius: 9, padding: '10px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--lp-text3)', fontFamily: 'inherit', textAlign: 'left' }}>
                Upload new file instead
              </button>
            </div>
          )}

          {/* Upload drop zone (no resume loaded, no picker) */}
          {!resumeCtx && !showVersionPicker && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={e => { e.preventDefault(); setUploadDragOver(false); handleResumeUpload(e.dataTransfer.files[0]); }}
                onClick={() => !uploadParsing && uploadRef.current?.click()}
                style={{
                  minHeight: 140,
                  border: `2px dashed ${uploadDragOver ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
                  borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 10, cursor: uploadParsing ? 'default' : 'pointer',
                  background: uploadDragOver ? 'rgba(236,72,153,.04)' : 'transparent',
                  transition: 'all .2s',
                }}
              >
                <input ref={uploadRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={e => handleResumeUpload(e.target.files[0])} />
                {uploadParsing ? (
                  <><OrbitSpinner size={28} /><div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Parsing resume…</div></>
                ) : (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--lp-bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lp-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text2)' }}>Drop resume here</div>
                      <div style={{ fontSize: 11, color: 'var(--lp-text3)', marginTop: 3 }}>PDF or DOCX · click to browse</div>
                    </div>
                  </>
                )}
                {uploadErr && <div style={{ fontSize: 10, color: '#FF5A5A' }}>⚠ {uploadErr}</div>}
              </div>
              {(memory?.resumeVersions?.length > 0) && (
                <button onClick={() => setShowVersionPicker(true)} style={{ background: 'none', border: '1px solid var(--lp-bdr)', borderRadius: 9, padding: '10px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--lp-text3)', fontFamily: 'inherit', textAlign: 'left' }}>
                  Or choose a saved version →
                </button>
              )}
            </div>
          )}
        </div>

        {/* JD zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 10 }}>Job Description</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={jd} onChange={e => setJd(e.target.value)}
              placeholder={'Paste the full job description here…\ne.g. We are looking for a Senior Product Manager at Grab Singapore with 5+ years experience…'}
              style={{
                flex: 1, minHeight: 180, width: '100%',
                background: 'var(--lp-bg3)', border: '1.5px solid var(--lp-bdr)',
                borderRadius: 14, color: 'var(--lp-text)', padding: '16px 18px',
                fontSize: 13, outline: 'none', lineHeight: 1.6, resize: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', transition: 'border-color .15s',
              }}
              onFocus={e => { e.target.style.borderColor = 'rgba(236,72,153,.4)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--lp-bdr)'; }}
            />
            {scanErr && <div style={{ fontSize: 11, color: '#FF5A5A' }}>⚠ {scanErr}</div>}
            <button
              onClick={scan}
              disabled={!jd.trim() || !resumeCtx}
              style={{
                width: '100%', padding: '14px 0',
                background: (!jd.trim() || !resumeCtx) ? 'var(--lp-bdr)' : 'linear-gradient(135deg, #EC4899, #F59E0B)',
                color: (!jd.trim() || !resumeCtx) ? 'var(--lp-text3)' : '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800,
                cursor: (!jd.trim() || !resumeCtx) ? 'default' : 'pointer',
                letterSpacing: .3, transition: 'all .2s',
                boxShadow: (!jd.trim() || !resumeCtx) ? 'none' : '0 4px 20px rgba(236,72,153,.25)',
              }}
            >
              {!resumeCtx ? 'Upload resume first' : !jd.trim() ? 'Paste a job description' : 'Scan match →'}
            </button>
            {(!jd.trim() || !resumeCtx) && resumeCtx && (
              <div style={{ fontSize: 10, color: 'var(--lp-text3)', textAlign: 'center' }}>
                Both resume and JD needed to scan
              </div>
            )}
          </div>
        </div>
      </div>
      {pdfModal}
    </div>
  );

  /* ════════════════════ SCANNING PHASE ════════════════════ */
  if (phase === 'scanning') return (
    <div style={{ padding: '60px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, animation: 'rs-fadein .3s ease' }}>
      <OrbitSpinner size={52} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 4 }}>Analyzing match…</div>
        <div style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Comparing resume against job requirements</div>
      </div>
      {pdfModal}
    </div>
  );

  /* ════════════════════ EDIT PHASE ════════════════════ */
  if (phase === 'edit') {
    const ActiveTpl = TEMPLATES.find(t => t.id === selectedTpl)?.component;
    const tplData   = templateProfile ? profileToTemplateData(templateProfile) : null;
    const showTextPanel = !tplData || showRawEditor;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'rs-fadein .25s ease' }}>
        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderBottom: '1px solid var(--lp-bdr)', flexShrink: 0 }}>
          <button type="button" onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)' }}>Resume Editor</div>
          <button type="button" onClick={handleExportPdf} disabled={pdfDownloading || parsingTemplate} style={{
            padding: '9px 20px', background: (pdfDownloading || parsingTemplate) ? 'var(--lp-bdr)' : 'var(--lp-teal)',
            border: 'none', color: (pdfDownloading || parsingTemplate) ? 'var(--lp-text3)' : '#000',
            borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: (pdfDownloading || parsingTemplate) ? 'default' : 'pointer', whiteSpace: 'nowrap',
          }}>
            {pdfDownloading ? 'Generating…' : parsingTemplate ? 'Parsing…' : '⬇ Download PDF'}
          </button>
        </div>

        {/* ── Template carousel ── */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 24px', borderBottom: '1px solid var(--lp-bdr)', overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--lp-bg3)', flexShrink: 0 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} type="button" onClick={() => setSelectedTpl(t.id)} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
              background: selectedTpl === t.id ? 'var(--lp-teal)' : 'transparent',
              color: selectedTpl === t.id ? '#000' : 'var(--lp-text2)',
              border: `1px solid ${selectedTpl === t.id ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
              borderLeft: `3px solid ${t.accent === '#111' ? '#555' : t.accent}`,
            }}>
              {selectedTpl === t.id ? '✓ ' : ''}{t.label}
            </button>
          ))}
        </div>

        {/* ── Two-pane body ── */}
        <div className="rs-edit-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left — template preview */}
          <div style={{ background: '#d4d4d4', overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {parsingTemplate && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', color: 'var(--lp-text3)' }}>
                <OrbitSpinner size={36} />
                <div style={{ fontSize: 12 }}>Parsing resume into template…</div>
              </div>
            )}
            {!parsingTemplate && tplData && ActiveTpl && (
              <div style={{ width: 794, transformOrigin: 'top center', boxShadow: '0 4px 24px rgba(0,0,0,.25)' }}>
                <ActiveTpl {...tplData} />
              </div>
            )}
            {!parsingTemplate && !tplData && (
              <div style={{ width: 794, boxShadow: '0 4px 24px rgba(0,0,0,.25)' }}>
                <TextResumePDF text={editorText} accent="#333" />
              </div>
            )}
          </div>

          {/* Right — actions panel */}
          <div style={{ borderLeft: '1px solid var(--lp-bdr)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header row */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ flex: 1, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)' }}>
                {showTextPanel ? 'Text Editor' : 'Actions'}
              </div>
              {tplData && (
                <button type="button" onClick={() => setShowRawEditor(v => !v)} style={{
                  background: showRawEditor ? 'rgba(236,72,153,.1)' : 'transparent',
                  border: `1px solid ${showRawEditor ? 'rgba(236,72,153,.3)' : 'var(--lp-bdr)'}`,
                  color: showRawEditor ? 'var(--lp-teal)' : 'var(--lp-text3)',
                  borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>✏ Edit text</button>
              )}
            </div>

            {/* Textarea — only when no template OR user toggled it on */}
            {showTextPanel && (
              <textarea
                value={editorText}
                onChange={e => setEditorText(e.target.value)}
                placeholder="Your resume text…"
                style={{
                  flex: 1, background: 'var(--lp-bg3)', border: 'none', resize: 'none',
                  color: 'var(--lp-text)', padding: '12px 14px', fontSize: 11.5,
                  outline: 'none', lineHeight: 1.7, boxSizing: 'border-box',
                  fontFamily: "'JetBrains Mono', monospace", width: '100%',
                }}
              />
            )}

            {/* Actions — always visible */}
            <div style={{ padding: '12px 14px', borderTop: showTextPanel ? '1px solid var(--lp-bdr)' : 'none', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0, overflowY: 'auto', flex: showTextPanel ? '0 0 auto' : 1 }}>
              {result?.missingKeywords?.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 8 }}>Missing keywords</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {result.missingKeywords.map((kw, i) => (
                      <button key={i} type="button" onClick={() => appendKeyword(kw)} style={{
                        background: 'rgba(255,90,90,.08)', border: '1px solid rgba(255,90,90,.2)',
                        color: '#FF5A5A', borderRadius: 5, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', minHeight: 'unset',
                      }}>{kw} +</button>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" onClick={copyEditor} style={{
                padding: '9px 0', background: copyDone ? 'rgba(0,229,160,.1)' : 'var(--lp-bg2)',
                border: `1px solid ${copyDone ? 'rgba(0,229,160,.3)' : 'var(--lp-bdr)'}`,
                color: copyDone ? '#00E5A0' : 'var(--lp-text2)',
                borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', minHeight: 'unset',
              }}>{copyDone ? 'Copied ✓' : 'Copy text'}</button>
            </div>
          </div>
        </div>
        {pdfModal}
      </div>
    );
  }

  /* ════════════════════ RESULTS PHASE ════════════════════ */
  return (
    <div style={{ animation: 'rs-fadein .3s ease' }}>

      {/* ── Context bar ── */}
      <div style={{ padding: '14px 36px', borderBottom: '1px solid var(--lp-bdr)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => { setResult(null); setScanErr(''); setAppliedFixes({}); setEditingIdx(null); setEditMode(false); setEditorText(''); setEditorPatchStatus({}); setPatchRecords({}); setFailDismissed(false); setPdfExported(false); }}
          style={{ background: 'none', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >← New scan</button>
        <div style={{ fontSize: 12, color: 'var(--lp-text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--lp-text2)', fontWeight: 600 }}>{resumeText?.fileName || 'Resume'}</span>
          <span style={{ margin: '0 8px' }}>vs</span>
          <span style={{ color: 'var(--lp-text2)', fontWeight: 600 }}>{result.roleTitle || 'Role'}{result.company ? ` @ ${result.company}` : ''}</span>
        </div>
        {/* Progress steps */}
        {(() => {
          const steps = [
            { label: 'Scan', done: true },
            { label: 'Fix', done: Object.keys(appliedFixes).length > 0 },
            { label: 'Edit', done: editorText.length > 0 },
            { label: 'Export', done: pdfExported },
          ];
          const lastDone = steps.reduce((acc, s, i) => s.done ? i : acc, -1);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {steps.map((s, i) => {
                const isDone = s.done;
                const isCurrent = !isDone && i === lastDone + 1;
                const col = isDone ? '#00E5A0' : isCurrent ? '#EC4899' : 'var(--lp-bdr)';
                return (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${col}`, background: isDone ? col : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 900, color: isDone ? '#000' : col }}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: 9.5, fontWeight: isDone || isCurrent ? 700 : 400, color: col }}>{s.label}</span>
                    </div>
                    {i < steps.length - 1 && <div style={{ width: 12, height: 1, background: isDone ? '#00E5A0' : 'var(--lp-bdr)' }} />}
                  </React.Fragment>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Scrollable results body ── */}
      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Score hero */}
        <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 16, padding: '28px 32px' }}>
          <div className="rs-score-row" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {/* Big score */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 64, fontWeight: 900, color: scoreColor, lineHeight: 1, letterSpacing: -2 }}>
                {result.matchScore}
              </div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginTop: 2 }}>/100 match</div>
              {prevMatchScore !== null && (() => {
                const delta = result.matchScore - prevMatchScore;
                if (delta === 0) return null;
                const up = delta > 0;
                return (
                  <div style={{ marginTop: 6, display: 'inline-block', background: up ? 'rgba(0,229,160,.12)' : 'rgba(255,90,90,.1)', border: `1px solid ${up ? 'rgba(0,229,160,.3)' : 'rgba(255,90,90,.25)'}`, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, color: up ? '#00E5A0' : '#FF5A5A' }}>
                    {up ? `↑ +${delta}` : `↓ ${delta}`} vs last
                  </div>
                );
              })()}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 80, background: 'var(--lp-bdr)', flexShrink: 0 }} />

            {/* Verdict + bars */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lp-text)', lineHeight: 1.3 }}>{result.verdict}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(result.bars || []).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="rs-bar-label" style={{ fontSize: 11, color: 'var(--lp-text3)', width: 130, flexShrink: 0 }}>{b.label}</div>
                    <div style={{ flex: 1, height: 5, background: 'var(--lp-bg2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${b.score}%`, background: barColor(b.score), borderRadius: 3, transition: 'width .8s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: barColor(b.score), width: 24, textAlign: 'right', flexShrink: 0 }}>{b.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scan another job */}
        <button
          onClick={() => { setResult(null); setScanErr(''); setAppliedFixes({}); setEditingIdx(null); setEditMode(false); setEditorText(''); setEditorPatchStatus({}); setPatchRecords({}); setFailDismissed(false); setPdfExported(false); }}
          style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--lp-bdr)', borderRadius: 8, color: 'var(--lp-text3)', fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: 'pointer' }}
        >Scan another job</button>

        {/* Missing keywords */}
        {result.missingKeywords?.length > 0 && (
          <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 12 }}>Missing keywords</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {result.missingKeywords.map((kw, i) => (
                <span key={i} style={{
                  background: 'rgba(255,90,90,.09)', border: '1px solid rgba(255,90,90,.22)',
                  color: '#FF5A5A', borderRadius: 6, padding: '4px 11px', fontSize: 12, fontWeight: 600,
                }}>{kw}</span>
              ))}
            </div>
          </div>
        )}

        {/* AI insight */}
        {result.aiInsight && (
          <div style={{
            background: 'rgba(236,72,153,.04)', border: '1px solid rgba(236,72,153,.15)',
            borderLeft: '4px solid var(--lp-teal)', borderRadius: 12,
            padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#fff', flexShrink: 0, marginTop: 1 }}>AI</div>
            <div style={{ fontSize: 13, color: 'var(--lp-text)', lineHeight: 1.65 }}>{result.aiInsight}</div>
          </div>
        )}

        {/* Low score gate */}
        {result.matchScore < 40 && !failDismissed && (
          <div style={{ background: 'rgba(255,90,90,.06)', border: '1px solid rgba(255,90,90,.3)', borderRadius: 14, padding: '18px 22px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#FF5A5A', marginBottom: 10 }}>⚠ Incompatible match — major gaps found</div>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(result.issues || []).filter(iss => iss.severity === 'critical').map((iss, i) => (
                <li key={i} style={{ fontSize: 12, color: 'var(--lp-text3)' }}>{iss.type} — <span style={{ color: '#FF5A5A' }}>{iss.original}</span></li>
              ))}
              {(result.missingKeywords || []).slice(0, 4).map((kw, i) => (
                <li key={'kw' + i} style={{ fontSize: 12, color: 'var(--lp-text3)' }}>Missing keyword: <span style={{ color: '#FFB84D' }}>{kw}</span></li>
              ))}
            </ul>
            <button onClick={() => setFailDismissed(true)} style={{
              width: '100%', padding: '10px 0', background: 'transparent',
              border: '1px solid rgba(255,90,90,.4)', borderRadius: 8,
              color: '#FF5A5A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>I understand, show fixes anyway →</button>
          </div>
        )}

        {/* Fix cards */}
        {(result.matchScore >= 40 || failDismissed) && result.issues?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)' }}>
                Fix suggestions · {result.issues.length} found
              </div>
              {Object.keys(appliedFixes).length > 0 && (
                <button onClick={copyApplied} style={{
                  padding: '5px 12px', background: 'rgba(0,229,160,.1)', border: '1px solid rgba(0,229,160,.28)',
                  color: '#00E5A0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}>
                  Copy {Object.keys(appliedFixes).length} applied
                </button>
              )}
            </div>

            {result.issues.map((issue, i) => {
              const applied = appliedFixes[i];
              const editing = editingIdx === i;
              const sevColor = issue.severity === 'critical' ? '#FF5A5A' : issue.severity === 'ok' ? '#00E5A0' : '#FFB84D';
              return (
                <div key={i} style={{
                  background: applied ? 'rgba(0,229,160,.04)' : 'var(--lp-bg3)',
                  border: `1px solid ${applied ? 'rgba(0,229,160,.22)' : 'var(--lp-bdr)'}`,
                  borderRadius: 14, padding: '18px 22px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  transition: 'border-color .25s, background .25s',
                }}>
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: sevColor, textTransform: 'uppercase',
                      background: sevColor + '18', border: `1px solid ${sevColor}44`,
                      borderRadius: 5, padding: '2px 8px', flexShrink: 0,
                    }}>{issue.severity}</span>
                    <span style={{ fontSize: 11, color: 'var(--lp-text3)', fontFamily: "'JetBrains Mono',monospace", flex: 1 }}>{issue.type}</span>
                    {applied && <span style={{ fontSize: 10, color: '#00E5A0', fontWeight: 700 }}>✓ Applied</span>}
                    {editorPatchStatus[i] === 'patched' && <span style={{ fontSize: 9, color: '#00E5A0', fontFamily: "'JetBrains Mono',monospace", opacity: .7 }}>· in resume</span>}
                    {editorPatchStatus[i] === 'not_found' && <span style={{ fontSize: 9, color: '#FFB84D', fontFamily: "'JetBrains Mono',monospace", opacity: .7 }}>· paste manually</span>}
                    {editorPatchStatus[i] === 'revert_failed' && <span style={{ fontSize: 9, color: '#FFB84D', fontFamily: "'JetBrains Mono',monospace" }}>· edited in resume, restore it there</span>}
                  </div>

                  {/* Original */}
                  <div style={{ fontSize: 12, color: 'var(--lp-text3)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--lp-bg2)', borderRadius: 8, lineHeight: 1.5 }}>
                    "{issue.original?.replace(/^["'"]+|["'"]+$/g, '')}"
                  </div>

                  {/* Suggested fix text — always visible */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 18, color: 'var(--lp-teal)', flexShrink: 0, lineHeight: 1.4, marginTop: 1 }}>→</div>
                    <div style={{ fontSize: 13, color: applied ? '#00E5A0' : 'var(--lp-text)', lineHeight: 1.6 }}>{applied || issue.fix}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: issue.needsInput ? '#FFB84D' : 'var(--lp-text3)', lineHeight: 1.5, paddingLeft: 28 }}>
                    {issue.needsInput
                      ? 'AI draft — [X] marks a number only you know. Fill in your real figure before applying; leave it out if you have none.'
                      : 'AI draft — check it matches what you actually did before applying.'}
                  </div>

                  {/* Edit textarea (shown when editing an already-applied fix) */}
                  {editing && (
                    <>
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        style={{
                          width: '100%', minHeight: 80, background: 'var(--lp-bg2)',
                          border: '1px solid rgba(236,72,153,.35)', borderRadius: 9,
                          color: 'var(--lp-text)', padding: '10px 14px', fontSize: 13,
                          outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={hasPlaceholder(editDraft)}
                          onClick={() => {
                            setAppliedFixes(f => ({ ...f, [i]: editDraft }));
                            setEditingIdx(null);
                            patchResume(editDraft, applied || issue.original, i, patchRecords[i]?.original);
                          }}
                          style={{ padding: '8px 18px', background: '#00E5A0', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: hasPlaceholder(editDraft) ? 'not-allowed' : 'pointer', opacity: hasPlaceholder(editDraft) ? .45 : 1 }}
                        >{hasPlaceholder(editDraft) ? 'Replace [X] to save' : 'Save ✓'}</button>
                        <button
                          onClick={() => setEditingIdx(null)}
                          style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                        >Cancel</button>
                      </div>
                    </>
                  )}

                  {/* Action buttons */}
                  {!editing && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!applied && (
                        <button
                          onClick={() => {
                            if (issue.needsInput) { setEditingIdx(i); setEditDraft(issue.fix); return; }
                            setAppliedFixes(f => ({ ...f, [i]: issue.fix }));
                            patchResume(issue.fix, issue.original, i);
                          }}
                          style={{
                            alignSelf: 'flex-start', padding: '8px 18px',
                            background: 'linear-gradient(135deg, rgba(236,72,153,.15), rgba(245,158,11,.1))',
                            border: '1px solid rgba(236,72,153,.3)',
                            color: 'var(--lp-teal)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >{issue.needsInput ? 'Fill in & apply →' : 'Apply fix →'}</button>
                      )}
                      {applied && (
                        <>
                          <button onClick={() => { setEditingIdx(i); setEditDraft(applied); }}
                            style={{ padding: '4px 12px', background: 'transparent', border: '1px solid rgba(0,229,160,.3)', color: '#00E5A0', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => revertFix(i)}
                            style={{ padding: '4px 12px', background: 'transparent', border: '1px solid rgba(255,90,90,.25)', color: '#FF5A5A', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>Revert</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit & Export CTA */}
        <div style={{ paddingTop: 8, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={openEditor}
            style={{
              width: '100%', padding: '15px 0',
              background: 'linear-gradient(135deg, rgba(236,72,153,.12), rgba(245,158,11,.1))',
              border: '1px solid rgba(236,72,153,.3)', borderRadius: 12,
              color: 'var(--lp-text)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              letterSpacing: .2, transition: 'all .2s',
            }}
          >Edit & export resume →</button>

        </div>

      </div>
      {pdfModal}
    </div>
  );
}
// ── Main Component ────────────────────────────────────────────────────────────

export default function ResumeScan({ resumeText, setResumeText, scanResult, setScanResult, form, memory, updateMemory, setActiveModule }) {
  const [scanning, setScanning] = useState(false);
  const [fileErr, setFileErr] = useState('');
  const [paste, setPaste] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [rawFile, setRawFile] = useState(null);
  const [localFile, setLocalFile] = useState(null);
  const [feedbackMode, setFeedbackMode] = useState('professional');
  const [scanLogSteps, setScanLogSteps] = useState([]);
  const [animScore, setAnimScore] = useState(0);
  const fileRef = useRef(null);

  // Derived state
  const history = memory?.scanHistory || [];
  const score = scanResult?.credibilityScore || 0;
  const gaugeColor = score >= 70 ? '#00e5a0' : score >= 50 ? '#f5c842' : '#ff5f6e';
  const { missing, matched } = deriveKeywords(scanResult);
  const progs = deriveProgBars(scanResult);

  // Animate score when result arrives
  useEffect(() => {
    if (!scanResult) { setAnimScore(0); return; }
    const target = scanResult.credibilityScore || 0;
    let cur = 0;
    const iv = setInterval(() => {
      cur += Math.ceil((target - cur) / 6);
      if (cur >= target) { setAnimScore(target); clearInterval(iv); }
      else setAnimScore(cur);
    }, 40);
    return () => clearInterval(iv);
  }, [scanResult]);

  const handleFile = async (file) => {
    if (!file) return;
    setFileErr('');
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(file.type) && ext !== 'pdf' && ext !== 'docx') {
      setFileErr('Only PDF and DOCX files are supported.'); return;
    }
    if (file.size > MAX_SIZE) {
      setFileErr('File too large — maximum 10 MB.'); return;
    }
    setRawFile(file);
    setLocalFile({ fileName: file.name, type: ext === 'pdf' ? 'pdf' : 'text' });
    setResumeText({ type: ext === 'pdf' ? 'pdf' : 'text', content: null, fileName: file.name });
    setScanResult(null);
  };

  const confirmPaste = () => {
    if (paste.trim().length < 50) { setFileErr('Resume text is too short.'); return; }
    setRawFile(null);
    setResumeText({ type: 'text', content: paste, fileName: 'Pasted Resume' });
    setLocalFile({ fileName: 'Pasted Resume', type: 'text' });
    setScanResult(null);
    setPasteOpen(false);
  };

  const runScan = async () => {
    if (!resumeText) return;
    setScanning(true);
    setScanResult(null);
    setScanLogSteps([]);
    setAnimScore(0);

    // Play through log steps
    let stepIdx = 0;
    const iv = setInterval(() => {
      if (stepIdx < LOG_STEPS.length) {
        const s = LOG_STEPS[stepIdx];
        setScanLogSteps(prev => [...prev, s]);
        setAnimScore(Math.round((stepIdx / LOG_STEPS.length) * 65));
        stepIdx++;
      }
    }, 900);

    try {
      const prompt = feedbackMode === 'snarky' ? buildSnarkyPrompt(targetRole) : buildScanPrompt(targetRole);
      let raw;
      let base64 = null;

      if (resumeText.type === 'pdf' && rawFile) {
        const arrayBuffer = await rawFile.arrayBuffer();
        base64 = arrayBufferToBase64(arrayBuffer);
        raw = await callLLM([{ role: 'user', content: prompt }], 8192, base64);
      } else {
        raw = await callLLM([{ role: 'user', content: `${prompt}\n\nResume Text:\n${resumeText.content}` }], 8192);
      }

      clearInterval(iv);

      const result = extractJSON(raw);
      if (result.error) throw new Error('Failed to parse AI response');

      setScanResult(result);

      if (updateMemory) {
        updateMemory(
          m => ({
            ...m,
            scanResult: result,
            ...(base64 ? { scanPdfBase64: base64, scanFileName: resumeText.fileName } : {}),
            scanHistory: [
              { date: new Date().toISOString(), score: result.credibilityScore, fileName: resumeText.fileName, result },
              ...(m.scanHistory || [])
            ].slice(0, 10)
          }),
          {
            table: 'resume_scans',
            data: {
              credibility_score: result.credibilityScore,
              file_name: resumeText.fileName,
              metrics_found: result.metricsFound,
              summary: result.summary || '',
              issues: result.issues || [],
              questions: result.interrogationQuestions || [],
              created_at: new Date().toISOString()
            }
          }
        );
      }
    } catch (e) {
      clearInterval(iv);
      setFileErr(e.message || 'Scan failed. Please try again.');
      console.error('[ResumeScan] Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '18px 28px 16px', borderBottom: '1px solid var(--lp-bdr)' }}>
        <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22, marginBottom: 2 }}>ATS Scanner</div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13 }}>
          Paste any job description and get your match score in seconds, with AI fixes applied instantly.
        </div>
      </div>

      <JDMatchTab resumeText={resumeText} setResumeText={setResumeText} form={form} setActiveModule={setActiveModule} updateMemory={updateMemory} memory={memory} />

      {/* Deep Scan legacy — kept for reference only, not rendered */}
      {false && (
    <div className="rs-wrap">

      {/* ── LEFT PANEL ── */}
      <div className="rs-panel">
        <div className="rs-panel-head">
          <div className="rs-phtitle">Resume Scan</div>
          <div className="rs-phsub">Deep ATS · Issue Detector</div>
        </div>
        <div className="rs-panel-body">

          {/* Mode toggle */}
          <div>
            <div className="rs-mini-label">Feedback Mode</div>
            <div className="rs-mode-toggle">
              <button
                className={`rs-mode-btn${feedbackMode === 'professional' ? ' active-pro' : ''}`}
                onClick={() => setFeedbackMode('professional')}
              >
                ✦ Pro
              </button>
              <button
                className={`rs-mode-btn${feedbackMode === 'snarky' ? ' active-snarky' : ''}`}
                onClick={() => setFeedbackMode('snarky')}
              >
                🔥 Roast
              </button>
            </div>
            {feedbackMode === 'snarky' && (
              <div className="rs-snarky-notice" style={{ marginTop: 6 }}>
                Roast mode: AI will brutally call out every weak bullet, then give the XYZ fix.
              </div>
            )}
          </div>

          {/* Target role */}
          <div>
            <div className="rs-mini-label">Target Role</div>
            <input
              className="rs-role-input"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Product Manager"
              disabled={scanning}
            />
          </div>

          {/* Upload / file zone */}
          <div>
            <div className="rs-mini-label">Resume File</div>
            {localFile ? (
              <div className="rs-file-loaded">
                <span className="rs-file-name">{localFile.fileName}</span>
                <button
                  className="rs-remove-btn"
                  onClick={() => { setLocalFile(null); setRawFile(null); setResumeText(null); setPaste(''); setScanResult(null); }}
                  disabled={scanning}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`rs-dropzone${dragOver ? ' dragover' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => !scanning && fileRef.current.click()}
                >
                  <div className="rs-dropzone-icon">📂</div>
                  <div className="rs-dropzone-title">Drop or click to upload</div>
                  <div className="rs-dropzone-sub">PDF · DOCX · TXT</div>
                  <button className="rs-browse-btn" tabIndex={-1}>Browse Files</button>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
                </div>
                <button className="rs-paste-toggle" onClick={() => setPasteOpen(!pasteOpen)}>
                  {pasteOpen ? '▲ hide text paste' : '▼ paste text instead'}
                </button>
                {pasteOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <textarea
                      className="rs-paste-area"
                      value={paste}
                      onChange={e => { setPaste(e.target.value); setFileErr(''); }}
                      placeholder="Paste full resume text..."
                      rows={5}
                    />
                    <button
                      className="rs-scan-btn"
                      onClick={confirmPaste}
                      disabled={paste.trim().length < 50}
                    >
                      Use This Text
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {fileErr && <div className="rs-err">⚠ {fileErr}</div>}

          {/* Scan button */}
          {(localFile || resumeText) && (
            <button
              className="rs-scan-btn"
              onClick={runScan}
              disabled={scanning}
            >
              {scanning ? 'Scanning...' : '⚡ Run Deep Scan'}
            </button>
          )}

          {/* History list */}
          {history.length > 0 && (
            <div className="rs-history-section">
              <div className="rs-history-label">Recent Scans</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.slice(0, 5).map((item, i) => {
                  const s = item.score || item.result?.credibilityScore || 0;
                  const sc = s >= 70 ? 'var(--rs-green)' : s >= 50 ? 'var(--rs-gold)' : 'var(--rs-red)';
                  return (
                    <div key={i} className="rs-hist-item">
                      <span className="rs-hist-name">{item.fileName}</span>
                      <span className="rs-hist-score" style={{ color: sc }}>{s}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER PANEL ── */}
      <div className="rs-panel-center">
        <div className="rs-panel-head">
          <div className="rs-phtitle">
            {centerState === 'idle' && 'Issue Analysis'}
            {centerState === 'scanning' && 'Running Scan...'}
            {centerState === 'results' && `Issue Report — ${scanResult?.issues?.length || 0} flags`}
          </div>
          <div className="rs-phsub">
            {centerState === 'idle' && 'Upload a resume to start'}
            {centerState === 'scanning' && 'AI analysis in progress'}
            {centerState === 'results' && `${feedbackMode === 'snarky' ? 'Roast' : 'Professional'} mode · ${resumeText?.fileName || ''}`}
          </div>
        </div>

        {/* IDLE */}
        {centerState === 'idle' && (
          <div className="rs-idle-placeholder">
            <div className="rs-idle-icon">⚡</div>
            <div className="rs-idle-title">Deep Resume Scan</div>
            <div className="rs-idle-sub">
              Upload your resume and run a scan to get an ATS score, issue flags, and XYZ-format fix suggestions for every weak bullet.
            </div>
            <div className="rs-tip-list">
              <div className="rs-tip-row">
                <span className="rs-tip-key rs-xyz-x">X</span>
                <span>Result — what you achieved, with a number</span>
              </div>
              <div className="rs-tip-row">
                <span className="rs-tip-key rs-xyz-y">Y</span>
                <span>Action — what you specifically did</span>
              </div>
              <div className="rs-tip-row">
                <span className="rs-tip-key rs-xyz-z">Z</span>
                <span>Context — scale, team, tool, or setting</span>
              </div>
            </div>
          </div>
        )}

        {/* SCANNING */}
        {centerState === 'scanning' && (
          <div className="rs-scanning-wrap">
            <OrbitSpinner size={48} />
            <div className="rs-scanning-log">
              {scanLogSteps.map((s, i) => (
                <div key={i} className="rs-scan-log-row">
                  <span className="rs-log-ts">[{s.t}]</span>
                  <span className={s.c}>{s.cat}</span>
                  <span className="rs-log-msg">{s.msg}</span>
                </div>
              ))}
              {scanLogSteps.length < LOG_STEPS.length && (
                <div className="rs-scan-log-row">
                  <span className="rs-log-ts">[--:--]</span>
                  <span className="rs-tc-parse">…</span>
                  <span className="rs-log-msg"><span className="rs-log-cursor" /></span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {centerState === 'results' && (
          <div className="rs-results-area">
            {scanResult?.summary && (
              <div className="rs-summary-block">
                <div className="rs-summary-title">AI Verdict</div>
                <div className="rs-summary-text">{scanResult.summary}</div>
              </div>
            )}
            <div className="rs-section-head">Flagged Issues</div>
            {(scanResult?.issues || []).map((issue, i) => (
              <IssueCard key={i} issue={issue} />
            ))}

            {/* History cards below results */}
            {history.length > 0 && (
              <>
                <div className="rs-section-head" style={{ marginTop: 8 }}>Previous Scans</div>
                {history.map((item, i) => (
                  <ScanHistoryCard key={i} item={item} initExpanded={false} />
                ))}
              </>
            )}
          </div>
        )}

        {/* ATS Builder CTA */}
        {centerState === 'results' && history.length > 0 && setActiveModule && (
          <div className="rs-ats-cta">
            <div className="rs-ats-cta-text">
              Ready to fix these issues? Open ATS Builder with your resume pre-loaded.
            </div>
            <button className="rs-ats-cta-btn" onClick={() => setActiveModule('ats')}>
              Fix in ATS Builder →
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="rs-panel-right">
        <div className="rs-panel-head">
          <div className="rs-phtitle">ATS Metrics</div>
          <div className="rs-phsub">Score · Keywords · Questions</div>
        </div>
        <div className="rs-panel-body">

          {/* Gauge */}
          <div className="rs-gauge-wrap">
            <div className="rs-gauge-label">ATS Score</div>
            <ScoreGauge score={animScore} color={gaugeColor} />
            {scanResult && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 9, fontFamily: 'JetBrains Mono,monospace' }}>
                <span style={{ color: 'var(--rs-text3)' }}>Target:</span>
                <span style={{ color: 'var(--rs-green)' }}>85%+</span>
                {score < 85 && <span style={{ color: 'var(--rs-text3)' }}>· +{85 - score}% gap</span>}
              </div>
            )}
          </div>

          {/* Metric boxes */}
          {scanResult && (
            <div className="rs-metrics-row">
              <div className="rs-metric-box">
                <div className="rs-metric-val" style={{ color: 'var(--rs-cyan)' }}>{scanResult.metricsFound || 0}</div>
                <div className="rs-metric-lbl">Metrics</div>
              </div>
              <div className="rs-metric-box">
                <div className="rs-metric-val" style={{ color: 'var(--rs-red)' }}>{(scanResult.issues || []).filter(i => i.severity === 'critical').length}</div>
                <div className="rs-metric-lbl">Critical</div>
              </div>
              <div className="rs-metric-box">
                <div className="rs-metric-val" style={{ color: 'var(--rs-gold)' }}>{(scanResult.issues || []).filter(i => i.severity === 'warning').length}</div>
                <div className="rs-metric-lbl">Warnings</div>
              </div>
            </div>
          )}

          {/* Progress bars */}
          {scanResult && (
            <div className="rs-prog-section">
              <div className="rs-mini-label" style={{ marginBottom: 8 }}>Score Breakdown</div>
              <ProgBar label="Bullet Quality" value={progs.bullet} color="#00c8ff" />
              <ProgBar label="Metrics Coverage" value={progs.metrics} color="#00e5a0" />
              <ProgBar label="Ownership Signals" value={progs.ownership} color="#f5c842" />
            </div>
          )}

          {/* Keyword boxes */}
          {scanResult && (
            <>
              {missing.length > 0 && (
                <KeywordBox title="Missing Keywords" keywords={missing} variant="missing" />
              )}
              {matched.length > 0 && (
                <KeywordBox title="Matched ✓" keywords={matched} variant="matched" />
              )}
            </>
          )}

          {/* Interrogation questions */}
          {scanResult?.interrogationQuestions?.length > 0 && (
            <div className="rs-iq-section">
              <div className="rs-iq-header">
                <span className="rs-iq-title">Interrogation Questions</span>
                <span className="rs-iq-count">{scanResult.interrogationQuestions.length}</span>
              </div>
              {scanResult.interrogationQuestions.map((q, i) => (
                <div key={i} className="rs-iq-card">
                  <div className="rs-iq-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="rs-iq-body">
                    <div className="rs-iq-source-chip">{q.source}</div>
                    <div className="rs-iq-question">{q.question}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Placeholder when idle */}
          {!scanResult && !scanning && (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{ fontSize: 28, opacity: .2, marginBottom: 8 }}>📊</div>
              <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-text3)', lineHeight: 1.6 }}>
                Metrics, keywords, and questions will appear here after scanning.
              </div>
            </div>
          )}

          {/* Scanning placeholder */}
          {scanning && !scanResult && (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono,monospace', color: 'var(--rs-text3)', lineHeight: 1.6 }}>
                Calculating score...
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
      )}
    </div>
  );
}
