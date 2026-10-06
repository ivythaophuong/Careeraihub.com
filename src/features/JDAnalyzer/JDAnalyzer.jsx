import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { AnimatedScore } from '../../components/OriginalFeatures';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import '../../styles/featurePage.css';

export default function JDAnalyzer({ resumeText, form, memory, updateMemory, showToast }) {
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (jd.trim().length < 50) {
      showToast("Please paste a full Job Description (min 50 characters)", "error");
      return;
    }
    setLoading(true); setResult(null);
    try {
      const resumeCtx = resumeText
        ? (typeof resumeText === 'string' ? resumeText : resumeText.content || '')
        : '';
      const raw = await callLLM([{ role: 'user', content: `You are an expert recruiter and career coach. Analyze this job description against the candidate's resume and profile.

Target Role: ${form.role || 'Not specified'}
Industry: ${form.industry || 'Not specified'}
Market: ${form.market || 'Not specified'}

Resume Content:
${resumeCtx || 'No resume provided — base analysis on the JD only.'}

Job Description:
${jd}

Return ONLY raw JSON (no markdown, start with {):
{"matchScore":0-100,"roleTitle":"extracted job title","company":"extracted company name or Unknown","keyRequirements":["req1","req2","req3"],"candidateStrengths":["strength specific to this resume and JD","strength2"],"criticalGaps":["specific gap1","specific gap2"],"hiddenKeywords":["keyword1","keyword2","keyword3","keyword4","keyword5"],"applicationAdvice":"2-3 sentence specific advice on how to tailor their application","interviewFocus":["topic1","topic2","topic3"]}

Be specific to the actual content — no generic advice.` }], 1500, null, { task: 'jd_analysis' });
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      setResult(parsed);
      if (updateMemory) updateMemory(
        m => ({ jdAnalyses: [{ date: new Date().toISOString(), company: parsed.company, matchScore: parsed.matchScore, role: parsed.roleTitle }, ...(m.jdAnalyses || [])].slice(0, 20) }),
        { table: 'jd_analyses', data: { role_title: parsed.roleTitle, company: parsed.company, match_score: parsed.matchScore, key_requirements: parsed.keyRequirements, critical_gaps: parsed.criticalGaps } }
      );
    } catch (e) {
      showToast("Analysis failed: " + e.message, "error");
    }
    setLoading(false);
  };

  const mc = result ? (result.matchScore >= 75 ? C.green : result.matchScore >= 50 ? C.gold : C.red) : C.pink;

  return (
    <div className="fp-wrap" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Job Description Analyzer</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Paste any JD. Get match score, ATS keywords, red flags, and your positioning strategy.</div>
      </div>

      <Card>
        <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Paste Job Description</div>
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          placeholder="Paste the full job description here..."
          style={{ width: "100%", minHeight: 160, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.7 }}
        />
        <Btn onClick={analyze} disabled={loading || jd.trim().length < 50} color={C.pink} style={{ marginTop: 12, width: "100%" }}>
          {loading ? "Analyzing JD..." : "🔍 Analyze This Job"}
        </Btn>
      </Card>

      {loading && <Card><Spinner label="Matching JD against your profile..." /></Card>}

      {result && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <Card style={{ textAlign: "center", border: `1px solid ${mc}44` }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Match Score</div>
              <AnimatedScore value={result.matchScore} color={mc} size="medium" suffix="%" />
            </Card>
            <Card style={{ border: `1px solid ${C.accent}33` }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Role & Company</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>{result.roleTitle}</div>
              <div style={{ color: C.accent, fontWeight: 700, fontSize: 13, marginTop: 2 }}>{result.company}</div>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card style={{ borderLeft: `4px solid ${C.green}88` }}>
              <div style={{ color: C.green, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>✅ Your Strengths</div>
              {result.candidateStrengths?.map((s, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {s}</div>)}
            </Card>
            <Card style={{ borderLeft: `4px solid ${C.red}88` }}>
              <div style={{ color: C.red, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>⚠️ Critical Gaps</div>
              {result.criticalGaps?.map((g, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {g}</div>)}
            </Card>
          </div>

          <Card style={{ border: `1px solid ${C.gold}33` }}>
            <div style={{ color: C.gold, fontWeight: 900, fontSize: 13, marginBottom: 12 }}>🔑 ATS Keywords — Add These to Your Resume</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {result.hiddenKeywords?.map((kw, i) => (
                <span key={i} style={{ background: C.gold + "15", color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{kw.toUpperCase()}</span>
              ))}
            </div>
          </Card>

          <Card style={{ border: `1px solid ${C.accent}44` }}>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>💡 Application Strategy</div>
            <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.applicationAdvice}</div>
          </Card>

          {result.interviewFocus?.length > 0 && (
            <Card style={{ border: `1px solid ${C.purple}33` }}>
              <div style={{ color: C.purple, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🧠 Interview Focus Areas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {result.interviewFocus.map((f, i) => (
                  <span key={i} style={{ background: C.purple + "15", color: C.purple, border: `1px solid ${C.purple}33`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{f}</span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
