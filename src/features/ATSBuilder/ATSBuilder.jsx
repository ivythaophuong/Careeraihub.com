import React, { useState, useRef, useCallback, useEffect } from 'react';
import mammoth from 'mammoth';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { extractTextFromPdfFile } from '../../lib/resumeParser.js';
import { digestResume } from '../../lib/resumeDigest.js';
import { OrbitSpinner } from '../../components/OrbitMark';
import { NextStepBanner } from '../../components/CommonUI';
import {
  SEVERITY_ORDER, CATEGORIES,
  genId, arrayBufferToBase64, computeLineDiff, sortGapsBySeverity, buildRebuildPrompt, stripHtmlToText, buildAnalysisPrompt, buildScanRecord,
} from './atsBuilderUtils.js';
import { TEMPLATES } from './resumeTemplates.jsx';
import html2pdf from 'html2pdf.js';
import './atsBuilder.css';
import { resumeContent } from '../../lib/resumeText';
import { computeDeterministicScore } from '../../scoring/computeDeterministicScore';

// ── ATS Scanner Demo ──────────────────────────────────────────────────────────

const ATS_ENGINES = [
  { label:'Keyword match',   before:'12% — missing OKR, SQL',  after:'89% match',            pts:22, dims:{ d0:'91%', b0:91 }, insight:'ATS systems tokenise your resume against the JD word-for-word. "Responsible for team tasks" scores 0 for a JD listing "OKR-driven roadmap". We injected 6 exact-match keywords.' },
  { label:'Bullet impact',   before:'No numbers anywhere',       after:'3 bullets quantified', pts:15, dims:{ d2:'85%', b2:85 }, insight:'Bullets without numbers are skipped in 7-second recruiter scans. "Led OKR roadmap → +28% retention" triggers both ATS keyword match AND the recruiter eye-scan.' },
  { label:'Section headers', before:'Non-standard labels',       after:'ATS-readable headers', pts:8,  dims:{ d1:'88%', b1:88 }, insight:"Many parsers look for exact strings: \"Experience\", \"Skills\", \"Education\". A header like \"What I've done\" causes the parser to skip the section — your best content disappears." },
  { label:'Action verbs',    before:'Helped, worked, assisted',  after:'Led, Built, Drove',    pts:7,  dims:{},                 insight:'Weak openers signal a supporting role to ATS seniority models. Strong verbs also match JD language — "led" matches "leadership experience required".' },
  { label:'Role seniority',  before:'Junior-level framing',      after:'Senior PM aligned',    pts:5,  dims:{ d3:'94%', b3:94 }, insight:'ATS cross-checks your years, seniority language, and impact scope against the role level. We align your framing without inventing anything.' },
  { label:'File & format',   before:'Tables + parse errors',     after:'Clean single-column',  pts:4,  dims:{},                 insight:'PDF tables and multi-column layouts scramble text order in ATS parsers. Single-column plain text is the safest format across all systems.' },
];

