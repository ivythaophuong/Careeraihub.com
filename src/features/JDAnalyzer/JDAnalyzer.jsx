import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner, PreviewBanner } from '../../components/CommonUI';
import { AnimatedScore } from '../../components/OriginalFeatures';

export default function JDAnalyzer({ resumeText, form, memory, updateMemory }) {
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const analyze = async () => {
    if (jd.trim().length < 50) { 
      showToast("Please paste a full Job Description (min 50 characters)", "error");
      return; 
    }
    setLoading(true); setResult(null); setErr("");
    
    // Simulation for UI parity
    setTimeout(() => {
      const parsed = {
        matchScore: 78,
        roleTitle: "Senior Frontend Engineer",
        company: "Grab",
        keyRequirements: ["React expert", "Performance optimization", "Design systems"],
        candidateStrengths: ["Strong React background", "Experience with scalable architectures"],
        criticalGaps: ["Lack of direct GrabMaps experience", "Minimal Golang exposure"],
        hiddenKeywords: ["Latency", "Atomic Design", "Lighthouse"],
        applicationAdvice: "Focus your resume bullets on latency reduction metrics and modular component architecture.",
        interviewFocus: ["System Design", "Metric Deep-dives"]
      };
      setResult(parsed);
      setLoading(false);
      // Sample output is not saved to history until this module calls the real AI.
    }, 3000);
  };

  const mc = result ? (result.matchScore >= 75 ? C.green : result.matchScore >= 50 ? C.gold : C.red) : C.pink;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Job Description Analyzer</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Paste any JD. Get match score, ATS keywords, red flags, and your positioning strategy.</div>
      </div>

      <Card>
        <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Paste Job Description</div>
        <textarea 
          value={jd} 
          onChange={e => { setJd(e.target.value); setErr(""); }} 
          placeholder="Paste the full job description here..." 
          style={{ width: "100%", minHeight: 160, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, padding: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.7 }}
        />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>⚠️ {err}</div>}
        <Btn onClick={analyze} disabled={loading || jd.trim().length < 50} color={C.pink} style={{ marginTop: 12, width: "100%" }}>{loading ? "Analyzing JD..." : "🔍 Analyze This Job"}</Btn>
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
              {result.hiddenKeywords?.map((kw, i) => <span key={i} style={{ background: C.gold + "15", color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{kw.toUpperCase()}</span>)}
            </div>
          </Card>
          
          <Card style={{ border: `1px solid ${C.accent}44` }}>
             <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>💡 Application Strategy</div>
             <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.applicationAdvice}</div>
          </Card>
        </>
      )}
    </div>
  );
}
