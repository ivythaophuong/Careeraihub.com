import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { pickResumeSource } from '../../lib/resumeSource';
import { copyToClipboard } from '../CoverLetterGen/coverLetter';
import { STAGES, CURRENCIES, MAX_SITUATION_CHARS, parseAmount, negotiationMath, formatMoney, allowedNumberSource, buildSalaryPrompt, normalizeSalaryResult, findUnsupportedFigures, findPlaceholders } from './salary';

const label = { color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };
const input = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" };
const STAGE_COLORS = { received_offer: C.green, pre_interview: C.accent, negotiating: C.gold, counter_offer: C.orange };

const bullets = (title, items, color = C.text, icon = '') => items.length > 0 && (
  <Card>
    <div style={{ color, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>{icon} {title}</div>
    {items.map((x, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6, lineHeight: 1.6 }}>• {x}</div>)}
  </Card>
);

export default function SalaryCoach({ resumeText, form, memory, setAuthModal }) {
  const [stage, setStage] = useState("received_offer");
  const [situation, setSituation] = useState("");
  const [currency, setCurrency] = useState("SGD");
  const [offer, setOffer] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [math, setMath] = useState(null);
  const [unsupported, setUnsupported] = useState([]);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  const liveMath = negotiationMath({ offer, target });
  const badAmount = (v) => v.trim() !== "" && parseAmount(v) === null;

  const generate = async () => {
    if (situation.trim().length < 20) { setErr("Describe your situation in a sentence or two (at least 20 characters)."); return; }
    if (badAmount(offer) || badAmount(target)) { setErr("Enter amounts as plain numbers, e.g. 95000 or 95k."); return; }
    setLoading(true); setResult(null); setErr(""); setCopied("");
    const m = negotiationMath({ offer, target });
    const resume = pickResumeSource({ memory, resumeText });
    const offerClean = parseAmount(offer), targetClean = parseAmount(target);
    try {
      const prompt = buildSalaryPrompt({ situation, stage, offer: offerClean, target: targetClean, currency, math: m, resume });
      const raw = await callLLM([{ role: 'user', content: prompt }], 3000, resume.pdfBase64);
      const parsed = normalizeSalaryResult(extractJSON(raw));
      setResult(parsed);
      setMath(m);
      setUnsupported(findUnsupportedFigures(allowedNumberSource({ situation, offer: offerClean, target: targetClean, math: m, currency }), parsed));
    } catch (e) {
      if (e.status === 401 && setAuthModal) {
        setErr('Create a free account or sign in to get a negotiation strategy.');
        setAuthModal('register');
      } else {
        setErr(e.message || 'Could not build the strategy. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async (id, text) => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? id : `${id}-failed`);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Salary Negotiation Coach</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Get word-for-word scripts and a plan for your situation. Strategy only — no made-up salary data.</div>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(STAGES).map(([id, s]) => (
            <button key={id} onClick={() => setStage(id)} aria-pressed={stage === id} style={{ background: stage === id ? STAGE_COLORS[id] + "22" : "transparent", border: `1px solid ${stage === id ? STAGE_COLORS[id] : C.border}`, color: stage === id ? STAGE_COLORS[id] : C.muted, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={label}>Your Situation</div>
          <textarea
            aria-label="Situation"
            value={situation}
            maxLength={MAX_SITUATION_CHARS}
            onChange={e => { setSituation(e.target.value); setErr(""); }}
            placeholder={`e.g. "I got an offer for a ${form?.role || 'product manager'} role at a mid-sized tech firm: base plus 10% bonus. I have 6 years' experience and one competing interview."`}
            style={{ ...input, minHeight: 100, lineHeight: 1.7, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
          <div>
            <div style={label}>Currency</div>
            <select aria-label="Currency" value={currency} onChange={e => setCurrency(e.target.value)} style={input}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={label}>Offered Base (optional)</div>
            <input aria-label="Offered base" inputMode="decimal" value={offer} onChange={e => { setOffer(e.target.value); setErr(""); }} placeholder="e.g. 95000" style={{ ...input, borderColor: badAmount(offer) ? C.red : C.border }} />
          </div>
          <div>
            <div style={label}>Your Target (optional)</div>
            <input aria-label="Target base" inputMode="decimal" value={target} onChange={e => { setTarget(e.target.value); setErr(""); }} placeholder="e.g. 115000" style={{ ...input, borderColor: badAmount(target) ? C.red : C.border }} />
          </div>
        </div>
        <div style={{ color: C.muted, fontSize: 11, marginBottom: 16 }}>Figures are used only for the math below and to fill in your scripts. Nothing is compared with market data.</div>

        {liveMath && (
          <div data-testid="live-math" style={{ background: C.surface, border: `1px solid ${liveMath.targetBelowOffer ? C.red : C.green}44`, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12, lineHeight: 1.7, color: C.text }}>
            {liveMath.targetBelowOffer ? (
              <span style={{ color: C.red }}>⚠️ Your target is below the offer. Double-check the two numbers.</span>
            ) : (
              <>
                <div>You are asking for <strong>{formatMoney(liveMath.gap, currency)}</strong> more (<strong>+{liveMath.pct}%</strong>) than the offer.</div>
                <div style={{ color: C.muted }}>Tactic: opening exactly at your target leaves no room to concede. Consider opening around <strong style={{ color: C.text }}>{formatMoney(liveMath.openingLow, currency)}–{formatMoney(liveMath.openingHigh, currency)}</strong> (5–10% above your target) and settling near it.</div>
              </>
            )}
          </div>
        )}

        {err && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
        <Btn onClick={generate} disabled={loading} color={C.green} dark style={{ width: "100%", padding: 16 }}>{loading ? "Building your strategy..." : "💰 Get Negotiation Strategy"}</Btn>
      </Card>

      {loading && <Card><Spinner label="Building your negotiation plan..." /></Card>}

      {result && !loading && (
        <>
          {unsupported.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}66`, background: C.gold + "0D" }}>
              <div role="alert" style={{ color: C.gold, fontWeight: 900, fontSize: 12, marginBottom: 6 }}>⚠️ Check these numbers before you use anything below</div>
              <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>
                The AI used numbers that you didn't enter: <strong>{unsupported.join(', ')}</strong>. They are not verified market data. Remove them or replace them with figures you can back up.
              </div>
            </Card>
          )}

          {result.assessment && (
            <Card style={{ borderLeft: `4px solid ${C.gold}` }}>
              <div style={{ color: C.gold, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>📊 Your Position</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.assessment}</div>
              {math && !math.targetBelowOffer && <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Your ask is +{math.pct}% over the offer. This coach has no salary database, so check how that compares with the market using the research list below.</div>}
            </Card>
          )}

          <Card style={{ border: `1px solid ${C.accent}44` }}>
            <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 4 }}>💬 Word-for-Word Scripts</div>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Fill in anything in [brackets] and make it sound like you.</div>
            {result.scripts.map((s, i) => {
              const open = findPlaceholders(s.text);
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <div style={{ color: C.gold, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
                    <button onClick={() => copy(`script-${i}`, s.text)} style={smallBtn}>{copied === `script-${i}` ? 'Copied ✓' : copied === `script-${i}-failed` ? 'Copy failed' : 'Copy'}</button>
                  </div>
                  {s.when && <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>Use when: {s.when}</div>}
                  <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8, background: C.surface, padding: 16, borderRadius: 8, fontStyle: "italic", borderLeft: `3px solid ${C.accent}`, whiteSpace: "pre-line" }}>"{s.text}"</div>
                  {open.length > 0 && <div style={{ color: C.gold, fontSize: 11, marginTop: 6 }}>To fill in: {open.join(', ')}</div>}
                </div>
              );
            })}
          </Card>

          {bullets('Your Leverage', result.leverage, C.green, '💪')}
          {bullets('Other Things To Negotiate', result.nonSalaryLevers, C.accent, '🎁')}
          {bullets('Questions To Ask Them', result.questionsToAsk, C.accent, '❓')}
          {bullets('Research The Real Market Range', result.researchChecklist, C.gold, '🔎')}
          {bullets('Mistakes To Avoid', result.pitfalls, C.red, '🚫')}

          {result.ifTheySayNo && (
            <Card>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 8 }}>🧭 If They Say No</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.8 }}>{result.ifTheySayNo}</div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const smallBtn = { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