function AtsScannerDemo() {
  const [phase, setPhase] = useState('pre');
  const [scanPct, setScanPct] = useState(0);
  const [stepsLit, setStepsLit] = useState([false,false,false,false,false]);
  const [lineStates, setLineStates] = useState([0,0,0,0,0]);
  const [scanScore, setScanScore] = useState(0);
  const [afterVisible, setAfterVisible] = useState(false);
  const [cardTitle, setCardTitle] = useState('AI Scanning…');
  const [badgeColor, setBadgeColor] = useState('#EC4899');
  const [fixStep, setFixStep] = useState(0);
  const [fixApplied, setFixApplied] = useState(new Array(6).fill(false));
  const [afterScore, setAfterScore] = useState(38);
  const [dimVals, setDimVals] = useState({ d0:'—', d1:'—', d2:'—', d3:'—' });
  const [dimBars, setDimBars] = useState({ b0:0, b1:0, b2:0, b3:0 });
  const [afterTitle, setAfterTitle] = useState('Waiting for scan…');
  const [afterSub, setAfterSub] = useState('Results will appear here');
  const [showDelta, setShowDelta] = useState(false);
  const [showKw, setShowKw] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [finalBanner, setFinalBanner] = useState(false);
  const [insight, setInsight] = useState('');
  const timers = useRef([]);
  const ivRef = useRef(null);

  const clearAll = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
  };
  const addT = (fn, d) => { timers.current.push(setTimeout(fn, d)); };

  const completeScan = useCallback(() => {
    setAfterVisible(true);
    setAfterTitle('Scan complete — apply fixes');
    setAfterSub('Press "Apply next fix" to see AI improve each issue');
    addT(() => { setPhase('fixmode'); setCardTitle('ATS engine — 6 checks'); setBadgeColor('#F59E0B'); }, 600);
  }, []);

  const startScan = useCallback(() => {
    setPhase('scanning');
    const order = [0,2,4,1,3];
    order.forEach((li,i) => {
      addT(() => setLineStates(s => { const n=[...s]; n[li]=1; return n; }), i*80);
      addT(() => setLineStates(s => { const n=[...s]; n[li]=2; return n; }), i*80+480);
    });
    [20,42,65,82,100].forEach((p,i) => addT(() => setScanPct(p), i*340));
    [0,350,700,1050,1400].forEach((d,i) => addT(() => setStepsLit(s => { const n=[...s]; n[i]=true; return n; }), d));
    addT(() => {
      let cur = 0;
      ivRef.current = setInterval(() => {
        cur = Math.min(cur+3, 38);
        setScanScore(cur);
        if (cur >= 38) { clearInterval(ivRef.current); ivRef.current=null; completeScan(); }
      }, 28);
    }, 500);
  }, [completeScan]);

  const replay = useCallback(() => {
    clearAll();
    setPhase('pre'); setScanPct(0); setStepsLit([false,false,false,false,false]);
    setLineStates([0,0,0,0,0]); setScanScore(0); setAfterVisible(false);
    setCardTitle('AI Scanning…'); setBadgeColor('#EC4899');
    setFixStep(0); setFixApplied(new Array(6).fill(false)); setAfterScore(38);
    setDimVals({ d0:'—', d1:'—', d2:'—', d3:'—' }); setDimBars({ b0:0, b1:0, b2:0, b3:0 });
    setAfterTitle('Waiting for scan…'); setAfterSub('Results will appear here');
    setShowDelta(false); setShowKw(false); setShowNote(false); setFinalBanner(false); setInsight('');
    addT(startScan, 600);
  }, [startScan]);

  useEffect(() => { addT(startScan, 1200); return clearAll; }, [startScan]);

  const applyFix = () => {
    if (fixStep >= ATS_ENGINES.length) return;
    const e = ATS_ENGINES[fixStep];
    setFixApplied(s => { const n=[...s]; n[fixStep]=true; return n; });
    const ns = afterScore + e.pts;
    setAfterScore(ns); setInsight(e.insight);
    if ('d0' in e.dims) setDimVals(s => ({ ...s, d0:e.dims.d0 }));
    if ('d1' in e.dims) setDimVals(s => ({ ...s, d1:e.dims.d1 }));
    if ('d2' in e.dims) setDimVals(s => ({ ...s, d2:e.dims.d2 }));
    if ('d3' in e.dims) setDimVals(s => ({ ...s, d3:e.dims.d3 }));
    if ('b0' in e.dims) setDimBars(s => ({ ...s, b0:e.dims.b0 }));
    if ('b1' in e.dims) setDimBars(s => ({ ...s, b1:e.dims.b1 }));
    if ('b2' in e.dims) setDimBars(s => ({ ...s, b2:e.dims.b2 }));
    if ('b3' in e.dims) setDimBars(s => ({ ...s, b3:e.dims.b3 }));
    if (ns >= 80) { setAfterTitle('Strong ATS match ✓'); setAfterSub('Passes filter for Senior PM roles in Singapore.'); setShowDelta(true); }
    else { setAfterTitle('Improving… keep going'); setAfterSub(`${ns}% — ${91-ns} pts left to reach 91%`); }
    if (ns >= 60) setShowKw(true);
    if (ns >= 85) setShowNote(true);
    const nxt = fixStep + 1;
    setFixStep(nxt);
    if (nxt >= ATS_ENGINES.length) { setPhase('done'); setFinalBanner(true); setAfterScore(91); }
  };

  const lw = [false,true,false,true,false];
  const lineColor = i => lineStates[i]===1 ? 'rgba(236,72,153,.15)' : lineStates[i]===2 ? (lw[i] ? 'rgba(255,210,51,.1)' : 'rgba(0,229,160,.14)') : 'rgba(255,255,255,.07)';
  const lineBdr = i => lineStates[i]===1 ? '2px solid #EC4899' : lineStates[i]===2 ? (lw[i] ? '2px solid rgba(255,210,51,.5)' : '2px solid #00E5A0') : '';
  const stepLabels = ['Reading structure','Extracting keywords','Matching PM roles','Scoring 5 dimensions','Generating fix recommendations'];
  const dimColors = ['#EC4899','#00E5A0','#F59E0B','#FFD233'];
  const dimKeys = ['d0','d1','d2','d3'];
  const barKeys = ['b0','b1','b2','b3'];
  const dimLabels = ['Keywords','Formatting','Impact','Role fit'];
  const C = { glass:'rgba(13,20,40,.9)', bdr:'rgba(255,255,255,.06)', bdr2:'rgba(255,255,255,.12)', text2:'var(--lp-text2)', text3:'var(--lp-text3)' };

  return (
    <div style={{ marginTop: 32, padding: '0 24px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--lp-teal)', animation:'lp-pulse 2s infinite', display:'inline-block', flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight:700, color:'var(--lp-teal)', textTransform:'uppercase', letterSpacing:'.08em' }}>ATS Scanner — from invisible to interview-ready</span>
        </div>
        <button onClick={replay} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', color:'var(--lp-text2)', fontSize:11, cursor:'pointer', fontFamily:'var(--lp-ff)' }}>↺ Replay</button>
      </div>

      <div style={{ background:'rgba(13,20,40,.7)', border:'1px solid rgba(236,72,153,.2)', borderRadius:16, overflow:'hidden', padding:24, backdropFilter:'blur(20px)', boxShadow:'0 0 60px rgba(236,72,153,.08),0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--lp-text)', letterSpacing:'-.3px', marginBottom:6 }}>Watch the ATS system scan your resume and how AI fixes it</div>
          <div style={{ fontSize:12, color:'var(--lp-text3)' }}>Before → Scanning → After · auto-plays on load</div>
        </div>

        <div className="atb-demo-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1.15fr 1fr', gap:14, alignItems:'start', marginBottom:20 }}>

          {/* Card 1: Before */}
          <div style={{ background:C.glass, border:'1px solid rgba(255,77,106,.22)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', background:'rgba(255,77,106,.05)', borderBottom:`1px solid ${C.bdr}` }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#FF4D6A', boxShadow:'0 0 8px rgba(255,77,106,.8)', flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:700, color:C.text2, flex:1 }}>Original Resume</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(255,77,106,.1)', color:'#FF4D6A', border:'1px solid rgba(255,77,106,.2)' }}>Before</span>
            </div>
            <div style={{ padding:14 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--lp-text)', marginBottom:2 }}>Minh Tran</div>
              <div style={{ fontSize:9, color:C.text3, marginBottom:8 }}>minh@email.com · Singapore · +65 9123 4567</div>
              <div style={{ fontSize:8, fontWeight:700, color:'#4A5A7A', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Experience</div>
              <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,.08)', marginBottom:4 }} />
              <div style={{ height:6, borderRadius:3, background:'rgba(255,77,106,.22)', borderLeft:'2px solid #FF4D6A', marginBottom:4, width:'90%' }} />
              <div style={{ fontSize:9, color:'#FF4D6A', fontStyle:'italic', padding:'4px 6px', background:'rgba(255,77,106,.06)', borderRadius:4, marginBottom:4, lineHeight:1.4 }}>"Helped drive product roadmap, worked with teams on deliverables…"</div>
              <div style={{ height:6, borderRadius:3, background:'rgba(255,77,106,.18)', borderLeft:'2px solid #FF4D6A', marginBottom:4, width:'85%' }} />
              <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,.08)', marginBottom:4, width:'70%' }} />
              <div style={{ fontSize:8, fontWeight:700, color:'#4A5A7A', textTransform:'uppercase', letterSpacing:'.08em', marginTop:6, marginBottom:4 }}>Skills</div>
              <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,.08)', marginBottom:4 }} />
              <div style={{ height:6, borderRadius:3, background:'rgba(255,210,51,.12)', borderLeft:'2px solid rgba(255,210,51,.5)', marginBottom:4, width:'80%' }} />
              <div style={{ marginTop:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, background:'rgba(255,77,106,.1)', border:'1px solid rgba(255,77,106,.25)' }}>
                  <span style={{ fontSize:18, fontWeight:800, color:'#FF4D6A', fontFamily:'var(--lp-ffm)', lineHeight:1 }}>38</span>
                  <span style={{ fontSize:9, color:'#FF4D6A', fontWeight:600 }}>ATS score</span>
                </div>
                <div style={{ fontSize:9, color:'#FF4D6A', textAlign:'right', lineHeight:1.5 }}>Filtered before<br />recruiter sees it</div>
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:8 }}>
                {['Missing: OKR','Missing: SQL','Vague bullets','No metrics'].map(t => (
                  <span key={t} style={{ fontSize:8, fontWeight:600, padding:'2px 6px', borderRadius:4, background:'rgba(255,77,106,.08)', color:'#FF4D6A', border:'1px solid rgba(255,77,106,.18)' }}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Scanning / ATS Engine */}
          <div style={{ background:C.glass, border:`1.5px solid ${phase==='scanning'?'rgba(236,72,153,.35)':badgeColor==='#F59E0B'?'rgba(245,158,11,.35)':'rgba(0,229,160,.35)'}`, borderRadius:12, overflow:'hidden', boxShadow:`0 0 40px ${phase==='scanning'?'rgba(236,72,153,.12)':'rgba(245,158,11,.08)'}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', background:'rgba(236,72,153,.06)', borderBottom:`1px solid rgba(236,72,153,.1)` }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:phase==='done'?'#00E5A0':badgeColor, flexShrink:0, boxShadow:`0 0 8px ${badgeColor}80`, animation:phase==='scanning'?'lp-pulse 2s infinite':'' }} />
              <span style={{ fontSize:11, fontWeight:700, color:C.text2, flex:1 }}>{cardTitle}</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5, background:`${badgeColor}18`, color:badgeColor, border:`1px solid ${badgeColor}40` }}>
                {phase==='pre'||phase==='scanning'?'Running':phase==='fixmode'?'Fix mode':'Done'}
              </span>
            </div>
            <div style={{ padding:14 }}>
              {phase === 'scanning' || phase === 'pre' ? (
                <div>
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ height:6, borderRadius:3, background:lineColor(i), borderLeft:lineBdr(i), marginBottom:4, width:i===1?'88%':i===2?'95%':i===3?'80%':i===4?'92%':'100%', overflow:'hidden', position:'relative' }}>
                      {lineStates[i]===1 && <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,transparent,rgba(236,72,153,.5),transparent)', animation:'lp-sweepLine 1s ease-in-out infinite' }} />}
                    </div>
                  ))}
                  <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,.06)', overflow:'hidden', marginBottom:4 }}>
                    <div style={{ height:4, borderRadius:2, background:'linear-gradient(90deg,#EC4899,#F59E0B)', width:`${scanPct}%`, transition:'width .35s ease' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'#4A5A7A', marginBottom:10 }}>
                    <span>Scanning progress</span><span style={{ color:'#EC4899', fontWeight:700, fontFamily:'monospace' }}>{scanPct}%</span>
                  </div>
                  <div style={{ textAlign:'center', padding:10, background:'rgba(236,72,153,.05)', borderRadius:8, border:'1px solid rgba(236,72,153,.12)' }}>
                    <div style={{ fontSize:32, fontWeight:800, color:'#EC4899', fontFamily:'var(--lp-ffm)', letterSpacing:'-1.5px', lineHeight:1 }}>{scanPct>0?scanScore+'%':'—'}</div>
                    <div style={{ fontSize:9, color:C.text3, marginTop:3 }}>ATS score building…</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:10 }}>
                    {stepLabels.map((lbl,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:stepsLit[i]?'#00E5A0':C.text3, transition:'color .3s' }}>
                        <span style={{ width:14, height:14, borderRadius:'50%', border:`1.5px solid currentColor`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, flexShrink:0, fontFamily:'monospace' }}>{i+1}</span>
                        {lbl}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:C.text3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>ATS engine — 6 checks</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {ATS_ENGINES.map((e,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderRadius:7, border:`1px solid ${fixApplied[i]?'rgba(0,229,160,.28)':C.bdr}`, background:fixApplied[i]?'rgba(0,229,160,.07)':'rgba(255,255,255,.02)', transition:'all .4s' }}>
                        <span style={{ width:12, height:12, borderRadius:'50%', border:`1.5px solid ${fixApplied[i]?'#00E5A0':'rgba(255,255,255,.2)'}`, flexShrink:0, display:'inline-block', background:fixApplied[i]?'#00E5A0':'transparent', transition:'all .3s' }} />
                        <span style={{ flex:1, fontSize:11, color:C.text2 }}>{e.label}</span>
                        <span style={{ fontSize:10, color:fixApplied[i]?'#00E5A0':'#FF4D6A', whiteSpace:'nowrap' }}>{fixApplied[i]?`${e.after} +${e.pts}pts`:e.before}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:10 }}>
                    <button onClick={applyFix} disabled={phase==='done'} style={{ flex:1, padding:'7px 10px', borderRadius:8, background:'linear-gradient(135deg,#EC4899,#F59E0B)', color:'#fff', fontSize:11, fontWeight:700, border:'none', cursor:phase==='done'?'default':'pointer', fontFamily:'var(--lp-ff)', opacity:phase==='done'?.4:1, transition:'opacity .2s' }}>
                      {phase==='done'?'All fixes applied ✓':`⚡ Apply fix ${fixStep+1} of ${ATS_ENGINES.length} →`}
                    </button>
                    <button onClick={replay} style={{ padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,.05)', color:C.text2, fontSize:11, fontWeight:600, border:`1px solid ${C.bdr}`, cursor:'pointer', fontFamily:'var(--lp-ff)' }}>↺</button>
                  </div>
                  {insight && <div style={{ marginTop:9, fontSize:10, color:C.text2, lineHeight:1.6, padding:'8px 10px', background:'rgba(236,72,153,.04)', borderLeft:'2px solid #EC4899', borderRadius:'0 6px 6px 0', transition:'opacity .3s' }}>{insight}</div>}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: After */}
          <div style={{ background:C.glass, border:'1px solid rgba(0,229,160,.25)', borderRadius:12, overflow:'hidden', opacity:afterVisible?1:.35, transition:'opacity .6s', boxShadow:'0 0 24px rgba(0,229,160,.08)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', background:'rgba(0,229,160,.05)', borderBottom:`1px solid ${C.bdr}` }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#00E5A0', boxShadow:'0 0 8px rgba(0,229,160,.9)', flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:700, color:C.text2, flex:1 }}>After CareerAiHub</span>
              <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5, background:'rgba(0,229,160,.1)', color:'#00E5A0', border:'1px solid rgba(0,229,160,.25)' }}>Result</span>
            </div>
            <div style={{ padding:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:56, height:56, borderRadius:'50%', border:'2px solid #00E5A0', background:'rgba(0,229,160,.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 0 20px rgba(0,229,160,.25)', flexDirection:'column' }}>
                  <span style={{ fontSize:16, fontWeight:800, color:'#00E5A0', fontFamily:'var(--lp-ffm)', lineHeight:1 }}>{afterScore<40?'—':afterScore+'%'}</span>
                  <span style={{ fontSize:7, color:'#00E5A0', opacity:.7 }}>ATS score</span>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--lp-text)', lineHeight:1.3 }}>{afterTitle}</div>
                  <div style={{ fontSize:10, color:C.text3, lineHeight:1.4, marginTop:2 }}>{afterSub}</div>
                </div>
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:10, background:'rgba(0,229,160,.1)', border:'1px solid rgba(0,229,160,.25)', fontSize:10, fontWeight:700, color:'#00E5A0', marginBottom:8, opacity:showDelta?1:0, transition:'opacity .5s' }}>↑ +53 points · from 38% to 91%</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:8 }}>
                {dimLabels.map((lbl,i) => (
                  <div key={i} style={{ padding:'6px 8px', borderRadius:6, background:'rgba(255,255,255,.03)', border:`1px solid ${C.bdr}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                      <div style={{ fontSize:8, color:C.text3, fontWeight:600 }}>{lbl}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:dimColors[i], fontFamily:'var(--lp-ffm)' }}>{dimVals[dimKeys[i]]}</div>
                    </div>
                    <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,.06)' }}>
                      <div style={{ height:3, borderRadius:2, background:dimColors[i], width:`${dimBars[barKeys[i]]}%`, transition:'width 1s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:8, opacity:showKw?1:0, transition:'opacity .5s' }}>
                {['product strategy','OKR framework','roadmap','SQL'].map(k => <span key={k} style={{ fontSize:8, fontWeight:600, padding:'2px 6px', borderRadius:4, background:'rgba(0,229,160,.1)', color:'#00E5A0', border:'1px solid rgba(0,229,160,.2)' }}>{k}</span>)}
                <span style={{ fontSize:8, fontWeight:600, padding:'2px 6px', borderRadius:4, background:'rgba(255,77,106,.09)', color:'#FF4D6A', border:'1px solid rgba(255,77,106,.18)' }}>go-to-market</span>
              </div>
              {showNote && <div style={{ fontSize:10, color:C.text2, lineHeight:1.6, padding:'8px 10px', background:'rgba(236,72,153,.04)', borderLeft:'2px solid #EC4899', borderRadius:'0 6px 6px 0', opacity:showNote?1:0, transition:'opacity .5s' }}><strong style={{ color:'#EC4899' }}>AI:</strong> 4 keywords added, 3 bullets quantified.</div>}
              {finalBanner && <div style={{ marginTop:8, padding:'8px 10px', borderRadius:8, background:'rgba(0,229,160,.07)', border:'1px solid rgba(0,229,160,.28)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#00E5A0' }}>Interview-ready — all 6 fixes applied</div>
              </div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PARAM_LABELS = {
  keywords:        'Keywords',
  impactMetrics:   'Impact & Metrics',
  formatting:      'Formatting',
  missingSections: 'Sections',
  summaryHeadline: 'Summary/Headline',
};

const SCAN_STEPS = [
  'Reading resume structure…',
  'Analysing ATS compatibility…',
  'Identifying keyword gaps…',
  'Checking impact & metrics…',
  'Scoring formatting & sections…',
  'Building improvement cards…',
];

// ── AI prompts ─────────────────────────────────────────────────────────────────
const TEXT_EXTRACT_PROMPT = 'Extract all text from this resume. Return ONLY the plain text — no JSON, no commentary, no formatting markers. Preserve section headings and bullet points on separate lines.';

const SCAN_PROMPT = `You are an expert ATS resume analyst. Analyse the resume below.
Return ONLY raw JSON (no markdown, no code blocks, start immediately with {):
{"atsScore":0,"parameters":{"keywords":0,"impactMetrics":0,"formatting":0,"missingSections":0,"summaryHeadline":0},"gaps":[{"id":"g1","severity":"critical","category":"keywords","title":"Short gap title","description":"2-3 sentences — what is wrong and why it hurts ATS","section":"Resume section this applies to","aiSuggestion":"Specific actionable fix with example text"}]}
Rules: atsScore 0-100; parameter values 0-100; severity one of critical|high|medium|low; category one of keywords|impact_metrics|formatting|missing_sections|summary_headline; generate 6-10 gaps sorted critical first; be hyper-specific to this exact resume.
Score calibration: most real resumes score 25–65. A well-written resume with good keyword match scores 65–80. An excellent resume tailored to the JD with quantified impact, all keywords, clean formatting, and a strong summary scores 80–95. A near-perfect match scores 95–100. Do NOT artificially cap at 85 — if the resume genuinely deserves 90+, give it.

RESUME:
`;


// ── Helpers ────────────────────────────────────────────────────────────────────
function base64ToBlobUrl(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

function stepTimer(setScanStep) {
  let idx = 0;
  const t = setInterval(() => {
    idx = Math.min(idx + 1, SCAN_STEPS.length - 1);
    setScanStep(SCAN_STEPS[idx]);
  }, 1400);
  return t;
}

// ── Upload Phase ───────────────────────────────────────────────────────────────
function UploadPhase({ onFile, hasScanResume, onUseScanResume, error, onClearError, targetRole, onTargetRoleChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const roleReady = targetRole.trim().length > 0;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && roleReady) onFile(file);
  };

  return (
    <div className="atb-upload-wrap">
      {error && (
        <div className="atb-error" style={{ marginBottom: 16, borderRadius: 8, border: '1px solid rgba(255,95,110,.25)' }}>
          ⚠ {error}
          <button onClick={onClearError} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff5f6e', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}
      <div className="atb-ey">ATS Builder</div>
      <h1 className="atb-upload-h">Build a resume that beats ATS.</h1>
      <p className="atb-upload-p">Upload your resume. AI scans for gaps — you pick what to fix, it rebuilds and shows exactly what changed.</p>

      {/* Target role input */}
      <div style={{ marginBottom: 16, width: '100%', maxWidth: 480 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--lp-text3)', textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--lp-ffm)', marginBottom: 6 }}>
          What role are you targeting? <span style={{ color: '#FF5A5A' }}>*</span>
        </label>
        <input
          type="text"
          value={targetRole}
          onChange={e => onTargetRoleChange(e.target.value)}
          placeholder="e.g. Senior Product Manager, Software Engineer"
          style={{ width: '100%', background: 'var(--lp-bg2)', border: `1px solid ${roleReady ? 'rgba(236,72,153,.3)' : 'var(--lp-bdr)'}`, borderRadius: 8, padding: '9px 12px', color: 'var(--lp-text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
        />
        {!roleReady && <div style={{ fontSize: 10.5, color: 'var(--lp-text3)', marginTop: 5, fontFamily: 'var(--lp-ffm)' }}>Required — AI calibrates keyword matching to your target role.</div>}
      </div>

      <div
        className={`atb-upload-zone${dragOver ? ' drag-over' : ''}${!roleReady ? ' disabled' : ''}`}
        style={{ opacity: roleReady ? 1 : 0.5, cursor: roleReady ? 'pointer' : 'not-allowed' }}
        onDragOver={(e) => { e.preventDefault(); if (roleReady) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => roleReady && inputRef.current?.click()}
      >
        <div className="atb-upload-icon">📄</div>
        <div className="atb-upload-title">{roleReady ? 'Drop your resume here' : 'Enter your target role first'}</div>
        <div className="atb-upload-sub">PDF or DOCX · Click to browse</div>
        <button
          className="atb-upload-btn"
          disabled={!roleReady}
          onClick={e => { e.stopPropagation(); if (roleReady) inputRef.current?.click(); }}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />
      </div>

      {hasScanResume && (
        <div className="atb-from-scan">
          <div className="atb-from-scan-label">Already scanned a resume?</div>
          <button className="atb-from-scan-btn" onClick={onUseScanResume}>
            ↗ Use resume from last scan
          </button>
        </div>
      )}

      <AtsScannerDemo />
    </div>
  );
}

// ── Loading Phase (scan + build) ───────────────────────────────────────────────
const LOAD_VARIANTS = {
  teal:   { bar: '#EC4899' },
  violet: { bar: '#F59E0B' },
};

function LoadingPhase({ label, step, variant = 'teal' }) {
  const v = LOAD_VARIANTS[variant] || LOAD_VARIANTS.teal;
  return (
    <div className="atb-loading">
      <OrbitSpinner size={72} />
      <div className="atb-scan-label">{label}</div>
      <div className="atb-scan-step">{step}</div>
      <div className="atb-scan-bar-wrap">
        <div className="atb-scan-bar" style={{ background: v.bar }} />
      </div>
    </div>
  );
}

// ── Gap Card (Gaps Identified column) ─────────────────────────────────────────
function GapCard({ card, onDragStart, onMove }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`atb-card${open ? ' atb-card-open' : ''}`}
      data-sev={card.severity}
      draggable
      onDragStart={() => onDragStart(card, 'gaps')}
      onClick={() => setOpen(o => !o)}
    >
      <div className="atb-card-top">
        <span className={`atb-sev atb-sev-${card.severity}`}>{card.severity}</span>
        <span className="atb-cat">{CATEGORIES[card.category] || card.category}</span>
        <span className="atb-card-chevron">{open ? '▲' : '▼'}</span>
      </div>
      <div className="atb-card-title">{card.title}</div>
      {open && (
        <>
          <div className="atb-card-desc">{card.description}</div>
          <div className="atb-card-section">📍 {card.section}</div>
          <div className="atb-card-actions" onClick={e => e.stopPropagation()}>
            <button className="atb-cbtn primary" onClick={() => onMove(card, 'gaps', 'edit')}>
              Edit this →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Auto-grow textarea — expands to content, never scrolls
function AutoTextarea({ className, value, onChange, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
    />
  );
}

// ── Edit Card (Edit Queue column) ─────────────────────────────────────────────
function EditCard({ card, onDragStart, onMove, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

  const generateSuggestion = async () => {
    if (genLoading) return;
    setGenLoading(true);
    try {
      const prompt = `You are an expert resume writer. Provide a specific, actionable ATS improvement for this gap.
Gap: ${card.title}
Section: ${card.section}
Description: ${card.description}
${card.userNotes ? `User intent: ${card.userNotes}` : ''}
Return ONLY the suggestion — 2-3 sentences of concrete improved content with an example.`;
      const text = await callLLM([{ role: 'user', content: prompt }], 600);
      onUpdate(card.id, { aiSuggestion: text.trim() });
    } catch { /* ignore */ }
    finally { setGenLoading(false); }
  };

  return (
    <div
      className={`atb-card${open ? ' atb-card-open' : ''}`}
      data-sev={card.severity}
      draggable
      onDragStart={() => onDragStart(card, 'edit')}
      onClick={() => setOpen(o => !o)}
    >
      <div className="atb-card-top">
        <span className={`atb-sev atb-sev-${card.severity}`}>{card.severity}</span>
        <span className="atb-cat">{CATEGORIES[card.category] || card.category}</span>
        <span className="atb-card-chevron">{open ? '▲' : '▼'}</span>
      </div>
      <div className="atb-card-title">{card.title}</div>
      {open && (
        <div onClick={e => e.stopPropagation()}>
          <div className="atb-card-section">📍 {card.section}</div>
          <div className="atb-ai-block">
            <div className="atb-ai-lbl">
              ✦ AI Suggestion
              {genLoading && <span style={{ opacity: .6, fontWeight: 400 }}>generating…</span>}
            </div>
            <AutoTextarea
              className="atb-ai-textarea"
              value={card.aiSuggestion}
              onChange={e => onUpdate(card.id, { aiSuggestion: e.target.value })}
              placeholder="AI suggested fix will appear here…"
            />
            {!card.aiSuggestion?.trim() && (
              <button
                className="atb-cbtn"
                style={{ marginTop: 6, fontSize: 10 }}
                onClick={generateSuggestion}
                disabled={genLoading}
              >
                {genLoading ? 'Generating…' : '✦ Generate suggestion'}
              </button>
            )}
          </div>
          <div className="atb-notes-block">
            <label className="atb-notes-lbl">Your notes</label>
            <AutoTextarea
              className="atb-notes-ta"
              value={card.userNotes}
              onChange={e => onUpdate(card.id, { userNotes: e.target.value })}
              placeholder="e.g. Add the Q2 project where I cut deployment time by 40%"
            />
          </div>
          <div className="atb-card-actions">
            <button className="atb-cbtn" onClick={() => onMove(card, 'edit', 'gaps')}>← Back</button>
            <button className="atb-cbtn primary" onClick={() => onMove(card, 'edit', 'done')}>→ Mark done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Done Card (Done column) ────────────────────────────────────────────────────
function DoneCard({ card, onDragStart, onMove }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`atb-card atb-card-done${open ? ' atb-card-open' : ''}`}
      data-sev={card.severity}
      draggable
      onDragStart={() => onDragStart(card, 'done')}
      onClick={() => setOpen(o => !o)}
    >
      <div className="atb-card-top">
        <span className={`atb-sev atb-sev-${card.severity}`}>{card.severity}</span>
        <span className="atb-cat">{CATEGORIES[card.category] || card.category}</span>
        <span className="atb-done-check">✓</span>
        <span className="atb-card-chevron">{open ? '▲' : '▼'}</span>
      </div>
      <div className="atb-card-title">{card.title}</div>
      {open && (
        <div onClick={e => e.stopPropagation()}>
          <div className="atb-card-section">📍 {card.section}</div>
          {card.userNotes?.trim() && (
            <div className="atb-card-desc" style={{ marginTop: 6, borderLeft: '2px solid rgba(236,72,153,.35)', paddingLeft: 8 }}>
              {card.userNotes}
            </div>
          )}
          <div className="atb-card-actions">
            <button className="atb-cbtn" onClick={() => onMove(card, 'done', 'edit')}>← Back to edit</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ label, color, count, onDrop, children, headerRight }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`atb-col${dragOver ? ' drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(); }}
    >
      <div className="atb-col-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span className="atb-col-name" style={{ color }}>{label}</span>
          <span className="atb-col-count" style={{ background: `${color}18`, color, border: `1px solid ${color}38` }}>{count}</span>
        </div>
        {headerRight}
      </div>
      <div className="atb-col-body">
        {React.Children.count(children) === 0
          ? <div className="atb-col-empty">Drop cards here</div>
          : children
        }
      </div>
    </div>
  );
}

// ── Add Gap Modal ─────────────────────────────────────────────────────────────
function AddGapModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    title: '', section: '', category: 'keywords', severity: 'medium', userNotes: '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="atb-overlay" onClick={onClose}>
      <div className="atb-addgap-modal" onClick={e => e.stopPropagation()}>
        <div className="atb-addgap-title">Add a custom gap</div>

        <div className="atb-field">
          <label className="atb-field-lbl">Gap title</label>
          <input
            className="atb-field-inp"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Add leadership quantification to Experience section"
          />
        </div>

        <div className="atb-field">
          <label className="atb-field-lbl">Resume section</label>
          <input
            className="atb-field-inp"
            value={form.section}
            onChange={e => set('section', e.target.value)}
            placeholder="e.g. Work Experience, Skills, Summary"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="atb-field">
            <label className="atb-field-lbl">Category</label>
            <select className="atb-field-inp" value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="atb-field">
            <label className="atb-field-lbl">Severity</label>
            <select className="atb-field-inp" value={form.severity} onChange={e => set('severity', e.target.value)}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="atb-field">
          <label className="atb-field-lbl">Your intent (what to add / remove / rephrase)</label>
          <textarea
            className="atb-field-inp"
            style={{ minHeight: 58, resize: 'vertical' }}
            value={form.userNotes}
            onChange={e => set('userNotes', e.target.value)}
            placeholder="e.g. Remove the generic objective statement, replace with a targeted PM summary"
          />
        </div>

        <div className="atb-modal-btns">
          <button className="atb-cbtn" onClick={onClose}>Cancel</button>
          <button
            className="atb-cbtn primary"
            disabled={!form.title.trim()}
            onClick={() => {
              onAdd({ ...form, id: genId(), description: form.userNotes || form.title, aiSuggestion: '' });
              onClose();
            }}
          >
            Add gap
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Results View ───────────────────────────────────────────────────────────────
function ResultsView({ oldText, newText, newHtml, oldScore, newScore, oldParams, newParams, addedKeywords, pdfUrl, onEditMore, onRebuildFromThis }) {
  const diff      = computeLineDiff(oldText || '', newText || '');
  const removed   = diff.filter(d => d.type === 'removed');
  const added     = diff.filter(d => d.type === 'added');
  const scoreGain = newScore - oldScore;
  const scoreColor = newScore >= 70 ? '#00e5a0' : newScore >= 50 ? '#f5a623' : '#ff4d5e';

  const downloadDoc = () => {
    const blob = new Blob([newHtml || newText], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'resume-optimized.doc'; a.click();
    URL.revokeObjectURL(url);
  };

  const [pdfLoading, setPdfLoading] = React.useState(false);
  const downloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    let wrapper = null;
    try {
      const source = newHtml || `<pre style="font-family:sans-serif;padding:40px">${newText}</pre>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(source, 'text/html');
      const styleTag = doc.head.querySelector('style')?.outerHTML || '';
      wrapper = document.createElement('div');
      wrapper.innerHTML = styleTag + doc.body.innerHTML;
      wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:Calibri,Arial,sans-serif;';
      document.body.appendChild(wrapper);
      await html2pdf().set({
        margin: 0,
        filename: 'resume-optimized.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }).from(wrapper).save();
    } finally {
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      setPdfLoading(false);
    }
  };

  return (
    <div className="atb-results-wrap">

      {/* ── Top bar ── */}
      <div className="atb-res-bar">
        <div className="atb-res-bar-left">
          <span className="atb-res-eyebrow">ATS Builder</span>
          <span className="atb-res-divider">·</span>
          <span className="atb-res-headline">Resume optimised</span>
        </div>
        <div className="atb-res-score-hero">
          <span className="atb-rsh-old">{oldScore}</span>
          <span className="atb-rsh-track">
            <span className="atb-rsh-fill" style={{ width: `${oldScore}%` }} />
            <span className="atb-rsh-gain" style={{ width: `${Math.max(0, scoreGain)}%`, left: `${oldScore}%`, background: scoreColor }} />
          </span>
          <span className="atb-rsh-new" style={{ color: scoreColor }}>{newScore}</span>
          <span className="atb-rsh-delta" style={{ background: scoreGain >= 0 ? 'rgba(0,229,160,.14)' : 'rgba(255,77,94,.14)', color: scoreGain >= 0 ? '#00e5a0' : '#ff4d5e' }}>
            {scoreGain >= 0 ? '+' : ''}{scoreGain}
          </span>
        </div>
        <div className="atb-res-actions">
          <button className="atb-dl-btn" onClick={downloadDoc}>↓ DOCX</button>
          <button className="atb-dl-btn" onClick={downloadPdf} disabled={pdfLoading}>{pdfLoading ? 'Generating…' : '↓ PDF'}</button>
          <button className="atb-back-btn" onClick={onEditMore}>↺ Edit more</button>
          <button className="atb-rebuild-btn" onClick={onRebuildFromThis}>Rebuild from this ↗</button>
        </div>
      </div>

      {/* ── Document panels ── */}
      <div className="atb-doc-row">

        {/* Before */}
        <div className="atb-doc-panel">
          <div className="atb-doc-toolbar atb-doc-toolbar-before">
            <span className="atb-panel-badge before">BEFORE</span>
            <span className="atb-doc-tb-label">Original resume</span>
            <span className="atb-doc-tb-score">Score <strong>{oldScore}</strong></span>
          </div>
          <div className="atb-doc-viewer">
            {pdfUrl
              ? <iframe src={pdfUrl} title="Original resume" className="atb-doc-iframe" />
              : <div className="atb-doc-page atb-doc-page-muted">{oldText}</div>
            }
          </div>
        </div>

        <div className="atb-doc-split" />

        {/* After */}
        <div className="atb-doc-panel">
          <div className="atb-doc-toolbar atb-doc-toolbar-after">
            <span className="atb-panel-badge after">AFTER</span>
            <span className="atb-doc-tb-label">Optimised resume</span>
            <span className="atb-doc-tb-score" style={{ color: scoreColor }}>
              Score <strong>{newScore}</strong>
              {scoreGain > 0 && <span className="atb-doc-tb-gain">+{scoreGain}</span>}
            </span>
          </div>
          <div className="atb-doc-viewer">
            {newHtml
              ? <iframe srcDoc={newHtml} title="Optimised resume" className="atb-doc-iframe" style={{ background: '#fff' }} />
              : <div className="atb-doc-page">{newText}</div>
            }
          </div>
        </div>

      </div>

      {/* ── Metrics row ── */}
      <div className="atb-metrics-row">
        {Object.entries(PARAM_LABELS).map(([k, label]) => {
          const ov = oldParams?.[k] ?? 0;
          const nv = newParams?.[k] ?? 0;
          const gain = nv - ov;
          return (
            <div key={k} className="atb-metric-chip">
              <div className="atb-metric-label">{label}</div>
              <div className="atb-metric-track">
                <div className="atb-metric-old" style={{ width: `${ov}%` }} />
                <div className="atb-metric-gain" style={{ width: `${Math.max(0, gain)}%`, left: `${ov}%` }} />
              </div>
              <div className="atb-metric-nums">
                <span className="atb-metric-ov">{ov}</span>
                <span className="atb-metric-arr">→</span>
                <span className="atb-metric-nv" style={{ color: nv > ov ? '#00e5a0' : nv < ov ? '#ff4d5e' : 'var(--atb-text3)' }}>{nv}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Diff + keywords ── */}
      <div className="atb-diff-section">

        {addedKeywords?.length > 0 && (
          <div className="atb-kw-wrap">
            <div className="atb-diff-section-title">Keywords Added</div>
            <div className="atb-kw-tags">
              {addedKeywords.map((kw, i) => <span key={i} className="atb-kw-tag">+ {kw}</span>)}
            </div>
          </div>
        )}

        {(removed.length > 0 || added.length > 0) && (
          <div>
            <div className="atb-diff-header">
              <span className="atb-diff-section-title" style={{ margin: 0 }}>Line changes</span>
              <span className="atb-diff-counts">
                <span className="atb-diff-count rem">−{removed.length}</span>
                <span className="atb-diff-count add">+{added.length}</span>
              </span>
            </div>
            <div className="atb-diff-columns">
              <div className="atb-diff-col">
                <div className="atb-diff-col-hd rem">Removed</div>
                <div className="atb-diff-col-body">
                  {removed.length === 0
                    ? <div className="atb-diff-empty">Nothing removed</div>
                    : removed.map((row, i) => (
                        <div key={i} className="atb-diff-line rem">
                          <span className="atb-diff-idx">{i + 1}</span>
                          <span className="atb-diff-line-text">{row.text}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
              <div className="atb-diff-col">
                <div className="atb-diff-col-hd add">Added</div>
                <div className="atb-diff-col-body">
                  {added.length === 0
                    ? <div className="atb-diff-empty">Nothing added</div>
                    : added.map((row, i) => (
                        <div key={i} className="atb-diff-line add">
                          <span className="atb-diff-idx">{i + 1}</span>
                          <span className="atb-diff-line-text">{row.text}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Resume Builder Tab Bar ────────────────────────────────────────────────────
const RB_TABS = [
  { id: 'parse',   label: 'Upload & Parse'  },
  { id: 'builder', label: 'Builder'         },
  { id: 'history', label: 'Version History' },
];

function ResumeBuilderTabBar({ active, onTab }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 24px', borderBottom: '1px solid var(--lp-bdr)',
      background: 'var(--lp-bg3)', overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      {RB_TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          style={{
            padding: '12px 16px', fontSize: 13, fontWeight: active === t.id ? 700 : 500,
            color: active === t.id ? 'var(--lp-teal)' : 'var(--lp-text3)',
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${active === t.id ? 'var(--lp-teal)' : 'transparent'}`,
            cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--lp-ff)',
            transition: 'all .15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Upload & Parse Tab ────────────────────────────────────────────────────────
function UploadAndParseTab({ user, memory, resumeText: globalResumeText, initialProfile, onResumeExtracted, onPdfUploaded, onProfileParsed, onGoToBuilder, setActiveModule }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [rawText, setRawText]   = useState(globalResumeText || '');
  const [fileInfo, setFileInfo] = useState(
    globalResumeText ? { name: 'resume (from memory)', words: globalResumeText.trim().split(/\s+/).length } : null
  );
  const [profile, setProfile]   = useState(initialProfile || null);
  const [error, setError]       = useState('');
  const [localSkills, setLocalSkills] = useState(initialProfile?.skills?.filter(s => s.trim()) || []);
  const [skillInputVal, setSkillInputVal] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  // New, additive only: a rule-based score computed alongside the existing AI one (profile.atsScore),
  // never replacing it. Covers all three ways rawText changes here (loaded from memory, a file upload,
  // or the paste textarea) in one place, instead of a separate call at each site. Pure/synchronous (no
  // AI, no network — src/scoring/'s own tests enforce that), so no loading state is needed for it.
  const [detResult, setDetResult] = useState(null);

  useEffect(() => {
    if (profile?.skills) setLocalSkills(profile.skills.filter(s => s.trim()));
  }, [profile]);

  useEffect(() => {
    setDetResult(rawText && rawText.trim() ? computeDeterministicScore(rawText) : null);
  }, [rawText]);

  const parseResume = async (text) => {
    setLoading(true); setProfile(null); setError('');
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Parse this resume and extract all structured data for a resume builder.
Resume text:
${text.slice(0, 5000)}

Return ONLY raw JSON (no markdown, start with {):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "linkedin handle or URL",
  "location": "city / region",
  "targetRole": "most recent or target role title",
  "experience": "X years",
  "topSkills": ["skill1","skill2","skill3"],
  "market": "city / region",
  "atsScore": 0,
  "summary": "professional summary paragraph if present, else empty string",
  "workExperience": [{"title":"job title","company":"company name","period":"date range","duration":"X years","bullets":["bullet point 1","bullet point 2"]}],
  "education": [{"degree":"degree name","institution":"school","year":"graduation year","gpa":"if present"}],
  "skills": ["skill1","skill2","skill3","skill4","skill5","skill6","skill7","skill8"],
  "awards": ["award 1","award 2"],
  "extras": [{"heading":"Section Name as written in resume","items":["item 1","item 2"]}],
  "scoreBreakdown": [
    {"dimension":"Impact Metrics","score":0},
    {"dimension":"Bullet Quality","score":0},
    {"dimension":"Keywords","score":0},
    {"dimension":"Structure","score":0},
    {"dimension":"Career Signals","score":0}
  ],
  "issues": [
    {"severity":"critical","title":"4-6 word specific title","description":"2-3 sentences: what is wrong and why it hurts.","before":"exact weak text quoted from resume","after":"improved version with specifics","builderStep":2,"module":null}
  ]
}
For extras: include every section not already captured above (e.g. Certifications, Publications, Projects, Volunteer, Languages, Interests, Patents, etc.). Do NOT put work experience, education, skills, awards, or summary into extras.

scoreBreakdown: Score each dimension 0-100. These five scores should aggregate to the overall atsScore.
- Impact Metrics: quantified achievements with numbers, %, $, timeframes in bullets
- Bullet Quality: action verb openers, specificity, outcome-focus (not vague openers like "worked on")
- Keywords: domain keyword density relevant to the target role
- Structure: section completeness, standard headers, appropriate length, no ATS-breaking formatting
- Career Signals: clear progression, healthy tenure, no unexplained gaps

issues: List 3-6 specific, actionable problems found in THIS resume. Rules:
- severity: "critical" (score <50), "high" (50-69), "medium" (70-79) — based on the dimension score driving this issue
- title: 4-6 words, hyper-specific (NOT "Improve bullet quality" — instead "No metrics in any bullet")
- description: 2-3 sentences. Name the exact problem and why it hurts ATS or recruiter screening.
- before: quote exact weak text from the resume (keep short, max 12 words)
- after: rewritten version showing the fix for that specific text
- builderStep: 1=Contact, 2=Experience, 3=Education, 4=Skills, 5=Summary — the builder step where this is fixed; null if not fixable in builder
- module: "scan" if this issue requires comparing against a JD (keyword gaps); null otherwise
Only include issues that are genuinely present. Do not fabricate problems.

Compute atsScore as an honest general resume quality score (0-100) based solely on the resume content. Evaluate every criterion below and weight them in aggregate:

CONTENT QUALITY
- Impact metrics: quantified achievements with numbers, %, $, timeframes. Vague bullets ("responsible for managing") with no proof penalise heavily.
- Bullet quality: action verbs at start, specific, outcome-focused. Generic openers ("worked on", "helped with") lower score.
- Buzzword overuse: "synergy", "passionate", "results-driven", "dynamic", "thought leader" with no evidence behind them = penalty.

CAREER SIGNALS
- Career continuity: unexplained employment gaps of 6+ months penalise score. Gaps with context ("career break", "freelance", "study leave", "relocation") are acceptable and should not penalise.
- Job title progression: clear upward trajectory (Junior → Senior → Lead) improves score. Flat or downward moves without context lower it.
- Tenure per role: multiple roles under 12 months signals job-hopping and lowers score. One short stint is acceptable; a pattern is not.

STRUCTURE & COMPLETENESS
- Section completeness: summary/headline, experience, education, skills all present. Missing any major section penalises.
- Resume length: too long (4+ pages for <10 years experience) or too short (half a page for a senior candidate) both penalise.
- Date format consistency: mixing formats (Jan 2020 vs 2020-01 vs 01/2020) across roles penalises.

PROFESSIONAL PRESENTATION
- Contact completeness: missing LinkedIn, location, or phone when they are standard for the target role penalises.
- Email professionalism: unprofessional email addresses (coolhacker99@, nicknames, old ISP domains) penalise mildly.
- Keyword density: role-relevant terms present without stuffing. Completely absent domain keywords lower score.
- Formatting & readability: clear section headings, consistent structure, no walls of text, no tables/columns that break ATS parsing.

Score calibration: most real resumes score 35–60. A well-structured resume with some quantified bullets and no gaps scores 60–75. Strong metrics, complete sections, compelling summary, clear progression, no red flags = 75–88. Near-perfect resume = 88–95. Do NOT output 67 as a default — compute the real score from the criteria above.` }], 4000);
      const parsed = extractJSON(raw);
      if (!parsed.error) {
        setProfile(parsed);
        if (onProfileParsed) onProfileParsed(parsed);
      } else {
        setError('Could not parse resume — try a different file.');
      }
    } catch (err) {
      console.error('[parseResume]', err);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit'))
        setError('Too many requests — wait 30 seconds and try again.');
      else if (msg.includes('suspended') || msg.includes('permission denied') || msg.includes('403') || msg.includes('401') || msg.includes('api key'))
        setError('AI service unavailable — contact support.');
      else
        setError('Parse failed — try again or paste your resume text instead.');
    }
    setLoading(false);
  };

  const handleFile = async (file) => {
    setError(''); setFileInfo(null); setProfile(null);
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.docx')) {
        const ab = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
        text = value;
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const ab = await file.arrayBuffer();
        // Store base64 for memory persistence — also feeds Live Editor without re-upload
        const b64 = arrayBufferToBase64(ab);
        if (onPdfUploaded) onPdfUploaded(b64);
        text = await extractTextFromPdfFile(file);
      } else {
        const ab = await file.arrayBuffer();
        text = new TextDecoder().decode(ab);
      }
      if (!text.trim()) { setError('Could not extract text — try a DOCX or paste your resume.'); return; }
      const words = text.trim().split(/\s+/).length;
      setFileInfo({ name: file.name, words });
      setRawText(text);
      if (onResumeExtracted) onResumeExtracted(text);
      await parseResume(text);
    } catch (err) {
      setError('Could not read file — try a DOCX or paste your resume below.');
    }
  };

  const atsColor = profile?.atsScore
    ? profile.atsScore >= 80 ? '#00E5A0' : profile.atsScore >= 60 ? '#FFB84D' : '#FF5A5A'
    : 'var(--lp-text3)';

  return (
    <div className="atb-parse-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: 500 }}>
      {/* Left */}
      <div className="atb-parse-left-pane" style={{ borderRight: '1px solid var(--lp-bdr)', padding: 24, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
          Import Resume
        </div>

        {/* Drop zone — success state when file loaded, upload prompt otherwise */}
        <div
          style={{
            border: `2px dashed ${fileInfo ? '#00E5A0' : dragOver ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
            borderRadius: 10, padding: '24px 20px', textAlign: 'center',
            cursor: fileInfo ? 'default' : 'pointer', transition: 'all .15s',
            background: fileInfo ? 'rgba(0,229,160,.05)' : dragOver ? 'rgba(236,72,153,.04)' : 'transparent',
          }}
          onDragOver={e => { if (!fileInfo) { e.preventDefault(); setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => { if (!fileInfo) inputRef.current?.click(); }}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />

          {fileInfo ? (
            <>
              <div style={{ color: '#00E5A0', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                ✓ {fileInfo.name}
              </div>
              <div style={{ color: 'var(--lp-text3)', fontSize: 11 }}>
                {fileInfo.words.toLocaleString()} words · extracted
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFileInfo(null); setRawText(''); setProfile(null); inputRef.current?.click(); }}
                style={{ marginTop: 8, background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'var(--lp-text3)', fontSize: 10, padding: '3px 10px', cursor: 'pointer' }}
              >
                Replace file
              </button>
            </>
          ) : (
            <>
              <div style={{ color: 'var(--lp-text2)', fontSize: 13, marginBottom: 6 }}>
                Drop your PDF or{' '}
                <span style={{ color: 'var(--lp-teal)', fontWeight: 700 }}>browse files</span>
              </div>
              <div style={{ color: 'var(--lp-text3)', fontSize: 11 }}>PDF · DOCX · TXT accepted</div>
            </>
          )}
        </div>

        {/* Paste textarea — only shown when no file loaded */}
        {!fileInfo ? (
          <>
            <div style={{ textAlign: 'center', color: 'var(--lp-text3)', fontSize: 12 }}>or paste resume text</div>
            <textarea
              value={rawText}
              onChange={e => { setRawText(e.target.value); setProfile(null); setError(''); }}
              placeholder="Paste your resume text here..."
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 120, resize: 'vertical',
                background: 'rgba(236,72,153,0.03)', border: '1px solid var(--lp-bdr)',
                borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
                fontSize: 13, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(236,72,153,0.4)'}
              onBlur={e => e.target.style.borderColor = 'var(--lp-bdr)'}
            />
          </>
        ) : null}

        <button
          onClick={() => { if (rawText.trim()) { if (onResumeExtracted) onResumeExtracted(rawText); parseResume(rawText); } }}
          disabled={loading || !rawText.trim()}
          style={{
            width: '100%', padding: '12px 0',
            background: loading || !rawText.trim() ? 'var(--lp-bdr)' : 'var(--lp-teal)',
            color: loading || !rawText.trim() ? 'var(--lp-text3)' : '#000',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800,
            cursor: loading || !rawText.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Parsing…' : profile ? 'Re-parse →' : 'Parse and build profile →'}
        </button>

        {error && (
          <div style={{ color: '#FF5A5A', fontSize: 12, padding: '8px 12px', background: 'rgba(255,90,90,.08)', borderRadius: 8, border: '1px solid rgba(255,90,90,.2)' }}>
            {error}
          </div>
        )}

        {/* Profile Extracted table */}
        {profile && (
          <div style={{ background: 'var(--lp-bg2)', borderRadius: 10, border: '1px solid var(--lp-bdr)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
              Profile Extracted
            </div>
            {[
              { k: 'Target role',  v: profile.targetRole  },
              { k: 'Experience',   v: profile.experience  },
              { k: 'Market',       v: profile.market      },
              { k: 'ATS score',    v: profile.atsScore ? `${profile.atsScore}/100` : '—', color: atsColor },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
                <span style={{ color: 'var(--lp-text3)', fontSize: 12 }}>{row.k}</span>
                <span style={{ color: row.color || 'var(--lp-text)', fontSize: 12, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{row.v || '—'}</span>
              </div>
            ))}
            {/* Top skills as pills */}
            {(profile.topSkills || []).length > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
                <div style={{ fontSize: 12, color: 'var(--lp-text3)', marginBottom: 8 }}>Top skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(profile.topSkills || []).map((s, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: 'rgba(0,229,160,.10)', color: '#00E5A0',
                      border: '1px solid rgba(0,229,160,.25)',
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}
            {/* ATS score contextual CTA */}
            {profile.atsScore && setActiveModule && (
              <div style={{ padding: '10px 14px', fontSize: 11.5, color: 'var(--lp-text3)', lineHeight: 1.6 }}>
                {profile.atsScore < 80
                  ? <>Score below 80 — <button onClick={() => setActiveModule('scan')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lp-teal)', fontSize: 11.5, cursor: 'pointer', fontWeight: 700 }}>scan vs a JD in Resume Scanner →</button></>
                  : <>Strong resume — <button onClick={() => setActiveModule('scan')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--lp-teal)', fontSize: 11.5, cursor: 'pointer', fontWeight: 700 }}>scan vs a target JD to optimise keywords →</button></>
                }
              </div>
            )}
          </div>
        )}

        {/* Deterministic score — new (Gate 2 integration), additive only: shown alongside the AI profile
            above, never replacing it. Computed from the same rawText, independent of whether the AI parse
            above succeeded (so it still shows something if that call fails or is slow), and 0/100 vs
            "not assessed" are visibly different, never collapsed into the same "—". */}
        {detResult && (
          <div style={{ background: 'var(--lp-bg2)', borderRadius: 10, border: '1px solid var(--lp-bdr)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
              Deterministic score (new, rule-based — separate from the AI score above)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
              <span style={{ color: 'var(--lp-text3)', fontSize: 12 }}>Overall</span>
              <span style={{ color: detResult.score.score === null ? 'var(--lp-text3)' : 'var(--lp-text)', fontSize: 12, fontWeight: 600 }}>
                {detResult.score.score === null ? 'Not assessed — document could not be read' : `${detResult.score.score}/100`}
              </span>
            </div>
            {detResult.score.parts.map(p => (
              <div key={p.id} style={{ padding: '8px 14px', borderBottom: '1px solid var(--lp-bdr2, rgba(255,255,255,.03))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--lp-text3)', fontSize: 11.5 }}>{p.id.replace(/_/g, ' ')}</span>
                  <span style={{ color: p.score === null ? 'var(--lp-text3)' : 'var(--lp-text)', fontSize: 11.5, fontWeight: 600 }}>{p.score === null ? 'unknown' : `${p.score}/100`}</span>
                </div>
                <div style={{ color: 'var(--lp-text3)', fontSize: 10.5, marginTop: 2 }}>{p.evidence[0]}</div>
              </div>
            ))}
          </div>
        )}

        {/* Verify extracted content accordion */}
        {profile && (
          <div style={{ border: '1px solid var(--lp-bdr)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setVerifyOpen(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--lp-bg2)', border: 'none', cursor: 'pointer', color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              <span>Verify extracted content</span>
              <span style={{ fontSize: 9 }}>{verifyOpen ? '▲' : '▼'}</span>
            </button>
            {verifyOpen && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--lp-bg3)' }}>
                {profile.workExperience?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Work Experience ({profile.workExperience.length})
                    </div>
                    {profile.workExperience.slice(0, 3).map((w, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: i < Math.min(profile.workExperience.length, 3) - 1 ? '1px solid var(--lp-bdr2)' : 'none' }}>
                        <div style={{ color: 'var(--lp-text)', fontSize: 12, fontWeight: 700 }}>{w.title} · {w.company}</div>
                        <div style={{ color: 'var(--lp-text3)', fontSize: 10, marginTop: 2 }}>{w.period}{w.duration ? ` · ${w.duration}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
                {profile.education?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Education</div>
                    {profile.education.slice(0, 2).map((e, i) => (
                      <div key={i} style={{ color: 'var(--lp-text)', fontSize: 12, fontWeight: 700 }}>{e.degree} · {e.institution}</div>
                    ))}
                  </div>
                )}
                {profile.skills?.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--lp-text3)' }}>{profile.skills.length} skills extracted</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right — Diagnostic Report */}
      <div className="atb-parse-preview-pane" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Empty state */}
        {!loading && !profile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--lp-text3)', gap: 8, opacity: .5 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <div style={{ fontSize: 12 }}>Upload a resume to see your diagnostic report</div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--lp-text3)', fontSize: 13 }}>
            <OrbitSpinner size={40} />
            Analysing resume…
          </div>
        )}

        {!loading && profile && (() => {
          const score = profile.atsScore || 0;
          const scoreColor = score >= 80 ? '#00E5A0' : score >= 60 ? '#FFB84D' : '#FF5A5A';
          const scoreLabel = score >= 80 ? 'Strong Resume' : score >= 60 ? 'Needs Improvement' : 'Needs Major Work';
          const circumference = 2 * Math.PI * 28;
          const goToBuilder = () => { if (onProfileParsed) onProfileParsed({ ...profile, skills: localSkills }); if (onGoToBuilder) onGoToBuilder(); };

          return (
            <>
              {/* Section 1 — Score Hero */}
              <div className="atb-score-hero" style={{ background: 'var(--lp-bg2)', borderRadius: 12, border: '1px solid var(--lp-bdr)', padding: '20px 20px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', marginBottom: 18 }}>
                  ATS Score
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                  <svg className="atb-score-ring" width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
                    <circle cx="36" cy="36" r="28" fill="none" stroke="var(--lp-bdr2, rgba(255,255,255,.13))" strokeWidth="6"/>
                    <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor} strokeWidth="6"
                      strokeDasharray={`${circumference * score / 100} ${circumference}`}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                      style={{ transition: 'stroke-dasharray .6s ease' }}
                    />
                  </svg>
                  <div>
                    <div className="atb-score-number" style={{ fontSize: 42, fontWeight: 900, color: scoreColor, lineHeight: 1, letterSpacing: '-2px' }}>{score}</div>
                    <div style={{ fontSize: 11, color: 'var(--lp-text3)', marginTop: 2 }}>out of 100</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor, marginTop: 6 }}>{scoreLabel}</div>
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--lp-bdr)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 2, transition: 'width .6s ease' }} />
                </div>
              </div>

              {/* Section 2 — Score Breakdown */}
              {profile.scoreBreakdown?.length > 0 && (
                <div style={{ background: 'var(--lp-bg2)', borderRadius: 12, border: '1px solid var(--lp-bdr)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--lp-bdr)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)' }}>
                    Score Breakdown
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {profile.scoreBreakdown.map(dim => {
                      const c = dim.score >= 80 ? '#00E5A0' : dim.score >= 60 ? '#FFB84D' : '#FF5A5A';
                      return (
                        <div key={dim.dimension} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="atb-dim-label" style={{ fontSize: 11.5, color: 'var(--lp-text2)', width: 118, flexShrink: 0 }}>{dim.dimension}</span>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--lp-bdr)' }}>
                            <div style={{ height: '100%', width: `${dim.score}%`, background: c, borderRadius: 2, transition: 'width .5s ease' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: c, width: 26, textAlign: 'right', flexShrink: 0 }}>{dim.score}</span>
                          <span style={{ fontSize: 11, width: 14, flexShrink: 0, color: dim.score >= 80 ? '#00E5A0' : '#FFB84D' }}>
                            {dim.score >= 80 ? '✓' : '⚠'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 3 — Issues */}
              {profile.issues?.length > 0 && (
                <div className="atb-issues-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--lp-text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Issues to Fix
                    <span style={{ background: 'rgba(255,90,90,.12)', color: '#FF5A5A', border: '1px solid rgba(255,90,90,.25)', borderRadius: 10, padding: '1px 8px', fontSize: 10, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                      {profile.issues.length} found
                    </span>
                  </div>
                  {profile.issues.map((issue, i) => {
                    const sev = issue.severity === 'critical'
                      ? { color: '#FF5A5A', label: 'CRITICAL' }
                      : issue.severity === 'high'
                      ? { color: '#FFB84D', label: 'HIGH' }
                      : { color: '#8B9CC8', label: 'MEDIUM' };
                    return (
                      <div key={i} className="atb-issue-card" style={{ background: 'var(--lp-bg2)', borderRadius: 10, border: '1px solid var(--lp-bdr)', borderLeft: `3px solid ${sev.color}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-text)', lineHeight: 1.3 }}>{issue.title}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: `${sev.color}18`, color: sev.color, border: `1px solid ${sev.color}30`, letterSpacing: .5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {sev.label}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--lp-text2)', lineHeight: 1.65 }}>{issue.description}</p>
                        {(issue.before || issue.after) && (
                          <div className="atb-before-after" style={{ background: 'var(--lp-bg3)', borderRadius: 7, padding: '9px 12px', fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--lp-bdr)' }}>
                            {issue.before && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: '#FF5A5A', fontWeight: 700, flexShrink: 0 }}>Before</span>
                                <span style={{ color: 'var(--lp-text2)' }}>{issue.before}</span>
                              </div>
                            )}
                            {issue.after && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ color: '#00E5A0', fontWeight: 700, flexShrink: 0 }}>After  </span>
                                <span style={{ color: 'var(--lp-text)' }}>{issue.after}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {issue.builderStep != null
                          ? <button onClick={goToBuilder} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--lp-teal)', color: 'var(--lp-teal)', borderRadius: 7, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Fix in Builder →
                            </button>
                          : issue.module === 'scan' && setActiveModule
                          ? <button onClick={() => setActiveModule('scan')} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text2)', borderRadius: 7, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              Scan vs JD →
                            </button>
                          : null
                        }
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom CTA */}
              {onGoToBuilder && (
                <button onClick={goToBuilder} style={{ width: '100%', padding: '14px 0', background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 4 }}>
                  Fix These Issues in Builder →
                </button>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── AI Bullet Rewrite Tab (kept for potential future use) ─────────────────────
function BulletRewriteTab({ resumeText: sharedResume, targetRole: sharedRole }) {
  const [bullets, setBullets]   = useState('');
  const [context, setContext]   = useState(sharedRole || '');
  const [loading, setLoading]   = useState(false);
  const [rewrites, setRewrites] = useState([]);

  const resumeCtx = sharedResume ? digestResume(sharedResume, 3000).text : null;

  const rewrite = async () => {
    if (!bullets.trim()) return;
    setLoading(true); setRewrites([]);
    try {
      const raw = await callLLM([{ role: 'user', content:
        `Rewrite these resume bullets to be stronger, more quantified, and ATS-optimised.
Context/role: ${context || 'general'}${resumeCtx ? `\nResume context:\n${resumeCtx}` : ''}
Bullets:
${bullets}

Return ONLY raw JSON array (no markdown, start with [):
[{"before":"original bullet","after":"rewritten bullet with numbers and strong verbs"}]
Rewrite every bullet. Never use placeholders.` }], 4000);
      const parsed = extractJSON(raw);
      if (Array.isArray(parsed)) setRewrites(parsed);
    } catch { /* silent */ }
    setLoading(false);
  };

  const inp = {
    width: '100%', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)',
    borderRadius: 8, color: 'var(--lp-text)', padding: '10px 12px',
    fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <div style={{ color: 'var(--lp-text)', fontWeight: 700, fontSize: 15 }}>AI Bullet Rewrite</div>
      <div style={{ color: 'var(--lp-text3)', fontSize: 12 }}>
        Paste weak bullets — AI rewrites them with numbers, strong action verbs, and ATS keywords.
      </div>

      {sharedResume && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,229,160,.06)', border: '1px solid rgba(0,229,160,.2)', borderRadius: 8 }}>
          <span style={{ color: '#00E5A0', fontSize: 13 }}>✓</span>
          <span style={{ color: 'var(--lp-text2)', fontSize: 12 }}>Resume loaded from Upload & Parse — AI will use it as context for rewrites.</span>
        </div>
      )}

      <div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Target role / context</div>
        <input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. Senior Product Manager" style={{ ...inp, resize: 'none', minHeight: 'auto' }} />
      </div>

      <div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Your bullets (one per line)</div>
        <textarea value={bullets} onChange={e => setBullets(e.target.value)}
          placeholder={"Helped drive product roadmap\nWorked with teams on deliverables\nAssisted with customer research"}
          style={{ ...inp, minHeight: 120 }} />
      </div>

      <button onClick={rewrite} disabled={loading || !bullets.trim()}
        style={{
          padding: '12px 24px', background: loading ? 'var(--lp-bdr)' : 'var(--lp-teal)',
          color: loading ? 'var(--lp-text3)' : '#000', border: 'none', borderRadius: 8,
          fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', width: 'fit-content',
        }}>
        {loading ? 'Rewriting…' : 'Rewrite with AI →'}
      </button>

      {rewrites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rewrites.map((r, i) => (
            <div key={i} style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', color: 'var(--lp-text3)', fontSize: 12, fontStyle: 'italic' }}>
                {r.before}
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--lp-teal)', fontSize: 16 }}>→</span>
                <span style={{ color: 'var(--lp-text)', fontSize: 13, fontWeight: 600, flex: 1 }}>{r.after}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Version History Tab ───────────────────────────────────────────────────────
function VersionHistoryTab({ memory, onRestore }) {
  const versions = memory?.resumeVersions || [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ color: 'var(--lp-text)', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Version History</div>
      <div style={{ color: 'var(--lp-text3)', fontSize: 12, marginBottom: 20 }}>Saved resume snapshots. Restore any version back into the Builder.</div>

      {versions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--lp-text3)', fontSize: 13, opacity: .6 }}>
          No versions saved yet. Build your resume in the Builder tab and save a version.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...versions].reverse().map((v, i) => (
            <div key={i} style={{
              background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)',
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--lp-text)', fontSize: 13, fontWeight: 600 }}>{v.label || `Version ${versions.length - i}`}</div>
                <div style={{ color: 'var(--lp-text3)', fontSize: 11, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{v.date ? new Date(v.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                  {v.templateLabel && <span>· {v.templateLabel}</span>}
                  {v.data?.contact?.name && <span>· {v.data.contact.name}</span>}
                </div>
              </div>
              <button
                onClick={() => onRestore && onRestore(v)}
                style={{
                  background: 'transparent', border: '1px solid var(--lp-bdr)',
                  color: 'var(--lp-text2)', borderRadius: 6, padding: '5px 14px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Restore →</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Builder Tab ───────────────────────────────────────────────────────────────
const BUILDER_STEPS = ['Contact', 'Experience', 'Education', 'Skills', 'Summary', 'Review'];

// Sample resume shown in template carousel before user uploads their own
const SAMPLE_DATA = {
  contact: { name: 'Alex Chen', email: 'alex.chen@email.com', phone: '+1 (415) 555-0192', linkedin: 'linkedin.com/in/alexchen', location: 'San Francisco, CA' },
  summary: 'Product Manager with 6 years driving 0→1 launches in fintech and SaaS. Shipped features that grew DAU 40% and added $2.4M ARR. Strong in data-driven roadmaps, stakeholder alignment, and cross-functional execution.',
  experience: [
    { id: 0, company: 'Stripe', title: 'Senior Product Manager', period: '2022 – Present', bullets: ['Led 0→1 launch of Stripe Capital, acquiring 12,000 SMBs in first 6 months', 'Defined 3 OKR cycles delivering $2.4M incremental ARR', 'Reduced onboarding drop-off 38% via targeted checkout experiments'] },
    { id: 1, company: 'Intercom', title: 'Product Manager', period: '2019 – 2022', bullets: ['Owned messaging inbox — 2M+ DAU across 25,000 customers', 'Shipped AI reply suggestions, cutting avg handle time 22%', 'Ran 40+ A/B tests improving trial-to-paid conversion by 18%'] },
    { id: 2, company: 'Deloitte', title: 'Business Analyst', period: '2018 – 2019', bullets: ['Delivered digital transformation roadmap for Fortune 500 retail client', 'Built Tableau dashboards tracking $180M supply chain KPIs'] },
  ],
  education: [{ id: 0, institution: 'UC Berkeley', degree: 'B.S. Business Administration', year: '2018' }],
  skills: ['Product Strategy', 'OKR Frameworks', 'SQL', 'Figma', 'A/B Testing', 'Stakeholder Management', 'Agile / Scrum', 'Mixpanel'],
  awards: ['Product Hunt #1 — Stripe Capital', 'Intercom Innovation Award 2021'],
  extras: [{ heading: 'Certifications', items: ['AWS Certified Cloud Practitioner', 'Google Analytics Certified'] }],
};

function mapProfileToData(profile) {
  if (!profile) return JSON.parse(JSON.stringify(SAMPLE_DATA));
  return {
    contact: {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      linkedin: profile.linkedin || '',
      location: profile.location || profile.market || '',
    },
    summary: profile.summary || '',
    experience: (profile.workExperience?.length
      ? profile.workExperience
      : [{ id: 0, company: '', title: '', period: '', bullets: [''] }]
    ).map((w, i) => ({
      id: i,
      company: w.company || '',
      title: w.title || '',
      period: w.period || '',
      bullets: w.bullets?.length ? w.bullets : [''],
    })),
    education: (profile.education?.length
      ? profile.education
      : [{ id: 0, institution: '', degree: '', year: '' }]
    ).map((e, i) => ({
      id: i,
      institution: e.institution || '',
      degree: e.degree || '',
      year: e.year || '',
    })),
    skills: profile.skills?.filter(s => s).length ? profile.skills : [''],
    awards: profile.awards || [],
    extras: (profile.extras || [])
      .map(s => ({ heading: s.heading || '', items: (s.items || []).filter(i => i?.trim()) }))
      .filter(s => s.heading && s.items.length),
  };
}

const BUILDER_DRAFT_KEY = 'careerai_builder_draft';

function BuilderTab({ initialProfile, memory, onSaveVersion, restoredData, setActiveModule }) {
  const [step, setStep] = useState(0);
  const [activeTemplate, setActiveTemplate] = useState('modern');
  const [skillInput, setSkillInput] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef(null);
  const [data, setData] = useState(() => {
    if (restoredData) return restoredData;
    try {
      const saved = localStorage.getItem(BUILDER_DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return mapProfileToData(initialProfile);
  });
  const [isSample, setIsSample] = useState(!initialProfile && !restoredData && !localStorage.getItem(BUILDER_DRAFT_KEY));
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const previewRef = useRef(null);

  // Autosave draft to localStorage on every change (skip sample placeholder data)
  useEffect(() => {
    if (isSample) return;
    try { localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(data)); } catch {}
  }, [data, isSample]);

  // Sync restored data when user clicks Restore in history — only fires when non-null
  useEffect(() => {
    if (!restoredData) return;
    setData(JSON.parse(JSON.stringify(restoredData)));
    setIsSample(false);
    setSaved(false);
    setStep(0);
  }, [restoredData]);

  // Scale live preview to fit the panel width without horizontal overflow
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const available = e.contentRect.width - 32;
      setPreviewScale(available < 794 ? available / 794 : 1);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const inp = {
    width: '100%', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)',
    color: 'var(--lp-text)', borderRadius: 8, padding: '8px 12px', fontSize: 13,
    fontFamily: 'var(--lp-ff)', outline: 'none', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 10.5, color: 'var(--lp-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block' };
  const field = { display: 'flex', flexDirection: 'column', gap: 4 };

  const edit = (fn) => { setIsSample(false); setData(fn); };

  // Contact
  const setContact = (k, v) => edit(d => ({ ...d, contact: { ...d.contact, [k]: v } }));

  // Experience
  const setExpField = (i, k, v) => edit(d => {
    const exp = [...d.experience]; exp[i] = { ...exp[i], [k]: v }; return { ...d, experience: exp };
  });
  const setExpBullets = (i, text) => setExpField(i, 'bullets', text.split('\n'));
  const addExp = () => edit(d => ({ ...d, experience: [...d.experience, { id: Date.now(), company: '', title: '', period: '', bullets: [''] }] }));
  const removeExp = i => edit(d => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  // Education
  const setEduField = (i, k, v) => edit(d => {
    const edu = [...d.education]; edu[i] = { ...edu[i], [k]: v }; return { ...d, education: edu };
  });
  const addEdu = () => edit(d => ({ ...d, education: [...d.education, { id: Date.now(), institution: '', degree: '', year: '' }] }));
  const removeEdu = i => edit(d => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  // Skills / Summary
  const setSkills = text => edit(d => ({ ...d, skills: text.split('\n') }));
  const setSummary = v => edit(d => ({ ...d, summary: v }));

  const handleDownloadPdf = async () => {
    if (!previewRef.current || !ActiveTemplate) return;
    if (!previewRef.current.textContent?.trim()) return;
    setDownloading(true);
    const el = previewRef.current;
    const savedTransform = el.style.transform;
    const savedTransformOrigin = el.style.transformOrigin;
    el.style.transform = '';
    el.style.transformOrigin = '';
    const name = (data.contact.name || 'resume').replace(/\s+/g, '_');
    const tplLabel = TEMPLATES.find(t => t.id === activeTemplate)?.label || activeTemplate;
    try {
      await html2pdf()
        .set({
          margin: 0,
          filename: `${name}_${tplLabel}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(el)
        .save();
    } finally {
      el.style.transform = savedTransform;
      el.style.transformOrigin = savedTransformOrigin;
      setDownloading(false);
    }
  };

  const handleSave = () => {
    const tpl = TEMPLATES.find(t => t.id === activeTemplate);
    const autoLabel = `Version ${(memory?.resumeVersions?.length || 0) + 1}`;
    const version = {
      date: new Date().toISOString(),
      template: activeTemplate,
      templateLabel: tpl?.label || activeTemplate,
      label: versionLabel.trim() || autoLabel,
      data: JSON.parse(JSON.stringify(data)),
    };
    onSaveVersion(version);
    setVersionLabel('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const ActiveTemplate = TEMPLATES.find(t => t.id === activeTemplate)?.component;

  const navBtn = (label, onClick, primary) => (
    <button onClick={onClick} style={{
      padding: '9px 20px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
      border: primary ? 'none' : '1px solid var(--lp-bdr)',
      background: primary ? 'var(--lp-teal)' : 'transparent',
      color: primary ? '#000' : 'var(--lp-text2)',
    }}>{label}</button>
  );

  const sectionBox = (content) => (
    <div style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: 16 }}>
      {content}
    </div>
  );

  return (
    <div className="atb-builder-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 640 }}>

      {/* ── LEFT: step form ── */}
      <div style={{ borderRight: '1px solid var(--lp-bdr)', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Sample data banner */}
        {isSample && (
          <div style={{ background: 'rgba(236,72,153,.08)', border: '1px solid rgba(236,72,153,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 11.5, color: 'var(--lp-teal)', lineHeight: 1.5 }}>
            👆 Sample resume shown — go to <strong>Upload & Parse</strong> tab to load yours
          </div>
        )}

        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {BUILDER_STEPS.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{
              flex: 1, height: 3, borderRadius: 2, cursor: 'pointer',
              background: i <= step ? 'var(--lp-teal)' : 'var(--lp-bdr)', transition: 'background .2s',
            }} />
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          Step {step + 1} of {BUILDER_STEPS.length}
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 20 }}>
          {BUILDER_STEPS[step]}
        </div>

        {/* ── Contact ── */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div style={field}><label style={lbl}>Full Name</label><input style={inp} value={data.contact.name} onChange={e => setContact('name', e.target.value)} placeholder="Aman Ashwin" /></div>
            <div style={field}><label style={lbl}>Email</label><input style={inp} value={data.contact.email} onChange={e => setContact('email', e.target.value)} placeholder="you@email.com" /></div>
            <div style={field}><label style={lbl}>Phone</label><input style={inp} value={data.contact.phone} onChange={e => setContact('phone', e.target.value)} placeholder="+1 234 567 8900" /></div>
            <div style={field}><label style={lbl}>LinkedIn</label><input style={inp} value={data.contact.linkedin} onChange={e => setContact('linkedin', e.target.value)} placeholder="linkedin.com/in/yourname" /></div>
            <div style={field}><label style={lbl}>Location</label><input style={inp} value={data.contact.location} onChange={e => setContact('location', e.target.value)} placeholder="City, Country" /></div>
          </div>
        )}

        {/* ── Experience ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.experience.map((job, i) => (
              <div key={job.id ?? i}>
                {sectionBox(<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text2)' }}>Role {i + 1}</span>
                    {data.experience.length > 1 && <button onClick={() => removeExp(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', cursor: 'pointer', fontSize: 11 }}>✕ Remove</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={field}><label style={lbl}>Company</label><input style={inp} value={job.company} onChange={e => setExpField(i, 'company', e.target.value)} placeholder="Company Name" /></div>
                      <div style={field}><label style={lbl}>Period</label><input style={inp} value={job.period} onChange={e => setExpField(i, 'period', e.target.value)} placeholder="2020 – Present" /></div>
                    </div>
                    <div style={field}><label style={lbl}>Job Title</label><input style={inp} value={job.title} onChange={e => setExpField(i, 'title', e.target.value)} placeholder="Senior Engineer" /></div>
                    <div style={field}>
                      <label style={lbl}>Bullet Points (one per line)</label>
                      <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }}
                        value={(job.bullets || ['']).join('\n')}
                        onChange={e => setExpBullets(i, e.target.value)}
                        placeholder={'Led a team of 5 to deliver X\nImproved performance by 30%'} />
                    </div>
                  </div>
                </>)}
              </div>
            ))}
            <button onClick={addExp} style={{ background: 'transparent', border: '1px dashed var(--lp-bdr)', color: 'var(--lp-teal)', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Role</button>
          </div>
        )}

        {/* ── Education ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.education.map((edu, i) => (
              <div key={edu.id ?? i}>
                {sectionBox(<>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text2)' }}>Education {i + 1}</span>
                    {data.education.length > 1 && <button onClick={() => removeEdu(i)} style={{ background: 'none', border: 'none', color: 'var(--lp-text3)', cursor: 'pointer', fontSize: 11 }}>✕ Remove</button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={field}><label style={lbl}>Institution</label><input style={inp} value={edu.institution} onChange={e => setEduField(i, 'institution', e.target.value)} placeholder="University Name" /></div>
                    <div style={field}><label style={lbl}>Degree</label><input style={inp} value={edu.degree} onChange={e => setEduField(i, 'degree', e.target.value)} placeholder="B.Tech Computer Science" /></div>
                    <div style={field}><label style={lbl}>Year</label><input style={inp} value={edu.year} onChange={e => setEduField(i, 'year', e.target.value)} placeholder="2020" /></div>
                  </div>
                </>)}
              </div>
            ))}
            <button onClick={addEdu} style={{ background: 'transparent', border: '1px dashed var(--lp-bdr)', color: 'var(--lp-teal)', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Add Education</button>
          </div>
        )}

        {/* ── Skills ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Skill pills */}
            {data.skills.filter(s => s.trim()).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 8, alignContent: 'flex-start' }}>
                {data.skills.filter(s => s.trim()).map((skill, i) => (
                  <span key={skill + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(236,72,153,.1)', border: '1px solid rgba(236,72,153,.25)', color: 'var(--lp-teal)', borderRadius: 5, padding: '3px 8px 3px 10px', fontSize: 12, fontWeight: 600, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                    {skill}
                    <button
                      type="button"
                      onClick={() => edit(d => { const filled = d.skills.filter(s => s.trim()); filled.splice(i, 1); return { ...d, skills: filled }; })}
                      style={{ background: 'none', border: 'none', color: 'rgba(236,72,153,.6)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1, fontFamily: 'inherit', minHeight: 'unset' }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            {/* Add skill row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="skill-inp"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = skillInput.trim();
                    if (val) { edit(d => ({ ...d, skills: [...d.skills.filter(s => s.trim()), val] })); setSkillInput(''); }
                  }
                }}
                placeholder="e.g. Python"
                style={{ ...inp, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => { const val = skillInput.trim(); if (val) { edit(d => ({ ...d, skills: [...d.skills.filter(s => s.trim()), val] })); setSkillInput(''); document.getElementById('skill-inp')?.focus(); } }}
                style={{ padding: '8px 18px', background: 'var(--lp-teal)', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >Add</button>
            </div>
          </div>
        )}

        {/* ── Summary ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>2-3 sentences: years of experience, key skills, what you bring.</div>
            <textarea style={{ ...inp, minHeight: 120, resize: 'vertical' }}
              value={data.summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Data scientist with 7 years of experience in ML applied to real world problems…" />
          </div>
        )}

        {/* ── Review ── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>Pick a template from the right panel, then save your version.</div>
            {sectionBox(<>
              <div style={{ fontSize: 10.5, color: 'var(--lp-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Resume Summary</div>
              <div style={{ fontSize: 12.5, color: 'var(--lp-text)', lineHeight: 2 }}>
                <div>👤 {data.contact.name || '—'}</div>
                <div>💼 {data.experience.filter(j => j.company).length} role{data.experience.filter(j => j.company).length !== 1 ? 's' : ''}</div>
                <div>🎓 {data.education.filter(e => e.institution).length} education entr{data.education.filter(e => e.institution).length !== 1 ? 'ies' : 'y'}</div>
                <div>🛠 {data.skills.filter(s => s.trim()).length} skills</div>
                <div>📄 Template: {TEMPLATES.find(t => t.id === activeTemplate)?.label}</div>
              </div>
            </>)}
            <input
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder={`Version ${(memory?.resumeVersions?.length || 0) + 1} — add a label (optional)`}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', fontSize: 12, borderRadius: 8,
                border: '1px solid var(--lp-bdr)', background: 'var(--lp-bg3)',
                color: 'var(--lp-text)', outline: 'none', fontFamily: 'var(--lp-ff)',
              }}
            />
            <button onClick={handleSave} style={{
              width: '100%', padding: '14px 0', fontSize: 14, fontWeight: 800, borderRadius: 10, cursor: 'pointer', border: 'none',
              background: saved ? '#00E5A0' : 'var(--lp-teal)', color: '#000', transition: 'background .2s',
            }}>
              {saved ? '✓ Saved to history!' : 'Save Version'}
            </button>
            <button onClick={handleDownloadPdf} disabled={downloading} style={{
              width: '100%', padding: '12px 0', fontSize: 13, fontWeight: 800, borderRadius: 10, cursor: downloading ? 'not-allowed' : 'pointer',
              border: '1px solid var(--lp-bdr)', background: 'transparent', color: 'var(--lp-teal)', transition: 'all .2s',
            }}>
              {downloading ? 'Generating PDF…' : '⬇ Download PDF'}
            </button>
            {setActiveModule && (
              <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--lp-bg3)', borderRadius: 10, border: '1px solid var(--lp-bdr)' }}>
                <div style={{ fontSize: 10, color: 'var(--lp-text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>What's next?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Scan vs JD', module: 'scan' },
                    { label: 'Cover Letter', module: 'cover' },
                    { label: 'Browse Jobs', module: 'jobs' },
                  ].map(({ label, module }) => (
                    <button key={module} onClick={() => setActiveModule(module)} style={{
                      flex: 1, minWidth: 90, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--lp-bdr)', background: 'transparent', color: 'var(--lp-text2)', transition: 'all .15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lp-teal)'; e.currentTarget.style.color = 'var(--lp-teal)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lp-bdr)'; e.currentTarget.style.color = 'var(--lp-text2)'; }}
                    >{label} →</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 10, borderTop: '1px solid var(--lp-bdr)', marginTop: 16 }}>
          {step > 0 ? navBtn('← Back', () => setStep(s => s - 1), false) : <div />}
          {step < BUILDER_STEPS.length - 1 && navBtn('Next →', () => setStep(s => s + 1), true)}
        </div>
      </div>

      {/* ── RIGHT: template carousel + live preview ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Carousel */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--lp-bdr)', overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--lp-bg3)', flexShrink: 0 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => setActiveTemplate(t.id)} style={{
              padding: '5px 13px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'all .15s', borderLeft: `3px solid ${t.accent}`,
              background: activeTemplate === t.id ? 'var(--lp-teal)' : 'transparent',
              color: activeTemplate === t.id ? '#000' : 'var(--lp-text2)',
              border: `1px solid ${activeTemplate === t.id ? 'var(--lp-teal)' : 'var(--lp-bdr)'}`,
              borderLeftColor: t.accent, borderLeftWidth: 3,
            }}>
              {activeTemplate === t.id ? '✓ ' : ''}{t.label}
            </button>
          ))}
        </div>

        {/* Download button */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--lp-bdr)', background: 'var(--lp-bg3)', flexShrink: 0 }}>
          <button onClick={handleDownloadPdf} disabled={downloading} style={{
            width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 800, borderRadius: 7, cursor: downloading ? 'not-allowed' : 'pointer',
            border: 'none', background: downloading ? 'var(--lp-bg2)' : 'var(--lp-teal)', color: '#000', transition: 'background .2s',
          }}>
            {downloading ? 'Generating PDF…' : '⬇ Download PDF'}
          </button>
        </div>

        {/* Live preview — A4 width (794px = 210mm @ 96dpi) */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#e0e0e0', padding: '16px' }}>
          <div style={{ fontSize: 9, color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }}>
            Live Preview · A4
          </div>
          {/* Clip wrapper prevents horizontal layout overflow when scaled */}
          <div style={{ width: previewScale < 1 ? Math.round(794 * previewScale) : 794, overflow: 'hidden', margin: '0 auto' }}>
            <div ref={previewRef} style={{
              width: 794,
              transform: `scale(${previewScale})`,
              transformOrigin: 'top left',
              boxShadow: '0 4px 24px rgba(0,0,0,.2)',
            }}>
              {ActiveTemplate && <ActiveTemplate {...data} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ATSBuilder ────────────────────────────────────────────────────────────
const ATSBuilder = ({ user, memory, updateMemory, onProTrigger, form, setActiveModule, resumeText: globalResumeRaw, setResumeText: setGlobalResumeText }) => {
  const globalResume = resumeContent(globalResumeRaw); // Resume Scan stores an object here, not a string
  const hasSavedResume = !!memory?.scanPdfBase64;
  const [mainTab, setMainTab] = useState('parse');
  const [entryMode, setEntryMode] = useState(null); // null=choose, 'scratch', 'existing'
  const [phase, setPhase] = useState(hasSavedResume ? 'scanning' : 'upload'); // upload | scanning | kanban | building | results
  const [scanStep, setScanStep] = useState(SCAN_STEPS[0]);
  const [error, setError] = useState(null);
  const [targetRole, setTargetRole] = useState(form?.role || '');
  const [showNextStep, setShowNextStep] = useState(false);

  // Resume data
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [resumeText, setResumeTextState] = useState(globalResume || '');

  // Called by UploadAndParseTab — shares text + persists to Supabase + localStorage
  const handleResumeExtracted = (text) => {
    setResumeTextState(text);
    if (setGlobalResumeText) setGlobalResumeText(text);
    else if (updateMemory) updateMemory(m => ({ ...m, resumeText: text }));
  };

  // Called by UploadAndParseTab when PDF uploaded — store b64 so Live Editor + re-login can restore PDF without re-upload
  const handlePdfUploaded = (b64) => {
    setPdfBase64(b64);
    setPdfUrl(base64ToBlobUrl(b64));
    if (updateMemory) updateMemory(m => ({ ...m, scanPdfBase64: b64 }));
  };

  // Called by UploadAndParseTab when parse succeeds — persist profile so re-login shows cards without re-parsing
  const handleProfileParsed = (parsedProfile) => {
    if (updateMemory) updateMemory(m => ({ ...m, parseProfile: parsedProfile }));
  };

  // Scan scores
  const [atsScore, setAtsScore] = useState(null);
  const [prevScore, setPrevScore] = useState(null);
  const [parameters, setParameters] = useState(null);

  // Kanban columns
  const [gapCards, setGapCards] = useState([]);
  const [editCards, setEditCards] = useState([]);
  const [doneCards, setDoneCards] = useState([]);

  // Drag
  const dragRef = useRef(null); // { card, fromCol }

  // Modals
  const [showAddGap, setShowAddGap] = useState(false);

  // Build result
  const [buildResult, setBuildResult] = useState(null);

  // Builder tab state
  const [restoredData, setRestoredData] = useState(null);

  const handleSaveVersion = (version) => {
    if (updateMemory) {
      updateMemory(m => ({ ...m, resumeVersions: [...(m.resumeVersions || []), version] }));
    }
  };

  const handleRestore = (version) => {
    setRestoredData(version.data);
    setEntryMode('existing');
    setMainTab('builder');
  };

  // Sync globalResume into local state when memory loads after mount
  useEffect(() => {
    if (globalResume && !resumeText) setResumeTextState(globalResume);
  }, [globalResume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scan disabled — editor tab removed. ATS scan lives in future standalone module.

  // ── File upload ──────────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    setError(null);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      const ab = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      setPdfBase64(b64);
      await runScanPdf(b64, file);
    } else {
      setPdfUrl(null);
      setPdfBase64(null);
      const ab = await file.arrayBuffer();
      const { value: rawText } = await mammoth.extractRawText({ arrayBuffer: ab });
      await runScanText(rawText);
    }
  };

  const handleUseScanResume = () => {
    const b64 = memory?.scanPdfBase64;
    if (!b64) return;
    setError(null);
    setPdfBase64(b64);
    setPdfUrl(base64ToBlobUrl(b64));
    runScanPdf(b64);
  };

  // ── Scan ─────────────────────────────────────────────────────────────────────
  const runScanPdf = async (b64, fileRef) => {
    setPhase('scanning');
    setScanStep(SCAN_STEPS[0]);
    const t = stepTimer(setScanStep);
    try {
      // Step 1: extract plain text from PDF using pdfjs (no LLM cost)
      let extractedText = '';
      if (fileRef) {
        try { extractedText = await extractTextFromPdfFile(fileRef); } catch (_) { /* fallback below */ }
      }
      if (!extractedText.trim()) {
        extractedText = await callLLM([{ role: 'user', content: TEXT_EXTRACT_PROMPT }], 2000, b64);
      }
      setResumeTextState(extractedText.trim());
      if (updateMemory) updateMemory(m => ({ ...m, resumeText: extractedText.trim(), scanPdfBase64: b64 }));

      // Step 2: scan for ATS gaps using the extracted text
      const rolePrefix = targetRole.trim() ? `Target role: ${targetRole.trim()}\n\n` : '';
      const raw = await callLLM(
        [{ role: 'user', content: rolePrefix + SCAN_PROMPT + extractedText.trim() }],
        8000
      );
      processScanResult(raw);
    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.');
      setPhase('upload');
    } finally { clearInterval(t); }
  };

  const runScanText = async (text) => {
    setPhase('scanning');
    setScanStep(SCAN_STEPS[0]);
    setResumeTextState(text);
    if (updateMemory) updateMemory(m => ({ ...m, resumeText: text }));
    const t = stepTimer(setScanStep);
    try {
      const rolePrefix = targetRole.trim() ? `Target role: ${targetRole.trim()}\n\n` : '';
      const raw = await callLLM(
        [{ role: 'user', content: rolePrefix + SCAN_PROMPT + text }],
        8000
      );
      processScanResult(raw);
    } catch (err) {
      setError(err.message || 'Scan failed. Please try again.');
      setPhase('upload');
    } finally { clearInterval(t); }
  };

  const processScanResult = (raw) => {
    const parsed = extractJSON(raw);
    if (parsed.error) {
      setError('Could not parse scan results. Please try again.');
      setPhase('upload');
      if (updateMemory) {
        updateMemory(m => ({
          scanHistory: [{ score: 0, date: new Date().toISOString(), status: 'failed' }, ...(m.scanHistory || [])].slice(0, 20),
        }));
      }
      return;
    }
    const rec = buildScanRecord(parsed);
    const newScore = rec.score;
    // Capture previous score before writing new entry
    const lastScore = memory?.scanHistory?.find(s => s.status !== 'failed' && s.score > 0)?.score ?? null;
    setPrevScore(lastScore);
    setAtsScore(newScore);
    setParameters(parsed.parameters ?? {});
    const sorted = sortGapsBySeverity(parsed.gaps || [])
      .map(g => ({ ...g, id: g.id || genId(), userNotes: '', aiSuggestion: g.aiSuggestion || '' }));
    setGapCards(sorted);
    setEditCards([]);
    setDoneCards([]);
    setBuildResult(null);
    setPhase('kanban');
    setShowNextStep(true);
    if (updateMemory) {
      const radarResult = rec.radarResult;
      updateMemory(
        m => ({
          scanHistory: [rec.historyEntry(radarResult), ...(m.scanHistory || [])].slice(0, 20),
          scanResult: radarResult,
        }),
        { table: 'resume_scans', data: rec.row }
      );
    }
  };

  // ── Card movement ─────────────────────────────────────────────────────────────
  const moveCard = useCallback((card, from, to) => {
    const remove = (arr) => arr.filter(c => c.id !== card.id);
    if (from === 'gaps')  setGapCards(remove);
    if (from === 'edit')  setEditCards(remove);
    if (from === 'done')  setDoneCards(remove);
    if (to === 'gaps')    setGapCards(p => [...p, card]);
    if (to === 'edit')    setEditCards(p => [...p, card]);
    if (to === 'done')    setDoneCards(p => [...p, card]);
  }, []);

  const updateCard = useCallback((id, updates) => {
    const upd = arr => arr.map(c => c.id === id ? { ...c, ...updates } : c);
    setGapCards(upd);
    setEditCards(upd);
    setDoneCards(upd);
  }, []);

  const handleDragStart = useCallback((card, fromCol) => {
    dragRef.current = { card, fromCol };
  }, []);

  const handleDrop = useCallback((toCol) => {
    if (!dragRef.current) return;
    moveCard(dragRef.current.card, dragRef.current.fromCol, toCol);
    dragRef.current = null;
  }, [moveCard]);

  // ── Build ─────────────────────────────────────────────────────────────────────
  const handleBuild = async () => {
    if (doneCards.length === 0) return;
    setPhase('building');
    setError(null);
    try {
      const newHtml = await callLLM(
        [{ role: 'user', content: buildRebuildPrompt(resumeText, doneCards) }],
        4096
      );
      const newText = stripHtmlToText(newHtml);
      const analysisRaw = await callLLM(
        [{ role: 'user', content: buildAnalysisPrompt(resumeText, newText) }],
        1024
      );
      const analysis = extractJSON(analysisRaw);
      setBuildResult({
        newHtml:       newHtml.trim(),
        newText,
        newScore:      analysis.atsScore || Math.min(100, (atsScore || 0) + doneCards.length * 5),
        newParams:     analysis.parameters || parameters,
        addedKeywords: analysis.addedKeywords || [],
      });
      setPhase('results');
    } catch (err) {
      setError(err.message || 'Build failed. Please try again.');
      setPhase('kanban');
    }
  };

  // ── Post-build ────────────────────────────────────────────────────────────────
  const handleEditMore = () => setPhase('kanban');

  const handleRebuildFromThis = async () => {
    if (!buildResult?.newText) return;
    const newBase = buildResult.newText;
    setResumeTextState(newBase);
    setPdfUrl(null);
    setPdfBase64(null);
    await runScanText(newBase);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="atb">
      {/* Page header + tab bar */}
      <div style={{ padding: '16px 24px 0', borderBottom: '1px solid var(--lp-bdr)' }}>
        <div style={{ color: 'var(--lp-text)', fontWeight: 900, fontSize: 22 }}>Resume Builder</div>
        <div style={{ color: 'var(--lp-text3)', fontSize: 13, marginTop: 2, marginBottom: 0 }}>
          Upload your resume, build it with 5 templates, and save versions.
        </div>
        <ResumeBuilderTabBar active={mainTab} onTab={tab => { if (tab === 'builder') setEntryMode(null); setMainTab(tab); }} />
      </div>

      {/* Tab routing */}
      {mainTab === 'parse' && (
        <UploadAndParseTab
          user={user}
          memory={memory}
          resumeText={globalResume || resumeText}
          initialProfile={memory?.parseProfile || null}
          onResumeExtracted={handleResumeExtracted}
          onPdfUploaded={handlePdfUploaded}
          onProfileParsed={handleProfileParsed}
          onGoToBuilder={() => { setEntryMode('existing'); setMainTab('builder'); }}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'builder' && entryMode === null && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 8 }}>How do you want to start?</div>
            <div style={{ fontSize: 13, color: 'var(--lp-text3)' }}>Choose a path to build your resume.</div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
            <button
              onClick={() => { if (memory?.parseProfile) { setEntryMode('existing'); } else { setMainTab('parse'); } }}
              style={{ flex: '1 1 260px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lp-teal)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lp-bdr)'}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 6 }}>Upload existing resume</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>
                {memory?.parseProfile
                  ? 'Resume from memory detected — load it straight into the builder pre-filled.'
                  : "Upload your current CV. We'll parse it, check it against the universal resume standard, and load it into the builder pre-filled."}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--lp-teal)' }}>
                {memory?.parseProfile ? 'Load from memory →' : 'Go to Upload & Parse →'}
              </div>
            </button>
            <button
              onClick={() => setEntryMode('scratch')}
              style={{ flex: '1 1 260px', background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 14, padding: '28px 24px', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lp-teal)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--lp-bdr)'}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>✍️</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--lp-text)', marginBottom: 6 }}>Build from scratch</div>
              <div style={{ fontSize: 12, color: 'var(--lp-text3)', lineHeight: 1.6 }}>Start with a blank resume. Fill in your details step-by-step, pick a template, and download a professional PDF.</div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: 'var(--lp-teal)' }}>Start blank →</div>
            </button>
          </div>
        </div>
      )}
      {mainTab === 'builder' && entryMode === 'existing' && (
        <BuilderTab
          initialProfile={memory?.parseProfile || null}
          memory={memory}
          onSaveVersion={handleSaveVersion}
          restoredData={restoredData}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'builder' && entryMode === 'scratch' && (
        <BuilderTab
          initialProfile={null}
          memory={memory}
          onSaveVersion={handleSaveVersion}
          restoredData={null}
          setActiveModule={setActiveModule}
        />
      )}
      {mainTab === 'history' && (
        <VersionHistoryTab memory={memory} onRestore={handleRestore} />
      )}

    </div>
  );
};

export default ATSBuilder;
