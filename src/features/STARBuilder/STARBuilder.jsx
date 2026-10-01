import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner, PreviewBanner } from '../../components/CommonUI';

export default function STARBuilder({ resumeText, form, memory, updateMemory }) {
  const [S, setS] = useState(""); const [T, setT] = useState(""); const [A, setA] = useState(""); const [R, setR] = useState("");
  const [refined, setRefined] = useState(null);
  const [loading, setLoading] = useState(false);

  const refine = async () => {
    if (!S || !T || !A || !R) {
      showToast("Please complete all four STAR sections before refining", "error");
      return;
    }
    setLoading(true); setRefined(null);
    
    // Simulation for UI parity
    setTimeout(() => {
      const p = {
        score: 88,
        refined: {
          situation: "Leading the checkout team during a major site migration.",
          task: "Zero downtime migration for 2M daily active users.",
          action: "Implemented blue-green deployments and automated rollbacks.",
          result: "100% uptime maintained, 15% increase in conversion rate."
        },
        oneLiner: "Orchestrated 100% uptime migration for 2M users with 15% conversion lift."
      };
      setRefined(p);
      setLoading(false);
      // Sample output is not banked until this module calls the real AI.
    }, 3000);
  };

  const fc = [C.accent, C.gold, C.purple, C.green];
  const fields = [
    { l: "Situation", h: "Context", v: S, set: setS, rows: 3 },
    { l: "Task", h: "Responsibility", v: T, set: setT, rows: 2 },
    { l: "Action", h: "Action Taken", v: A, set: setA, rows: 4 },
    { l: "Result", h: "Outcome", v: R, set: setR, rows: 2 }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>STAR Story Builder</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Build, score, and bank your best interview stories.</div>
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
        <Btn onClick={refine} disabled={loading || !S || !T || !A || !R} color={C.gold} dark style={{ width: "100%", padding: 16, fontSize: 14 }}>⭐ Refine & Bank My Story</Btn>
      </Card>

      {loading && <Card><Spinner label="Polishing your story into gold..." /></Card>}

      {refined && (
        <Card style={{ border: `1px solid ${C.gold}44`, background: C.gold + "05" }}>
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 15, marginBottom: 12 }}>✨ Refined STAR Output</div>
          <div style={{ color: C.text, fontSize: 12, lineHeight: 1.7, background: C.surface, padding: 16, borderRadius: 8, fontStyle: "italic", borderLeft: `3px solid ${C.gold}` }}>
             "{refined.oneLiner}"
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
             {Object.entries(refined.refined).map(([key, val], i) => (
               <div key={key} style={{ background: C.surface, borderRadius: 8, padding: 12, borderLeft: `2px solid ${fc[i]}` }}>
                 <div style={{ color: fc[i], fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>{key}</div>
                 <div style={{ color: C.text, fontSize: 11, lineHeight: 1.5 }}>{val}</div>
               </div>
             ))}
          </div>
        </Card>
      )}
    </div>
  );
}
