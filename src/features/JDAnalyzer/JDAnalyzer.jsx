import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { AnimatedScore } from '../../components/OriginalFeatures';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { MIN_JD_CHARS, MAX_JD_CHARS, pickResumeSource, buildJDPrompt, normalizeJDResult } from './jdAnalysis';

const SOURCE_LABEL = {
  structured: 'your ATS Builder resume',
  text: 'your pasted resume',
  pdf: 'your uploaded PDF resume',
};

const listCard = (title, items, color, icon) => (
  <Card style={{ borderLeft: `4px solid ${color}88` }}>
    <div style={{ color, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>{icon} {title}</div>
    {items.length
      ? items.map((s, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {s}</div>)
      : <div style={{ color: C.muted, fontSize: 12 }}>Nothing flagged.</div>}
  </Card>
);

export default function JDAnalyzer({ resumeText, form, memory, updateMemory, setAuthModal, setActiveModule }) {
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [usedSource, setUsedSource] = useState('none');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const analyze = async () => {
    const text = jd.trim();
    if (text.length < MIN_JD_CHARS) { setErr(`Please paste a full job description (at least ${MIN_JD_CHARS} characters).`); return; }
    setLoading(true); setResult(null); setErr("");

    const resume = pickResumeSource({ memory, resumeText });
    const hasResume = resume.kind !== 'none';
    try {
      const prompt = buildJDPrompt({ jd: text, resume, targetRole: form?.role });
      const raw = await callLLM([{ role: 'user', content: prompt }], 2500, resume.pdfBase64);
      const parsed = normalizeJDResult(extractJSON(raw), { hasResume });

      setResult(parsed);
      setUsedSource(resume.kind);
      // Newest first, keep the 20 most recent.
      updateMemory?.(m => ({
        jdAnalyses: [
          { date: new Date().toISOString(), company: parsed.company, role: parsed.roleTitle, roleTitle: parsed.roleTitle, matchScore: parsed.matchScore, result: parsed },
          ...(m.jdAnalyses || []),
        ].slice(0, 20),
      }));
    } catch (e) {
      if (e.status === 401 && setAuthModal) {
        setErr('Create a free account or sign in to analyze job descriptions.');
        setAuthModal('register');
      } else {
        setErr(e.message || 'Analysis failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const score = result?.matchScore;
  const mc = score == null ? C.pink : score >= 75 ? C.green : score >= 50 ? C.gold : C.red;
  const tooShort = jd.trim().length < MIN_JD_CHARS;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Job Description Analyzer</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Paste any JD. Get match score, ATS keywords, red flags, and your positioning strategy.</div>
      </div>

      <Card>
        <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Paste Job Description</div>
        <textarea
          aria-label="Job description"
          value={jd}
          maxLength={MAX_JD_CHARS}
          onChange={e => { setJd(e.target.value); setErr(""); }}
          placeholder="Paste the full job description here..."
          style={{ width: "100%", minHeight: 160, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.7 }}
        />
        {err && <div role="alert" style={{ color: C.red, fontSize: 12, marginTop: 8 }}>⚠️ {err}</div>}
        <Btn onClick={analyze} disabled={loading || tooShort} color={C.pink} style={{ marginTop: 12, width: "100%" }}>{loading ? "Analyzing JD..." : "🔍 Analyze This Job"}</Btn>
      </Card>

      {loading && <Card><Spinner label="Matching JD against your profile..." /></Card>}

      {result && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <Card style={{ textAlign: "center", border: `1px solid ${mc}44` }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Match Score</div>
              {score == null ? (
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                  No resume to compare against.
                  {setActiveModule && <div><button onClick={() => setActiveModule('scan')} style={{ marginTop: 8, background: "transparent", border: "none", color: C.accent, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Scan your resume first</button></div>}
                </div>
              ) : (
                <AnimatedScore value={score} color={mc} size="medium" suffix="%" />
              )}
            </Card>
            <Card style={{ border: `1px solid ${C.accent}33` }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Role & Company</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{result.roleTitle}</div>
              <div style={{ color: C.accent, fontWeight: 700, fontSize: 13, marginTop: 2 }}>{result.company}</div>
              {usedSource !== 'none' && <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Compared against {SOURCE_LABEL[usedSource]}.</div>}
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {listCard('Your Strengths', result.candidateStrengths, C.green, '✅')}
            {listCard('Critical Gaps', result.criticalGaps, C.red, '⚠️')}
          </div>

          {result.keyRequirements.length > 0 && (
            <Card>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>📋 Key Requirements</div>
              {result.keyRequirements.map((r, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {r}</div>)}
            </Card>
          )}

          {result.hiddenKeywords.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}33` }}>
              <div style={{ color: C.gold, fontWeight: 900, fontSize: 13, marginBottom: 12 }}>🔑 ATS Keywords — Add These to Your Resume</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {result.hiddenKeywords.map((kw, i) => <span key={i} style={{ background: C.gold + "15", color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{kw.toUpperCase()}</span>)}
              </div>
            </Card>
          )}

          {result.redFlags.length > 0 && (
            <Card style={{ borderLeft: `4px solid ${C.orange || C.red}88` }}>
              <div style={{ color: C.orange || C.red, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🚩 Red Flags in This Posting</div>
              {result.redFlags.map((f, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {f}</div>)}
            </Card>
          )}

          {result.applicationAdvice && (
            <Card style={{ border: `1px solid ${C.accent}44` }}>
              <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>💡 Application Strategy</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.applicationAdvice}</div>
            </Card>
          )}

          {result.interviewFocus.length > 0 && (
            <Card>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🎤 Likely Interview Focus</div>
              {result.interviewFocus.map((t, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {t}</div>)}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
