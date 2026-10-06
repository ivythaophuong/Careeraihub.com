import React, { useState, useEffect } from 'react';
import { C } from '../../styles/theme';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { OrbitSpinner } from '../../components/OrbitMark';
import { userLevelIndex, isCacheCurrent, MARKET_CACHE_VERSION, MARKET_DATA_ENABLED } from './salaryLevel';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { pickResumeSource } from '../../lib/resumeSource';
import { copyToClipboard } from '../CoverLetterGen/coverLetter';
import { STAGES, CURRENCIES, MAX_SITUATION_CHARS, parseAmount, negotiationMath, formatMoney, allowedNumberSource, buildSalaryPrompt, normalizeSalaryResult, findUnsupportedFigures, findPlaceholders } from './salary';
import '../../styles/featurePage.css';

// ── Shared helpers ────────────────────────────────────────────────────────────
function SLabel({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--lp-text3)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function AiBubble({ children }) {
  return (
    <div style={{
      background: 'var(--lp-bg3)', border: '1px solid rgba(236,72,153,.18)',
      borderLeft: '4px solid var(--lp-teal)',
      borderRadius: 10, padding: '14px 16px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'linear-gradient(135deg,#EC4899,#F59E0B)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 900, color: '#000', flexShrink: 0,
      }}>AI</div>
      <div style={{ fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 1.65, flex: 1 }}>{children}</div>
    </div>
  );
}

// ── Market Data Tab ───────────────────────────────────────────────────────────
// Shown instead of the data while MARKET_DATA_ENABLED is false. No model call, no numbers.
function MarketDataUnavailable() {
  return (
    <div role="status" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 560 }}>
      <div style={{ color: 'var(--lp-text)', fontWeight: 800, fontSize: 15 }}>Market salary data is temporarily unavailable.</div>
      <div style={{ color: 'var(--lp-text3)', fontSize: 13, lineHeight: 1.6 }}>
        We're preparing salary benchmarks from verified market sources. Negotiation roleplay and Your strategy work in the meantime, using the numbers you enter.
      </div>
    </div>
  );
}

const CURRENCY = { Singapore: 'SGD', 'Southeast Asia': 'USD', Global: 'USD' };

