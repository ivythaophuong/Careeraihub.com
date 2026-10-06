import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { OrbitSpinner } from '../../components/OrbitMark';
import '../../styles/featurePage.css';

export default function CoverLetterGen({ resumeText, form, memory, updateMemory, user, showToast }) {
  const [company, setCompany] = useState('');
  const [role, setRole]       = useState(form?.role || '');
  const [jd, setJd]           = useState('');
  const [tone, setTone]       = useState('professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [copied, setCopied]   = useState(false);

  const TONES = [
    { id: 'professional', label: 'Confident and direct' },
    { id: 'confident',    label: 'Assertive and bold'   },
    { id: 'storytelling', label: 'Narrative-driven'     },
    { id: 'concise',      label: 'Ultra-concise'        },
  ];

  const generate = async () => {
    setLoading(true); setResult(null);
    try {
      const resumeCtx = resumeText
        ? (typeof resumeText === 'string' ? resumeText : resumeText.content || '')
        : '';
      const raw = await callLLM([{ role: 'user', content:
        `You are an elite cover letter writer. Write a highly personalized, compelling cover letter.

Candidate: ${user?.name || 'the candidate'}
Target Company: ${company || form?.industry || 'Not specified'}
Target Role: ${role || form?.role || 'Not specified'}
Industry: ${form?.industry || 'Not specified'}
Market: ${form?.market || 'Not specified'}
Tone: ${tone}

Resume:
${resumeCtx || 'Not provided — write a strong general letter based on the role.'}

Job Description:
${jd || 'Not provided — write a targeted letter based on the role.'}

Return ONLY raw JSON (no markdown, start with {):
{"subject":"compelling email subject line","coverLetter":"full cover letter with proper paragraphs and line breaks — personalized to the actual resume and JD content, NOT generic","sellingPoints":["specific strength 1","specific strength 2","specific strength 3"]}

Write a real letter — no [brackets] or placeholders. Match the tone exactly.` }], 2000, null, { task: 'cover_letter' });
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      setResult(parsed);
      if (updateMemory) updateMemory(
        m => ({ coverLetters: [{ date: new Date().toISOString(), role, tone }, ...(m.coverLetters || [])].slice(0, 20) }),
        { table: 'cover_letters', data: { company, tone, subject: parsed.subject, content: parsed.coverLetter } }
      );
    } catch (e) {
      showToast('Generation failed: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const copyText = () => {
    if (!result?.coverLetter) return;
    navigator.clipboard.writeText(result.coverLetter).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const download = () => {
    if (!result?.coverLetter) return;
    const blob = new Blob([result.coverLetter], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cover-letter-${role || 'draft'}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = result?.coverLetter
    ? result.coverLetter.trim().split(/\s+/).length : 0;

  const inp = {
    width: '100%', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)',
    borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const label = {
    color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block',
  };

  return (
    <div className="fp-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22 }}>Cover Letter AI</div>
        </div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13, marginTop: 4 }}>
          Paste any JD and get a personalised, non-generic cover letter in 10 seconds.
        </div>
        {!resumeText && (
          <div style={{ color: 'var(--lp-text3)', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
            No resume uploaded — upload in Resume Builder for a fully personalised letter.
          </div>
        )}
      </div>

      {/* 2-col */}
      <div className="cl-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: settings ── */}
        <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div>
            <span style={label}>Target company</span>
            <input value={company} onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Grab Singapore" style={inp} />
          </div>

          <div>
            <span style={label}>Role</span>
            <input value={role} onChange={e => setRole(e.target.value)}
              placeholder="e.g. Senior Product Manager — Payments" style={inp} />
          </div>

          <div>
            <span style={label}>Tone</span>
            <select value={tone} onChange={e => setTone(e.target.value)}
              style={{ ...inp, cursor: 'pointer' }}>
              {TONES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <span style={label}>Job description</span>
            <textarea
              value={jd} onChange={e => setJd(e.target.value)}
              placeholder="Paste JD for AI to tailor the letter..."
              style={{ ...inp, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          <button
            onClick={generate} disabled={loading}
            style={{
              width: '100%', padding: '14px 0',
              background: loading ? 'var(--lp-bdr)' : 'var(--lp-teal)',
              color: loading ? 'var(--lp-text3)' : '#000',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800,
              cursor: loading ? 'default' : 'pointer', transition: 'all .15s',
            }}
          >
            {loading ? 'Writing your letter…' : 'Generate cover letter →'}
          </button>
        </div>

        {/* ── Right: preview ── */}
        <div style={{
          background: 'var(--lp-bg3)',
          border: `1px solid ${result ? 'rgba(236,72,153,.25)' : 'var(--lp-bdr)'}`,
          borderRadius: 12, padding: 20, minHeight: 420,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Preview header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {result
                  ? `Generated · ${TONES.find(t => t.id === tone)?.label}`
                  : 'Preview'}
              </span>
              {result && (
                <span style={{ background: 'var(--lp-teal)', color: '#000', fontSize: 10, fontWeight: 800, borderRadius: 4, padding: '2px 7px' }}>
                  {wordCount} words
                </span>
              )}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyText} style={{
                  background: copied ? 'var(--lp-teal)' : 'transparent',
                  border: `1px solid ${copied ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
                  color: copied ? '#000' : 'var(--lp-text2)',
                  borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                }}>
                  {copied ? '✓ Copied' : 'Copy →'}
                </button>
                <button onClick={download} style={{
                  background: 'transparent', border: '1px solid var(--lp-bdr)',
                  color: 'var(--lp-text2)', borderRadius: 6, padding: '5px 12px',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  Download
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <OrbitSpinner size={36} />
              <div style={{ color: 'var(--lp-text3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Writing your letter…</div>
            </div>
          ) : result ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{
                color: 'var(--lp-text)', fontSize: 13, lineHeight: 1.9,
                whiteSpace: 'pre-line', borderLeft: '4px solid var(--lp-teal)', paddingLeft: 16,
              }}>
                {result.coverLetter}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--lp-text3)', gap: 10, opacity: .6 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/>
              </svg>
              <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 200 }}>
                Fill in the settings and click Generate to preview your letter here.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
