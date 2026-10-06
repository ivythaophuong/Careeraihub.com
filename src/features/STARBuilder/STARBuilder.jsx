import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { GetReadyTabStrip } from '../Landing/LandingPage';
import '../../styles/featurePage.css';

export default function STARBuilder({ resumeText, form, memory, updateMemory, setActiveModule, onStudyPlan, showToast, embedded }) {
  const [S, setS] = useState(""); const [T, setT] = useState(""); const [A, setA] = useState(""); const [R, setR] = useState("");
  const [refined, setRefined] = useState(null);
  const [loading, setLoading] = useState(false);

  const refine = async () => {
    if (!S || !T || !A || !R) {
      showToast("Please complete all four STAR sections before refining", "error");
      return;
    }
    setLoading(true); setRefined(null);
    try {
      const raw = await callLLM([{ role: 'user', content: `You are an elite interview coach. Refine this STAR story into a compelling, metric-driven, interview-ready response.

Target Role: ${form.role || 'Not specified'}
Level: ${form.level || 'not stated'}
Industry: ${form.industry || 'Not specified'}

Raw STAR Story:
Situation: ${S}
Task: ${T}
Action: ${A}
Result: ${R}

Return ONLY raw JSON (no markdown, start with {):
{"score":0-100,"feedback":"1-2 sentences on what's strong and what was weak in the raw story","refined":{"situation":"polished, concise situation — 1-2 sentences","task":"clear ownership statement — 1 sentence","action":"3-5 specific actions with strong verbs — no passive voice","result":"quantified outcome with metrics where possible — include business impact"},"oneLiner":"one powerful sentence that captures the full story — suitable for a resume bullet or elevator pitch","bankAs":"short memorable name for this story (e.g. Checkout Migration Win)"}

Be specific — use the candidate's actual content. Add plausible metrics if they gave vague results but note it's an estimate.` }], 1200, null, { task: 'star' });
      const p = extractJSON(raw);
      if (p.error) throw new Error(p.msg);
      setRefined(p);
      const story = { id: Date.now(), bankAs: p.bankAs || p.oneLiner?.slice(0, 40), oneLiner: p.oneLiner, score: p.score, situation: S, refined: p.refined, date: new Date().toISOString() };
      if (updateMemory) updateMemory(
        m => ({ starBank: [story, ...(m.starBank || [])].slice(0, 20) }),
        { table: 'star_stories', data: { one_liner: story.oneLiner, score: p.score, situation: S, task: T, action: A, result: R, refined: p.refined } }
      );
    } catch (e) {
      showToast("Refinement failed: " + e.message, "error");
    }
    setLoading(false);
  };

  const reset = () => { setS(""); setT(""); setA(""); setR(""); setRefined(null); };

  const fc = [C.accent, C.gold, C.purple, C.green];
  const fields = [
    { l: "Situation", h: "Set the context", v: S, set: setS, rows: 3 },
    { l: "Task",      h: "Your responsibility", v: T, set: setT, rows: 2 },
    { l: "Action",    h: "What you specifically did", v: A, set: setA, rows: 4 },
    { l: "Result",    h: "Outcome & impact", v: R, set: setR, rows: 2 },
  ];

  return (
    <div className="fp-wrap" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {!embedded && <GetReadyTabStrip activeModuleId="star" onNavigate={setActiveModule} onStudyPlan={onStudyPlan || (() => {})} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>

        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>STAR Story Builder</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Build, score, and bank your best interview stories. AI turns rough notes into polished answers.</div>
        </div>

        <Card>
          {fields.map((f, i) => (
            <div key={f.l} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ background: fc[i] + "22", color: fc[i], borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</span>
                <span style={{ color: C.muted, fontSize: 11 }}>{f.h}</span>
              </div>
              <textarea
                value={f.v}
                onChange={e => f.set(e.target.value)}
                rows={f.rows}
                style={{ width: "100%", background: C.surface, border: `1px solid ${fc[i]}44`, borderRadius: 8, color: C.text, fontSize: 13, padding: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6 }}
              />
            </div>
          ))}
          <Btn onClick={refine} disabled={loading || !S || !T || !A || !R} color={C.gold} dark style={{ width: "100%", padding: 16, fontSize: 14 }}>
            {loading ? "Refining your story..." : "⭐ Refine & Bank My Story"}
          </Btn>
        </Card>

        {loading && <Card><Spinner label="Polishing your story into gold..." /></Card>}

        {refined && (
          <>
            <Card style={{ border: `1px solid ${C.gold}44`, background: C.gold + "05" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ color: C.gold, fontWeight: 900, fontSize: 15 }}>✨ Refined STAR Output</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: refined.score >= 80 ? C.green : refined.score >= 60 ? C.gold : C.red, fontWeight: 900, fontSize: 20 }}>{refined.score}</span>
                  <span style={{ color: C.muted, fontSize: 10 }}>/100</span>
                </div>
              </div>
              {refined.feedback && (
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 12, padding: "8px 12px", background: "rgba(255,255,255,.03)", borderRadius: 6 }}>{refined.feedback}</div>
              )}
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.7, background: C.surface, padding: 16, borderRadius: 8, fontStyle: "italic", borderLeft: `3px solid ${C.gold}`, marginBottom: 12 }}>
                "{refined.oneLiner}"
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(refined.refined || {}).map(([key, val], i) => (
                  <div key={key} style={{ background: C.surface, borderRadius: 8, padding: 12, borderLeft: `2px solid ${fc[i]}` }}>
                    <div style={{ color: fc[i], fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>{key}</div>
                    <div style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{val}</div>
                  </div>
                ))}
              </div>
            </Card>
            <button onClick={reset} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}>
              + Add Another Story
            </button>
          </>
        )}

        {memory?.starBank?.length > 0 && (
          <Card>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 12 }}>🗃 Story Bank ({memory.starBank.length})</div>
            {memory.starBank.slice(0, 5).map((story, i) => (
              <div key={story.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < Math.min(memory.starBank.length, 5) - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{story.bankAs || story.oneLiner?.slice(0, 50) + '...'}</div>
                <span style={{ color: story.score >= 80 ? C.green : story.score >= 60 ? C.gold : C.red, fontSize: 12, fontWeight: 800, flexShrink: 0, marginLeft: 12 }}>{story.score}/100</span>
              </div>
            ))}
          </Card>
        )}

      </div>
    </div>
  );
}