function MarketDataTab({ form, memory, updateMemory, setForm }) {
  const role   = form?.role   || '';
  const level  = form?.level  || '';
  const market = form?.market || 'Singapore';
  const cur    = CURRENCY[market] || 'USD';
  const ctx    = { role, level, market };
  const cached = memory?.salaryMarket;
  const fresh  = isCacheCurrent(cached, ctx);

  const [data, setData]             = useState(fresh ? cached.data : null);
  const [computedAt, setComputedAt] = useState(fresh ? cached.computedAt : null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    if (!role) return;
    if (isCacheCurrent(memory?.salaryMarket, ctx)) {
      setData(memory.salaryMarket.data); setComputedAt(memory.salaryMarket.computedAt);
    } else {
      loadMarket();
    }
    // eslint-disable-next-line
  }, [role, level, market]);

  const loadMarket = async () => {
    setLoading(true); setError('');
    try {
      const raw = await callLLM([{ role: 'user', content:
        `You are a compensation analyst for ${market} tech roles.
Give approximate MONTHLY BASE salary ranges in ${cur} for the role family "${role}" at five levels. These are market estimates, not figures from a salary survey, and they say nothing about any individual candidate. Do not name specific employers.

Return ONLY raw JSON (no markdown, start with {):
{
  "levels": [
    {"label":"Junior","range":"<low>–<high>K","pct":0-100},
    {"label":"Mid","range":"<low>–<high>K","pct":0-100},
    {"label":"Senior","range":"<low>–<high>K","pct":0-100},
    {"label":"Principal","range":"<low>–<high>K","pct":0-100},
    {"label":"VP / Head","range":"<low>K+","pct":0-100}
  ],
  "employerTypes": [
    {"name":"Top tech co.","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Regional tech","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Startup","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"MNC","p50":"${cur} <n>K","p75":"${cur} <n>K"},
    {"name":"Scale-up","p50":"${cur} <n>K","p75":"${cur} <n>K"}
  ],${level ? `
  "totalComp": {"base":"${cur} <low>–<high>K / mo","bonus":"<low>–<high>% of base","equity":"typical equity at larger tech employers, or varies"},` : ''}
  "aiInsight": "2 sentences about pay for this role family in this market. Do not mention the candidate's level, current salary or equity."
}
${level ? `The totalComp values are typical for the ${level} level, not for any specific person.` : ''}` }], 900);
      const parsed = extractJSON(raw);
      if (parsed.error) throw new Error(parsed.msg);
      if (!Array.isArray(parsed.levels) || parsed.levels.length === 0) throw new Error('The market data came back incomplete.');
      const at = new Date().toISOString();
      setData(parsed); setComputedAt(at);
      if (updateMemory) updateMemory(m => ({ ...m, salaryMarket: { data: parsed, v: MARKET_CACHE_VERSION, forRole: role, forLevel: level, forMarket: market, computedAt: at } }));
    } catch {
      // No invented numbers as a fallback: say it failed and let the user retry.
      setData(null);
      setError('Market data is temporarily unavailable. Nothing was saved. Try again.');
    }
    setLoading(false);
  };

  if (!role) {
    return <div style={{ padding: 24, color: 'var(--lp-text3)', fontSize: 13 }}>Set your target role in your profile to see market ranges.</div>;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <OrbitSpinner size={40} />
        <div style={{ color: 'var(--lp-text3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Estimating market ranges…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ color: 'var(--lp-text2)', fontSize: 13 }}>{error || 'No market data yet.'}</div>
        <button onClick={loadMarket} style={{ padding: '8px 18px', background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Try again</button>
      </div>
    );
  }

  const userIdx = userLevelIndex(level);
  const generated = computedAt ? new Date(computedAt).toLocaleDateString() : null;

  return (
    <div style={{ padding: 24 }}>
      <div className="sal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: salary range bars */}
        <div>
          <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
            <SLabel>{market} {role} monthly base · AI estimate</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(data.levels || []).map((lv, i) => {
                const isUser = i === userIdx;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 140, fontSize: 12.5, color: isUser ? 'var(--lp-teal)' : 'var(--lp-text2)', fontWeight: isUser ? 700 : 400, flexShrink: 0 }}>
                      {lv.label}{isUser ? ' — your level' : ''}
                    </div>
                    <div style={{ flex: 1, height: 8, background: 'var(--lp-bg2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${lv.pct}%`, borderRadius: 4,
                        background: isUser ? 'linear-gradient(90deg,var(--lp-teal),#00E5A0)' : 'rgba(255,255,255,.12)',
                        transition: 'width .6s',
                      }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: isUser ? 700 : 400, color: isUser ? 'var(--lp-teal)' : 'var(--lp-text3)', width: 56, textAlign: 'right', flexShrink: 0 }}>
                      {lv.range}
                    </div>
                  </div>
                );
              })}
            </div>
            {userIdx < 0 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--lp-bdr)' }}>
                <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginBottom: 8 }}>
                  {level === 'Intern' ? 'Internships are not covered by these ranges.' : 'You haven\'t told us your level, so no row is highlighted. Which one are you?'}
                </div>
                {setForm && level !== 'Intern' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[['Junior', 'Junior'], ['Mid', 'Mid'], ['Senior', 'Senior'], ['Lead / Staff', 'Principal'], ['Director+', 'VP / Head']].map(([val, lbl]) => (
                      <button key={val} onClick={() => setForm(p => ({ ...p, level: val }))} style={{
                        background: 'transparent', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text2)',
                        borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                      }}>{lbl}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI bubble */}
          <AiBubble>
            {data.aiInsight}
          </AiBubble>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--lp-text3)', lineHeight: 1.5 }}>
            AI-generated estimate, not from a salary survey or employer data{generated ? ` · generated ${generated}` : ''}. Check it against real job listings before you rely on it.
          </div>
        </div>

        {/* Right: employer types + total comp */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
            <SLabel>By employer type · AI estimate</SLabel>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--lp-bdr)' }}>
                  {['Employer type', 'P50', 'P75'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data.employerTypes || []).map((co, i, arr) => (
                  <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--lp-bdr)' : 'none' }}>
                    <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--lp-text)' }}>{co.name}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--lp-text2)' }}>{co.p50}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--lp-text2)' }}>{co.p75}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {userIdx >= 0 && data.totalComp && (
            <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
              <SLabel>Typical total comp at {level} level · AI estimate</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { k: 'Base salary', v: data.totalComp.base },
                  { k: 'Annual bonus', v: data.totalComp.bonus },
                  { k: 'Equity (RSUs / options)', v: data.totalComp.equity },
                ].map(({ k, v }) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--lp-text2)' }}>{k}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--lp-text)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--lp-text3)' }}>
                This is a market pattern, not your compensation. Add your own numbers in Negotiation roleplay.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Negotiation Roleplay Tab (strategy built only from the user's own numbers) ──────────
const label = { color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };
const input = { width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" };
const STAGE_COLORS = { received_offer: C.green, pre_interview: C.accent, negotiating: C.gold, counter_offer: C.orange };

const bullets = (title, items, color = C.text, icon = '') => items.length > 0 && (
  <Card>
    <div style={{ color, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>{icon} {title}</div>
    {items.map((x, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6, lineHeight: 1.6 }}>• {x}</div>)}
  </Card>
);

function NegotiationTab({ resumeText, form, memory, setAuthModal }) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
      <div style={{ color: C.muted, fontSize: 13 }}>Word-for-word scripts and a plan for your situation. The math and the scripts use only the numbers you enter here.</div>

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

// ── Your Strategy Tab ─────────────────────────────────────────────────────────
function StrategyTab({ form }) {
  const role   = form?.role   || 'your target role';
  const market = form?.market || 'Singapore';

  const scripts = [
    {
      title: 'Anchor high — first number wins',
      body: `"Based on my research into ${market} market rates for ${role} and my ${form?.level ? form.level.toLowerCase() + '-level ' : ''}experience, I'm targeting a base of [X]. I'm excited about this role and I believe we can find a number that works."`,
      color: 'var(--lp-teal)',
    },
    {
      title: 'When they ask your current salary',
      body: `"I'd prefer to keep that private, but I can tell you that I'm looking for compensation in line with market rates for this level — which based on my research is [range]. Does that work for your budget?"`,
      color: '#FFB84D',
    },
    {
      title: 'Closing on total comp',
      body: `"The base works for me. Can we talk about the equity component? I've seen similar roles at [competitor] include [X RSUs] over 4 years — is there flexibility there?"`,
      color: '#00E5A0',
    },
  ];

  const checklist = [
    'Research P50 and P75 for your exact level + company',
    'Know your BATNA (best alternative to a negotiated agreement)',
    'Never accept on the spot — ask for time to review',
    'Negotiate base, bonus, RSUs, and start date separately',
    'Get the final offer in writing before giving notice',
    'Counter at least once — employers often expect a counter',
  ];

  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: script cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SLabel>Word-for-word scripts</SLabel>
        {scripts.map((s, i) => (
          <div key={i} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderLeft: `4px solid ${s.color}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', marginBottom: 10 }}>{s.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.75, fontStyle: 'italic' }}>{s.body}</div>
          </div>
        ))}
      </div>

      {/* Right: checklist */}
      <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 12, padding: '18px 20px' }}>
        <SLabel>Negotiation checklist</SLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--lp-bdr2, rgba(255,255,255,.12))', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: 'var(--lp-text2)', lineHeight: 1.5 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'market',    label: 'Market data'         },
  { id: 'roleplay',  label: 'Negotiation roleplay' },
  { id: 'strategy',  label: 'Your strategy'        },
];

export default function SalaryCoach({ resumeText, form, setForm, memory, updateMemory, setAuthModal }) {
  const [tab, setTab] = useState(MARKET_DATA_ENABLED ? 'market' : 'roleplay');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--lp-ff)' }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
        <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22, marginBottom: 2 }}>Salary Prep</div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13, marginBottom: 0 }}>
          {MARKET_DATA_ENABLED
            ? `${form?.market || 'Singapore'} ${form?.role || 'PM'} market estimates, AI negotiation roleplay, and anchoring scripts you fill in with your own numbers.`
            : 'AI negotiation roleplay and anchoring scripts you fill in with your own numbers.'}
        </div>
        {/* Tab bar */}
        {/* The tabs scroll inside this bar on a phone; without that they widen the whole page (418px at 375px). */}
        <div role="tablist" style={{ display: 'flex', gap: 0, marginTop: 14, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0, padding: '10px 18px', fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--lp-teal)' : 'var(--lp-text3)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.id ? 'var(--lp-teal)' : 'transparent'}`,
              cursor: 'pointer', fontFamily: 'var(--lp-ff)', whiteSpace: 'nowrap',
              transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'market'   && (MARKET_DATA_ENABLED
        ? <MarketDataTab form={form} setForm={setForm} memory={memory} updateMemory={updateMemory} />
        : <MarketDataUnavailable />)}
      {tab === 'roleplay' && <NegotiationTab  form={form} resumeText={resumeText} memory={memory} setAuthModal={setAuthModal} />}
      {tab === 'strategy' && <StrategyTab     form={form} />}
    </div>
  );
}
