import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Badge, Btn } from '../../components/CommonUI';

// ── Regional hiring guide ─────────────────────────────────────────────────────
// Static, hand-written rules of thumb. There is no data feed, no model call and no timestamp, so
// nothing here may be presented as measured or live market data.
export default function MarketIntel({ form, memory }) {
  const markets = [
    { 
      region: "🇸🇬 Singapore", 
      insight: "A highly structured market emphasizing cultural fit. Proactive communication and local CPF (Central Provident Fund) knowledge are often expected for finance and operations roles. Networking via local tech events is a major shortcut here.", 
      tag: "SEA",
      metrics: { rounds: "3–5", speed: "2–3 weeks", negotiation: "Expected", signal: "Culture fit" }
    },
    { 
      region: "🇺🇸 US Tech", 
      insight: "Leetcode-heavy for engineering and Case-heavy for PMs. The STAR (Situation, Task, Action, Result) method is absolutely critical. In this market, salary negotiation is not just expected—it's often seen as a sign of seniority and confidence.", 
      tag: "Tech Hub",
      metrics: { rounds: "5–8", speed: "2–6 weeks", negotiation: "Aggressive", signal: "Metrics & Data" }
    },
    { 
      region: "🇪🇺 Europe", 
      insight: "Work-life balance is a core value. Hiring cycles are tend towards the longer side (4–8 weeks). CV formats vary significantly by country (e.g., Germany prefers detailed long-form, UK prefers minimalist 2-pagers).", 
      tag: "EU Zone",
      metrics: { rounds: "4–6", speed: "4–8 weeks", negotiation: "Moderate", signal: "Process Mastery" }
    },
    { 
      region: "🌐 Remote-First", 
      insight: "Proof of asynchronous communication is your highest value currency. Written samples or \"take-home\" culture exercises are often requested. Overlap hours matter more than nationality—be explicit about your timezone availability.", 
      tag: "Global",
      metrics: { rounds: "2–4", speed: "1–3 weeks", negotiation: "Flexible", signal: "Async Skills" }
    }
  ];

  const [sel, setSel] = useState(() => {
    const i = markets.findIndex(m => m.region.toLowerCase().includes(form.market.toLowerCase().slice(0, 4)));
    return i >= 0 ? i : 0;
  });

  const selectedMarket = markets[sel];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* ── HEADER ── */}
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Regional Hiring Guide</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Hiring playbooks and negotiation norms differ across regions.</div>
        <div role="note" style={{ color: C.muted, fontSize: 11, marginTop: 8, padding: "6px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>General guidance and rules of thumb, not live market data. Practices vary a lot between companies, so confirm with the employer.</div>
      </div>

      {/* ── INTERACTIVE REGION GRID ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {markets.map((m, i) => (
          <div 
            key={i} 
            onClick={() => setSel(i)} 
            style={{ 
              background: sel === i ? C.accent + "08" : C.surface, 
              border: `1px solid ${sel === i ? C.accent : C.border}`, 
              borderRadius: 12, padding: "16px 20px", cursor: "pointer", 
              transition: "all 0.2s", display: "flex", flexDirection: "column", gap: 6,
              boxShadow: sel === i ? `0 0 20px ${C.accent}15` : 'none'
            }}
          >
            <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{m.region}</div>
            <div style={{ display: "flex" }}>
               <Badge label={m.tag} color={sel === i ? C.accent : C.muted} />
            </div>
          </div>
        ))}
      </div>

      {/* ── DETAILED PLAYBOOK CARD ── */}
      <Card style={{ border: `1px solid ${C.accent}44`, background: C.accent + "05", padding: 24 }}>
        <div style={{ color: C.accent, fontWeight: 900, fontSize: 16, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{selectedMarket.region} Playbook</div>
        <div style={{ color: C.text, fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>{selectedMarket.insight}</div>
        
        {/* METRIC GRID */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Interview Rounds (typical)", val: selectedMarket.metrics.rounds },
            { label: "Decision Speed (typical)", val: selectedMarket.metrics.speed },
            { label: "Negotiation Norms", val: selectedMarket.metrics.negotiation },
            { label: "What employers often look for", val: selectedMarket.metrics.signal },
          ].map((m, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 800 }}>{m.label}</div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{m.val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── INSIDER ADVICE ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}11, ${C.accent}01)`, borderLeft: `4px solid ${C.purple}`, borderRadius: "0 12px 12px 0", padding: "16px 20px" }}>
        <div style={{ color: C.purple, fontWeight: 800, fontSize: 12, textTransform: "uppercase", marginBottom: 6, letterSpacing: 1 }}>Pro Advice: Global Mobility</div>
        <div style={{ color: C.text, fontSize: 13, lineHeight: 1.6 }}>If you are applying to multiple markets, keep a "Base Resume" for master archives and create "Regional Forks" to match local CV expectations.</div>
      </div>

    </div>
  );
}
