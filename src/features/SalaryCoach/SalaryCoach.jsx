import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner, PreviewBanner } from '../../components/CommonUI';

export default function SalaryCoach({ resumeText, form, memory, updateMemory }) {
  const [offer, setOffer] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState("received_offer");

  const stages = [
    { id: "received_offer", label: "Got an Offer", icon: "📩", color: C.green },
    { id: "pre_interview", label: "Before Interviews", icon: "🎯", color: C.accent },
    { id: "negotiating", label: "Mid-Negotiation", icon: "🤝", color: C.gold },
    { id: "counter_offer", label: "Counter Offer", icon: "⚡", color: C.orange },
  ];

  const analyze = () => {
    if (!offer.trim()) {
      showToast("Please describe your current offer or situation", "error");
      return;
    }
    setLoading(true); setResult(null);
    setTimeout(() => {
      setResult({
        marketMin: "$110,000",
        marketMid: "$135,000",
        marketMax: "$165,000",
        assessment: "Your offer is competitive but $12k below the median for your experience level at this company size.",
        scripts: [
          { label: "Opening Strategy", text: "I was excited to receive the offer. However, based on my specialized expertise in React performance, I was expecting something closer to $145k..." }
        ],
        leverage: ["Lead experience", "Specific industry knowledge"]
      });
      setLoading(false);
    }, 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Salary Negotiation Coach</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Know your value. Get word-for-word scripts. Negotiate from power.</div>
        {!resumeText && <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 8, padding: "8px 12px", background: C.gold + "11", borderRadius: 8, border: `1px solid ${C.gold}33` }}>⚠️ Upload resume for personalized questions.</div>}
      </div>

      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
           {stages.map(s => (
             <button key={s.id} onClick={() => setStage(s.id)} style={{ background: stage === s.id ? s.color + "22" : "transparent", border: `1px solid ${stage === s.id ? s.color : C.border}`, color: stage === s.id ? s.color : C.muted, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{s.icon} {s.label}</button>
           ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Current Offer / Situation</div>
          <textarea 
            value={offer} onChange={e => setOffer(e.target.value)} 
            placeholder={`e.g. "I got an offer for $95k base + 10% bonus for a ${form.role} role at a mid-sized tech firm."`}
            style={{ width: "100%", minHeight: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 14, fontSize: 13, outline: "none", lineHeight: 1.7 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Your Target (optional)</div>
          <input 
            value={target} onChange={e => setTarget(e.target.value)} 
            placeholder='e.g. $115k minimum'
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 13, outline: "none" }}
          />
        </div>
        <Btn onClick={analyze} disabled={loading || !offer.trim()} color={C.green} dark style={{ width: "100%", padding: 16 }}>💰 Get Negotiation Strategy</Btn>
      </Card>

      {loading && <Card><Spinner label="Retrieving market data benchmarks..." /></Card>}

      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Card style={{ border: `1px solid ${C.muted}44`, background: C.muted + "05" }}>
              <div style={{ color: C.muted, fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Market Min</div>
              <div style={{ color: C.muted, fontSize: 18, fontWeight: 900 }}>{result.marketMin}</div>
            </Card>
            <Card style={{ border: `1px solid ${C.gold}44`, background: C.gold + "05" }}>
              <div style={{ color: C.gold, fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Median</div>
              <div style={{ color: C.gold, fontSize: 18, fontWeight: 900 }}>{result.marketMid}</div>
            </Card>
            <Card style={{ border: `1px solid ${C.green}44`, background: C.green + "05" }}>
              <div style={{ color: C.green, fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 6 }}>Max</div>
              <div style={{ color: C.green, fontSize: 18, fontWeight: 900 }}>{result.marketMax}</div>
            </Card>
          </div>
          
          <Card style={{ borderLeft: `4px solid ${C.gold}` }}>
             <div style={{ color: C.gold, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>📊 Market Assessment</div>
             <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.assessment}</div>
          </Card>

          <Card style={{ border: `1px solid ${C.accent}44` }}>
             <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 12 }}>💬 Word-for-Word Scripts</div>
             {result.scripts.map((s, i) => (
               <div key={i}>
                 <div style={{ color: C.gold, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                 <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8, background: C.surface, padding: 16, borderRadius: 8, fontStyle: "italic", borderLeft: `3px solid ${C.accent}` }}>"{s.text}"</div>
               </div>
             ))}
          </Card>
        </>
      )}
    </div>
  );
}
