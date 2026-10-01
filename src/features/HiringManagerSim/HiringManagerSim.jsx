import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner, PreviewBanner } from '../../components/CommonUI';

export default function HiringManagerSim({ resumeText, scanResult, form, memory, updateMemory }) {
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState(null);
  const [answer, setAnswer] = useState("");

  const modes = [
    { id: "startup", label: "Seed Startup", icon: "🚀", desc: "Fast-paced, metric obsessed.", color: C.gold },
    { id: "seriesb", label: "Series B", icon: "📈", desc: "Scale focused, PMF ready.", color: C.accent },
    { id: "enterprise", label: "Fortune 500", icon: "🏢", desc: "Stakeholder management.", color: C.purple },
    { id: "technical", label: "Tech Lead", icon: "⚙️", desc: "Architecture deep dives.", color: C.red }
  ];

  const simulate = () => {
    if (!mode) {
      showToast("Please select an interview persona first", "info");
      return;
    }
    if (!answer.trim()) {
      showToast("Please type your answer before getting feedback", "error");
      return;
    }
    setLoading(true); setFb(null);
    setTimeout(() => {
      setFb({
        score: 72,
        verdict: "Acceptable",
        worked: "Strong communication on technical debt.",
        missed: "Vague on the actual revenue impact of the checkout rewrite.",
        tip: "Quantify the reduction in friction in $$$ terms."
      });
      setLoading(false);
    }, 4000);
  };

  if (!mode) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Hiring Manager Simulator</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Select a persona to begin a personalized AI interview simulation.</div>
        {!resumeText && <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 8, padding: "8px 12px", background: C.gold + "11", borderRadius: 8, border: `1px solid ${C.gold}33` }}>⚠️ Upload resume for personalized questions.</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {modes.map(m => (
          <Card key={m.id} style={{ cursor: "pointer", border: `1px solid ${m.color}33`, background: m.color + "05" }} onClick={() => setMode(m)}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{m.icon}</div>
            <div style={{ color: m.color, fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{m.label}</div>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>{m.desc}</div>
            <Badge label="Select Mode" color={m.color} />
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>{mode.icon} {mode.label}</div><div style={{ color: C.muted, fontSize: 12 }}>Personalized simulation active</div></div>
          <button onClick={() => { setMode(null); setFb(null); }} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>← Reset</button>
       </div>

       <Card style={{ border: `1px solid ${mode.color}44`, background: mode.color + "05" }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Question 1/5</div>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1.6 }}>"Walk me through how you handled the checkout migration. Specifically, how did you manage the stakeholder expectations when the latency spiked?"</div>
       </Card>

       <textarea 
         value={answer} onChange={e => setAnswer(e.target.value)} 
         placeholder="Type your STAR answer here..."
         style={{ width: "100%", minHeight: 120, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 16, fontSize: 13, outline: "none", lineHeight: 1.7 }}
       />

       <div style={{ display: "flex", gap: 12 }}>
          <Btn onClick={simulate} disabled={loading || !answer.trim()} color={mode.color} dark style={{ flex: 1 }}>🧠 Get AI Feedback</Btn>
          <Btn color={C.border} style={{ padding: "11px 20px" }}>Skip →</Btn>
       </div>

       {loading && <Card><Spinner label={`Evaluating as ${mode.label}...`} /></Card>}

       {fb && (
         <Card style={{ border: `1px solid ${fb.score >= 75 ? C.green : C.gold}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
               <div style={{ color: fb.score >= 75 ? C.green : C.gold, fontWeight: 900, fontSize: 20 }}>{fb.verdict}</div>
               <div style={{ color: fb.score >= 75 ? C.green : C.gold, fontSize: 24, fontWeight: 900 }}>{fb.score}%</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               <div><div style={{ color: C.green, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Worked</div><div style={{ color: C.text, fontSize: 13 }}>{fb.worked}</div></div>
               <div><div style={{ color: C.red, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>What Missed</div><div style={{ color: C.text, fontSize: 13 }}>{fb.missed}</div></div>
               <div style={{ background: C.surface, padding: 12, borderRadius: 8, borderLeft: `3px solid ${C.accent}` }}><div style={{ color: C.accent, fontSize: 10, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>Professional Tip</div><div style={{ color: C.text, fontSize: 13, fontStyle: "italic" }}>{fb.tip}</div></div>
            </div>
         </Card>
       )}
    </div>
  );
}
