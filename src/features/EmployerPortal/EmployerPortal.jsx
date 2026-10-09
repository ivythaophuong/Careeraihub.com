import React, { useState, useRef, useEffect } from 'react';
import { sb } from '../../lib/supabase';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:  '#080C14', bg2: '#0B0F1A', bg3: '#0E1420', bg4: '#131B2E', bg5: '#1A2540',
  text: '#F0F4FF', text2: '#8B9DC3', text3: '#4A5A7A',
  teal: '#EC4899', tealDim: 'rgba(236,72,153,.08)', tealB: 'rgba(236,72,153,.22)',
  violet: '#F59E0B', violetDim: 'rgba(245,158,11,.08)', violetB: 'rgba(245,158,11,.28)', violetTxt: '#C470FF',
  emerald: '#00E5A0', emeraldDim: 'rgba(0,229,160,.08)', emeraldB: 'rgba(0,229,160,.25)',
  gold: '#FFD233', goldDim: 'rgba(255,210,51,.09)', goldB: 'rgba(255,210,51,.28)',
  red: '#FF4D6A', redDim: 'rgba(255,77,106,.09)', redB: 'rgba(255,77,106,.25)',
  bdr: 'rgba(236,72,153,.09)', bdr2: 'rgba(236,72,153,.16)',
  grad: 'linear-gradient(135deg,#EC4899 0%,#F59E0B 100%)',
  gradHR: 'linear-gradient(135deg,#F59E0B 0%,#FCD34D 60%,#FFD233 100%)',
  ff: "'Inter',system-ui,sans-serif",
  ffm: "'JetBrains Mono',monospace",
  r: 10, rs: 7, rl: 16,
};

// ── Seed data ─────────────────────────────────────────────────────────────────
const THREADS = [
  { id:1, name:'Ivy Nguyen',   initials:'IN', bg:'#534AB7', role:'Senior AI Engineer',    trust:88, unread:true,  preview:'Hi! Yes, actively looking…', time:'2m',
    msgs:[{from:'you',text:'Hi Ivy, saw your verified profile — impressive work. Are you open to our Senior AI Engineer role?'},{from:'them',text:'Hi! Yes, actively looking. Happy to share more about my background.'},{from:'them',text:"I've been building RAG pipelines for 2 years. What tech stack does Vertex AI Labs use?"}] },
  { id:2, name:'Ben Tan',      initials:'BT', bg:'#185FA5', role:'ML Research Scientist',  trust:82, unread:true,  preview:'Sounds great! Available Thu or Fri…', time:'1h',
    msgs:[{from:'you',text:"Ben, we've reviewed your TensorFlow cert and NTU background. Would you be open to a research role focused on inference optimisation?"},{from:'them',text:'Sounds great! Available Thu or Fri for a call.'}] },
  { id:3, name:'Marcus Lim',   initials:'ML', bg:'#0F6E56', role:'ML Research Scientist',  trust:91, unread:true,  preview:'Happy to discuss the role scope…', time:'3h',
    msgs:[{from:'you',text:'Marcus, your NeurIPS publications caught our attention. Senior title, equity included.'},{from:'them',text:'Happy to discuss the role scope further. Can you share more on the research direction?'}] },
  { id:4, name:'Priya Sharma', initials:'PS', bg:'#993C1D', role:'Data Engineering Lead',  trust:74, unread:false, preview:'Is visa sponsorship confirmed?', time:'Yesterday',
    msgs:[{from:'you',text:'Priya, your Shopee pipeline experience is exactly what we need. We do offer visa sponsorship.'},{from:'them',text:'One question — is visa sponsorship confirmed for Singapore EP?'}] },
];

const STAGES = [
  { id:'matched',    label:'Matched',    color: T.teal,      countBg:'rgba(236,72,153,.12)',    cards:[
    {name:'Ivy Nguyen',   initials:'IN',bg:'#534AB7',role:'Senior AI Eng', trust:88,tags:['Python','LangChain'],date:'Today'},
    {name:'Ben Tan',      initials:'BT',bg:'#185FA5',role:'ML Research',   trust:82,tags:['TensorFlow','CUDA'],  date:'Today'},
    {name:'Priya Sharma', initials:'PS',bg:'#993C1D',role:'Data Lead',     trust:74,tags:['Spark','SQL'],        date:'Yesterday'},
    {name:'Sarah Lim',    initials:'SL',bg:'#72243E',role:'Frontend Eng',  trust:61,tags:['React','TypeScript'], date:'2d ago'},
  ]},
  { id:'shortlisted',label:'Shortlisted',color: T.violetTxt, countBg:'rgba(245,158,11,.12)',  cards:[
    {name:'Marcus Lim',  initials:'ML',bg:'#0F6E56',role:'ML Research',  trust:91,tags:['PyTorch','LLMs'], date:'Today'},
    {name:'Ivy Nguyen',  initials:'IN',bg:'#534AB7',role:'Senior AI Eng',trust:88,tags:['AWS','RAG'],     date:'1h ago'},
    {name:'Ben Tan',     initials:'BT',bg:'#185FA5',role:'ML Research',  trust:82,tags:['TensorFlow'],    date:'3h ago'},
  ]},
  { id:'trustchat',  label:'TrustChat',  color: T.teal,      countBg:'rgba(236,72,153,.10)',    cards:[
    {name:'Ivy Nguyen',   initials:'IN',bg:'#534AB7',role:'Senior AI Eng',trust:88,tags:['Active','2 msgs'],    date:'2m ago'},
    {name:'Priya Sharma', initials:'PS',bg:'#993C1D',role:'Data Lead',    trust:74,tags:['Awaiting reply'],     date:'1h ago'},
  ]},
  { id:'interview',  label:'Interview',  color: T.gold,      countBg:'rgba(255,210,51,.10)',   cards:[
    {name:'Ben Tan',   initials:'BT',bg:'#185FA5',role:'ML Research',trust:82,tags:['Thu 2pm'],  date:'Scheduled'},
    {name:'Marcus Lim',initials:'ML',bg:'#0F6E56',role:'ML Research',trust:91,tags:['Fri 10am'], date:'Scheduled'},
  ]},
  { id:'offer',      label:'Offer',      color: T.emerald,   countBg:'rgba(0,229,160,.10)',    cards:[
    {name:'Marcus Lim',initials:'ML',bg:'#0F6E56',role:'ML Research',trust:91,tags:['Offer sent','Equity'],date:'Today'},
  ]},
];

// ── Shared primitives ─────────────────────────────────────────────────────────
function Pill({ children, color, bg, border }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:700, fontFamily:T.ffm, background:bg, color, border:`1px solid ${border}` }}>
      {children}
    </span>
  );
}

function trustColor(t) { return t >= 70 ? T.emerald : t >= 40 ? T.gold : T.red; }
function trustLabel(t) { return t >= 70 ? 'High' : t >= 40 ? 'Mid' : 'Low'; }

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ onNavigate, candidates = [] }) {
  const kpis = [
    { n:'47', label:'Matched candidates', delta:'↑ 12 this week', color:T.teal },
    { n:'8',  label:'Active TrustChats',  delta:'↑ 3 new today',  color:T.violetTxt },
    { n:'12', label:'Shortlisted',         delta:'↑ 4 this week',  color:T.emerald },
    { n:'9d', label:'Avg time to shortlist',delta:'↓ 3d faster',  color:T.gold },
  ];
  const pipeline = [
    { n:'47', label:'Matched',   color:T.teal },
    { n:'12', label:'Shortlisted',color:T.violetTxt },
    { n:'5',  label:'Interview', color:T.gold },
    { n:'2',  label:'Offer',     color:T.emerald },
  ];
  const recentCandidates = candidates.slice(0,4);
  const feed = [
    { icon:'✓', iconBg:'rgba(0,229,160,.1)', text:<><strong style={{color:T.text}}>Ivy Nguyen</strong> accepted TrustChat</>, time:'2 min ago' },
    { icon:'⭐', iconBg:'rgba(245,158,11,.1)',text:<><strong style={{color:T.text}}>Marcus Lim</strong> moved to Offer stage</>, time:'1 hr ago' },
    { icon:'👁', iconBg:'rgba(236,72,153,.1)', text:<><strong style={{color:T.text}}>Ben Tan</strong> completed mock interview — score 79</>, time:'3 hr ago' },
    { icon:'📋', iconBg:'rgba(255,210,51,.1)',text:<><strong style={{color:T.text}}>Senior AI Engineer</strong> role got 18 new matches</>, time:'Today 9am' },
  ];

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>Good morning, Sarah 👋</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>Vertex AI Labs · 3 active roles · 847 matched candidates this week</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => onNavigate('match')} style={btnOutline}>View TrustMatch</button>
          <button style={btnPrimary}>+ Post New Role</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {kpis.map((k,i) => (
          <div key={i} style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:T.gradHR }} />
            <div style={{ fontSize:28, fontWeight:800, fontFamily:T.ffm, letterSpacing:-1, lineHeight:1, marginBottom:4, color:k.color }}>{k.n}</div>
            <div style={{ fontSize:11, color:T.text3 }}>{k.label}</div>
            <div style={{ fontSize:10, fontWeight:600, marginTop:6, color:T.emerald }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
        {/* Left column */}
        <div>
          <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:T.text3, marginBottom:8 }}>Pipeline snapshot</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
            {pipeline.map((p,i) => (
              <div key={i} style={{ background:T.bg4, border:`1px solid ${T.bdr}`, borderRadius:T.rs, padding:10, textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:T.ffm, marginBottom:2, color:p.color }}>{p.n}</div>
                <div style={{ fontSize:9, color:T.text3, textTransform:'uppercase', letterSpacing:'.07em' }}>{p.label}</div>
              </div>
            ))}
          </div>

          {/* Recent candidates table */}
          <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, fontWeight:700 }}>Recent candidates</span>
              <button onClick={() => onNavigate('pipeline')} style={btnSm}>View pipeline →</button>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Candidate','Practice score','Match','Stage','Action'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:T.text3, textAlign:'left', borderBottom:`1px solid ${T.bdr}`, background:'rgba(255,255,255,.02)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {recentCandidates.map((c,i) => {
                  const stages = ['TrustChat','Interview','Offer','Shortlisted'];
                  const stageColors = { TrustChat:[T.violetTxt,'rgba(245,158,11,.1)',T.violetB], Interview:[T.gold,'rgba(255,210,51,.1)',T.goldB], Offer:[T.emerald,'rgba(0,229,160,.1)',T.emeraldB], Shortlisted:[T.teal,'rgba(236,72,153,.1)',T.tealB] };
                  const stage = stages[i];
                  const [sc,sb2,sbdr] = stageColors[stage];
                  return (
                    <tr key={c.id} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>{c.initials}</div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{c.name}</div>
                            <div style={{ fontSize:10, color:T.text3 }}>{c.title}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px' }}><Pill color={T.emerald} bg={T.emeraldDim} border={T.emeraldB}>{c.trust}</Pill></td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:T.text2 }}>{c.match != null ? `${c.match}%` : '—'}</td>
                      <td style={{ padding:'10px 14px' }}><Pill color={sc} bg={sb2} border={sbdr}>{stage}</Pill></td>
                      <td style={{ padding:'10px 14px' }}><button onClick={() => onNavigate('inbox')} style={{ fontSize:10, color:T.violetTxt, background:'none', border:'none', cursor:'pointer', fontFamily:T.ff }}>Open chat</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right widgets */}
        <div>
          {/* Trust donut */}
          <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:12, display:'flex', justifyContent:'space-between' }}>
              Trust distribution <span style={{ fontSize:9, color:T.text3, fontWeight:400 }}>this pipeline</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="12"/>
                <circle cx="40" cy="40" r="30" fill="none" stroke={T.emerald} strokeWidth="12" strokeDasharray="113.1 75.4" transform="rotate(-90 40 40)"/>
                <circle cx="40" cy="40" r="30" fill="none" stroke={T.gold} strokeWidth="12" strokeDasharray="28.3 160.2" strokeDashoffset="-113.1" transform="rotate(-90 40 40)"/>
                <circle cx="40" cy="40" r="30" fill="none" stroke={T.red} strokeWidth="12" strokeDasharray="9.4 179.1" strokeDashoffset="-141.4" transform="rotate(-90 40 40)"/>
              </svg>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                {[{label:'High (70+)',color:T.emerald,val:'60%'},{label:'Mid (40–69)',color:T.gold,val:'15%'},{label:'Low (<40)',color:T.red,val:'5%'}].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:l.color }} />
                      <span style={{ color:T.text2 }}>{l.label}</span>
                    </div>
                    <span style={{ fontFamily:T.ffm, fontWeight:700, color:l.color }}>{l.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity feed */}
          <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:14 }}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:12 }}>Activity feed</div>
            {feed.map((f,i) => (
              <div key={i} style={{ display:'flex', gap:9, padding:'8px 0', borderBottom: i < feed.length-1 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
                <div style={{ width:26, height:26, borderRadius:7, background:f.iconBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize:11, color:T.text2, lineHeight:1.45 }}>{f.text}</div>
                  <div style={{ fontSize:9, color:T.text3, marginTop:2 }}>{f.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Job Listings ──────────────────────────────────────────────────────────────
function JobsPage({ onNavigate, employer, user }) {
  const jobs = [
    { role:'Senior AI Engineer',   dept:'Engineering · Full-time',  status:'active', salary:'SGD 12–16k', mode:'Remote-first', trust:70, matched:23, shortlisted:7,  top:95 },
    { role:'ML Research Scientist', dept:'Research · Full-time',    status:'active', salary:'SGD 14–18k', mode:'Hybrid',       trust:80, matched:14, shortlisted:4,  top:91 },
    { role:'DevOps Engineer',       dept:'Infrastructure · Full-time',status:'active',salary:'SGD 9–13k', mode:'On-site',      trust:60, matched:10, shortlisted:1,  top:78 },
    { role:'Product Manager, AI',   dept:'Product · Full-time',     status:'draft',  salary:'SGD 10–15k', mode:'Hybrid',       trust:null,matched:null,shortlisted:null,top:null },
  ];
  const statusStyle = { active:[T.emerald,T.emeraldDim,T.emeraldB], draft:[T.text3,'rgba(255,255,255,.05)','rgba(255,255,255,.1)'] };

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>Job Listings</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>3 active · 1 draft · Last updated 2h ago</div>
        </div>
        <button style={btnPrimary}>+ Post New Role</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
        {jobs.map((j,i) => {
          const [sc,sbg,sbdr] = statusStyle[j.status];
          const topColor = j.status === 'active' ? (i===0 ? T.emerald : T.text3) : T.text3;
          return (
            <div key={i} style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16, position:'relative', overflow:'hidden', transition:'border-color .2s' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background: j.status==='active' ? T.emerald : T.text3 }} />
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, letterSpacing:'-.2px', marginBottom:2 }}>{j.role}</div>
                  <div style={{ fontSize:10, color:T.text3 }}>{j.dept}</div>
                </div>
                <Pill color={sc} bg={sbg} border={sbdr}>{j.status.charAt(0).toUpperCase()+j.status.slice(1)}</Pill>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                {[j.salary, j.mode, j.trust != null ? `Trust ≥ ${j.trust}` : null].filter(Boolean).map(t => (
                  <span key={t} style={{ fontSize:10, padding:'2px 8px', borderRadius:5, background:T.tealDim, color:T.teal, border:`1px solid ${T.tealB}` }}>{t}</span>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                {[['Matched',j.matched],['Shortlisted',j.shortlisted],['Top match',j.top != null ? j.top+'%' : null]].map(([label,val]) => (
                  <div key={label} style={{ background:T.bg4, borderRadius:T.rs, padding:'7px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:15, fontWeight:800, fontFamily:T.ffm, color:T.text }}>{val ?? '—'}</div>
                    <div style={{ fontSize:9, color:T.text3, marginTop:1 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => j.status==='active' && onNavigate('match')} style={{ flex:1, padding:7, borderRadius:T.rs, fontSize:11, fontWeight:600, background:'rgba(245,158,11,.15)', color:T.violetTxt, border:`1px solid ${T.violetB}`, cursor:'pointer' }}>
                  {j.status==='active' ? 'View matches' : 'Publish role'}
                </button>
                <button style={{ flex:1, padding:7, borderRadius:T.rs, fontSize:11, fontWeight:600, background:'rgba(255,255,255,.04)', color:T.text3, border:`1px solid ${T.bdr}`, cursor:'pointer' }}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TrustMatch Swipe ──────────────────────────────────────────────────────────
function MatchPage({ candidates = [] }) {
  const [deck, setDeck] = useState([...candidates]);
  const [shortlisted, setShortlisted] = useState([]);
  const [passed, setPassed] = useState([]);
  const [filterTrust, setFilterTrust] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef(0);

  const current = deck.find(c => c.trust >= filterTrust && !passed.includes(c.id) && !shortlisted.find(s => s.id === c.id));
  const tc = current ? trustColor(current.trust) : T.text;
  const circ = 2 * Math.PI * 21;
  const dash = current ? (current.trust / 100) * circ : 0;

  const doShortlist = () => {
    if (!current) return;
    setShortlisted(s => [...s, current]);
  };
  const doPass = () => {
    if (!current) return;
    setPassed(p => [...p, current.id]);
  };

  const onMouseDown = (e) => { setDragging(true); startXRef.current = e.clientX; setDragX(0); };
  const onMouseMove = (e) => { if (dragging) setDragX(e.clientX - startXRef.current); };
  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX > 80) doShortlist();
    else if (dragX < -80) doPass();
    setDragX(0);
  };

  return (
    <div style={{ padding:'20px 24px', flex:1, overflowY:'auto' }} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>TrustMatch</div>
        <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>Swipe verified candidates · credentials visible before you connect</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>
        <div>
          {/* Filter bar */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.rs, marginBottom:14, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:T.text3 }}>Trust ≥</span>
            <input type="range" min={0} max={80} step={10} value={filterTrust} onChange={e => setFilterTrust(+e.target.value)} style={{ width:80, accentColor:T.violet }} />
            <span style={{ fontSize:11, fontWeight:700, fontFamily:T.ffm, color:T.violetTxt, minWidth:20 }}>{filterTrust}</span>
          </div>

          {/* Swipe card */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            {current ? (
              <>
                <div
                  onMouseDown={onMouseDown}
                  style={{ background:'linear-gradient(145deg,rgba(14,20,32,.98),rgba(11,16,26,1))', border:`1px solid rgba(236,72,153,.14)`, borderRadius:T.rl, padding:20, maxWidth:460, width:'100%', position:'relative', cursor:'grab', userSelect:'none', transform:`translateX(${dragX}px) rotate(${dragX*.07}deg)`, transition: dragging ? 'none' : 'transform .35s', marginBottom:14 }}>
                  {/* Drag labels */}
                  <div style={{ position:'absolute', top:16, left:14, padding:'5px 12px', borderRadius:T.rs, fontSize:13, fontWeight:800, fontFamily:T.ffm, color:T.emerald, border:`2px solid ${T.emerald}`, transform:'rotate(-12deg)', opacity: Math.max(0, Math.min(dragX/80, 1)), pointerEvents:'none' }}>SHORTLIST</div>
                  <div style={{ position:'absolute', top:16, right:14, padding:'5px 12px', borderRadius:T.rs, fontSize:13, fontWeight:800, fontFamily:T.ffm, color:T.red, border:`2px solid ${T.red}`, transform:'rotate(12deg)', opacity: Math.max(0, Math.min(-dragX/80, 1)), pointerEvents:'none' }}>PASS</div>

                  <div style={{ display:'flex', gap:12, marginBottom:14 }}>
                    <div style={{ width:52, height:52, borderRadius:'50%', background:current.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', flexShrink:0 }}>{current.initials}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:700, letterSpacing:'-.3px', marginBottom:2 }}>{current.name}</div>
                      <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>{current.title} · {current.exp} · {current.uni}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {current.verified.map(v => <span key={v} style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:T.emeraldDim, color:T.emerald, border:`1px solid ${T.emeraldB}` }}>✓ {v}</span>)}
                      </div>
                    </div>
                    {/* Trust ring */}
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5"/>
                        <circle cx="26" cy="26" r="21" fill="none" stroke={tc} strokeWidth="5" strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" transform="rotate(-90 26 26)"/>
                      </svg>
                      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:12, fontWeight:800, fontFamily:T.ffm, color:'#fff', lineHeight:1 }}>{current.trust}</span>
                      </div>
                      <div style={{ fontSize:9, fontWeight:700, color:tc, textAlign:'center', marginTop:1 }}>{trustLabel(current.trust)}</div>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:T.text2, lineHeight:1.6, padding:'9px 11px', background:'rgba(236,72,153,.04)', borderRadius:T.rs, borderLeft:`2px solid rgba(236,72,153,.2)`, marginBottom:12 }}>{current.bio}</div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
                    {[['ATS',current.ats],['Interview',current.interview],['STAR',current.star]].map(([l,v]) => (
                      <div key={l} style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:T.rs, padding:7, textAlign:'center' }}>
                        <div style={{ fontSize:12, fontWeight:800, fontFamily:T.ffm, color:T.text }}>{v ?? '—'}</div>
                        <div style={{ fontSize:9, color:T.text3, marginTop:1, textTransform:'uppercase', letterSpacing:'.04em' }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
                    {current.skills.map(s => <span key={s} style={{ fontSize:10, padding:'2px 8px', borderRadius:4, background:'rgba(255,255,255,.05)', color:T.text2, border:'1px solid rgba(255,255,255,.08)', fontFamily:T.ffm }}>{s}</span>)}
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11 }}>
                    <span style={{ color:T.text3 }}>{current.salary}</span>
                    <span style={{ fontWeight:700, fontFamily:T.ffm, background:T.grad, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{current.match != null ? `${current.match}% match` : 'Match not scored yet'}</span>
                  </div>

                  {current.blocker && (
                    <div style={{ marginTop:9, padding:'5px 9px', background:T.goldDim, border:`1px solid ${T.goldB}`, borderRadius:6, fontSize:10 }}>
                      <span style={{ color:T.gold, fontWeight:600 }}>Blocker: </span><span style={{ color:T.text3 }}>{current.blocker}</span>
                    </div>
                  )}
                  <div style={{ textAlign:'center', fontSize:10, color:T.text3, marginTop:10 }}>← drag to pass &nbsp;·&nbsp; drag to shortlist →</div>
                </div>

                <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:16 }}>
                  <button onClick={doPass} style={{ padding:'10px 32px', borderRadius:24, background:T.redDim, color:T.red, border:`1px solid ${T.redB}`, fontSize:12, fontWeight:600, cursor:'pointer' }}>✕ Pass</button>
                  <button onClick={doShortlist} style={{ padding:'10px 32px', borderRadius:24, background:T.emeraldDim, color:T.emerald, border:`1px solid ${T.emeraldB}`, fontSize:12, fontWeight:600, cursor:'pointer' }}>✓ Shortlist</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'60px 0', color:T.text3 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🎯</div>
                <div style={{ fontSize:13, fontWeight:600, color:T.text2, marginBottom:6 }}>All candidates reviewed</div>
                <div style={{ fontSize:11, marginBottom:14 }}>Lower the trust filter to see more</div>
                <button onClick={() => { setPassed([]); }} style={btnOutline}>Reset</button>
              </div>
            )}
          </div>
        </div>

        {/* Shortlist sidebar */}
        <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, overflow:'hidden', alignSelf:'start' }}>
          <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700 }}>Shortlist</span>
            <span style={{ fontSize:10, fontFamily:T.ffm, color:T.violetTxt, fontWeight:700 }}>{shortlisted.length} candidates</span>
          </div>
          <div style={{ padding:'10px 12px' }}>
            {shortlisted.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px 10px', fontSize:11, color:T.text3 }}>Shortlist candidates to build your pipeline</div>
            ) : shortlisted.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', background:'rgba(0,229,160,.04)', border:`1px solid rgba(0,229,160,.15)`, borderRadius:T.rs, marginBottom:6 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{c.initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize:9, color:T.text3 }}>{c.title}{c.match != null ? ` · ${c.match}% match` : ''}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5 }}>
                  <span style={{ fontSize:10, fontWeight:800, fontFamily:T.ffm, color:trustColor(c.trust) }}>T{c.trust}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline Kanban ───────────────────────────────────────────────────────────
function PipelinePage() {
  return (
    <div style={{ padding:'20px 24px', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>Hiring Pipeline</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>All roles · drag candidates between stages</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={btnOutline}>Filter by role</button>
          <button style={btnOutline}>Export CSV</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, flex:1, overflowX:'auto', minHeight:0 }}>
        {STAGES.map(stage => (
          <div key={stage.id} style={{ background:'rgba(255,255,255,.02)', border:`1px solid ${T.bdr}`, borderRadius:T.r, display:'flex', flexDirection:'column', minWidth:180 }}>
            <div style={{ padding:'10px 12px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6, color:stage.color }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:stage.color }} />
                {stage.label}
              </div>
              <span style={{ fontSize:9, padding:'1px 6px', borderRadius:8, fontWeight:700, fontFamily:T.ffm, background:stage.countBg, color:stage.color }}>{stage.cards.length}</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:8 }}>
              {stage.cards.map((card,i) => (
                <div key={i} style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.rs, padding:'10px 11px', marginBottom:7, cursor:'pointer', transition:'all .2s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:card.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>{card.initials}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:T.text }}>{card.name}</div>
                      <div style={{ fontSize:9, color:T.text3, marginTop:1 }}>{card.role}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, fontFamily:T.ffm, color:trustColor(card.trust) }}>{card.trust}</span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:7 }}>
                    {card.tags.map(t => <span key={t} style={{ fontSize:8, padding:'1px 6px', borderRadius:4, background:T.tealDim, color:T.teal, border:`1px solid ${T.tealB}`, fontFamily:T.ffm }}>{t}</span>)}
                  </div>
                  <div style={{ fontSize:9, color:T.text3 }}>{card.date}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
function InboxPage() {
  const [activeThread, setActiveThread] = useState(THREADS[0]);
  const [msgInput, setMsgInput] = useState('');
  const [threadMsgs, setThreadMsgs] = useState({});

  const msgs = threadMsgs[activeThread.id] ? [...activeThread.msgs, ...threadMsgs[activeThread.id]] : activeThread.msgs;

  const sendMsg = () => {
    if (!msgInput.trim()) return;
    setThreadMsgs(prev => ({ ...prev, [activeThread.id]: [...(prev[activeThread.id]||[]), { from:'you', text:msgInput }] }));
    setMsgInput('');
  };

  return (
    <div style={{ padding:'20px 24px 0', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>TrustChat Inbox</div>
        <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>3 unread · verified credentials visible in every thread</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', flex:1, minHeight:0, border:`1px solid ${T.bdr}`, borderRadius:T.r, overflow:'hidden' }}>
        {/* Thread list */}
        <div style={{ borderRight:`1px solid ${T.bdr}`, display:'flex', flexDirection:'column', background:T.bg3, overflowY:'auto' }}>
          <div style={{ padding:'10px 12px', borderBottom:`1px solid ${T.bdr}` }}>
            <input placeholder="Search candidates…" style={{ width:'100%', padding:'7px 11px', background:'rgba(255,255,255,.04)', border:`1px solid ${T.bdr}`, borderRadius:T.rs, color:T.text, fontSize:11, outline:'none', fontFamily:T.ff }} />
          </div>
          {THREADS.map(t => (
            <div key={t.id} onClick={() => setActiveThread(t)} style={{ display:'flex', gap:10, padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.04)', cursor:'pointer', background: activeThread.id===t.id ? 'rgba(245,158,11,.08)' : 'transparent', borderRight: activeThread.id===t.id ? `2px solid ${T.violet}` : '2px solid transparent', transition:'background .15s' }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{t.initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                <div style={{ fontSize:10, color:T.text3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{t.preview}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                <span style={{ fontSize:9, color:T.text3 }}>{t.time}</span>
                {t.unread && <div style={{ width:7, height:7, borderRadius:'50%', background:T.violetTxt }} />}
              </div>
            </div>
          ))}
        </div>

        {/* Chat window */}
        <div style={{ display:'flex', flexDirection:'column', background:T.bg2, minHeight:0 }}>
          <div style={{ padding:'12px 16px', borderBottom:`1px solid ${T.bdr}`, display:'flex', alignItems:'center', gap:12, flexShrink:0, background:T.bg3 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:activeThread.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>{activeThread.initials}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{activeThread.name}</div>
              <div style={{ fontSize:10, color:T.text3 }}>
                {activeThread.role} · Trust {activeThread.trust}
                <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:T.emeraldDim, color:T.emerald, border:`1px solid ${T.emeraldB}`, marginLeft:4 }}>NUS ✓</span>
              </div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <button style={btnSm}>View profile</button>
              <button style={{ ...btnSm, background:'rgba(0,229,160,.12)', color:T.emerald, border:`1px solid ${T.emeraldB}` }}>Move to Interview →</button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
            {msgs.map((m,i) => (
              <div key={i} style={{ display:'flex', justifyContent: m.from==='you' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth:'75%', padding:'9px 13px', fontSize:12, lineHeight:1.55, borderRadius: m.from==='you' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.from==='you' ? 'rgba(245,158,11,.18)' : 'rgba(255,255,255,.06)', color: m.from==='you' ? '#D4ADFF' : T.text2 }}>{m.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.bdr}`, display:'flex', gap:8, flexShrink:0 }}>
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMsg()} placeholder="Type a message…" style={{ flex:1, padding:'9px 13px', background:'rgba(255,255,255,.05)', border:`1px solid ${T.bdr2}`, borderRadius:T.rs, color:T.text, fontSize:12, outline:'none', fontFamily:T.ff }} />
            <button onClick={sendMsg} style={{ padding:'9px 18px', background:'rgba(245,158,11,.18)', border:`1px solid ${T.violetB}`, borderRadius:T.rs, color:T.violetTxt, fontSize:12, fontWeight:600, cursor:'pointer' }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function AnalyticsPage() {
  const funnel = [
    { label:'Matched',    n:47, pct:100, color:'rgba(236,72,153,.4)' },
    { label:'Shortlisted',n:28, pct:60,  color:'rgba(245,158,11,.45)' },
    { label:'TrustChat',  n:18, pct:38,  color:'rgba(236,72,153,.35)' },
    { label:'Interview',  n:9,  pct:20,  color:'rgba(255,210,51,.45)' },
    { label:'Offer',      n:4,  pct:8,   color:'rgba(0,229,160,.5)' },
  ];
  const trustDist = [
    { label:'90–100', n:14, pct:30, color:T.emerald },
    { label:'80–89',  n:26, pct:55, color:T.emerald },
    { label:'70–79',  n:9,  pct:20, color:T.teal },
    { label:'60–69',  n:6,  pct:12, color:T.gold },
    { label:'< 60',   n:2,  pct:5,  color:T.red },
  ];
  const byRole = [
    { label:'Senior AI Eng', n:23, pct:70 },
    { label:'ML Research',   n:14, pct:42 },
    { label:'DevOps Eng',    n:10, pct:30 },
  ];

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>Analytics</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>Last 30 days · Vertex AI Labs</div>
        </div>
        <button style={btnOutline}>Export report</button>
      </div>


      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
        {/* Funnel */}
        <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, marginBottom:14 }}>Candidate funnel</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {funnel.map(f => (
              <div key={f.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:10, color:T.text2, width:90, flexShrink:0 }}>{f.label}</span>
                <div style={{ flex:1, height:20, background:'rgba(255,255,255,.04)', borderRadius:4, overflow:'hidden', position:'relative' }}>
                  <div style={{ width:`${f.pct}%`, height:20, background:f.color, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:8, transition:'width .8s' }}>
                    <span style={{ fontSize:10, fontWeight:700, fontFamily:T.ffm, color:'#fff' }}>{f.n}</span>
                  </div>
                </div>
                <span style={{ fontSize:10, fontFamily:T.ffm, color:T.text3, width:36, textAlign:'right', flexShrink:0 }}>{f.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trust distribution */}
        <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, marginBottom:14 }}>Practice score distribution</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {trustDist.map(d => (
              <div key={d.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:10, color:T.text2, width:55, textAlign:'right', flexShrink:0 }}>{d.label}</span>
                <div style={{ flex:1, height:8, background:'rgba(255,255,255,.06)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${d.pct}%`, height:8, background:d.color, borderRadius:4 }} />
                </div>
                <span style={{ fontSize:10, fontFamily:T.ffm, fontWeight:700, color:d.color, width:24, flexShrink:0 }}>{d.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Matches by role */}
        <div style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:700, marginBottom:14 }}>Matches by role</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {byRole.map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:10, color:T.text2, width:110, textAlign:'right', flexShrink:0 }}>{r.label}</span>
                <div style={{ flex:1, height:8, background:'rgba(255,255,255,.06)', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${r.pct}%`, height:8, background:'linear-gradient(90deg,#EC4899,#F59E0B)', borderRadius:4 }} />
                </div>
                <span style={{ fontSize:10, fontFamily:T.ffm, fontWeight:700, color:T.teal, width:24, flexShrink:0 }}>{r.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────
function TeamPage() {
  const members = [
    { initials:'SW', name:'Sarah Wong',  role:'Head of Talent', badge:'Admin',  badgeBg:'rgba(245,158,11,.15)', badgeColor:T.violetTxt, badgeBdr:T.violetB, bg:T.gradHR, shortlisted:12, chats:8,  offers:2 },
    { initials:'JL', name:'James Liu',   role:'Recruiter',      badge:'Member', badgeBg:'rgba(236,72,153,.1)',   badgeColor:T.teal,     badgeBdr:T.tealB,   bg:'#185FA5', shortlisted:7,  chats:3,  offers:1 },
    { initials:'AK', name:'Anika Kumar', role:'Hiring Manager',  badge:'Viewer', badgeBg:'rgba(255,210,51,.1)', badgeColor:T.gold,     badgeBdr:T.goldB,   bg:'#0F6E56', shortlisted:null,chats:2, offers:null },
  ];

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', flex:1 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, letterSpacing:'-.4px' }}>Team</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>3 members · Pro plan allows up to 10 seats</div>
        </div>
        <button style={btnPrimary}>+ Invite member</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
        {members.map((m,i) => (
          <div key={i} style={{ background:T.bg3, border:`1px solid ${T.bdr}`, borderRadius:T.r, padding:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:m.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff', flexShrink:0 }}>{m.initials}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{m.name}</div>
                <div style={{ fontSize:10, color:T.text3 }}>
                  {m.role}
                  <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:5, marginLeft:6, background:m.badgeBg, color:m.badgeColor, border:`1px solid ${m.badgeBdr}` }}>{m.badge}</span>
                </div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
              {[['Shortlisted',m.shortlisted],['Chats open',m.chats],['Offers sent',m.offers]].map(([l,v]) => (
                <div key={l} style={{ background:T.bg4, borderRadius:T.rs, padding:7, textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:800, fontFamily:T.ffm, color:T.teal }}>{v ?? '—'}</div>
                  <div style={{ fontSize:9, color:T.text3, marginTop:1 }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button style={{ ...btnSm, flex:1 }}>Edit access</button>
              {i > 0 && <button style={{ ...btnSm, background:T.redDim, color:T.red, border:`1px solid ${T.redB}` }}>Remove</button>}
            </div>
          </div>
        ))}
        {/* Invite card */}
        <div style={{ background:'rgba(245,158,11,.06)', border:`1px dashed rgba(245,158,11,.3)`, borderRadius:T.r, padding:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, cursor:'pointer', minHeight:180 }}>
          <div style={{ fontSize:28 }}>＋</div>
          <div style={{ fontSize:12, fontWeight:600, color:T.violetTxt }}>Invite a teammate</div>
          <div style={{ fontSize:10, color:T.text3, textAlign:'center' }}>7 seats remaining on Pro plan</div>
        </div>
      </div>
    </div>
  );
}

// ── Shared button styles ──────────────────────────────────────────────────────
const btnPrimary = { padding:'9px 18px', borderRadius:7, background:'linear-gradient(135deg,#F59E0B 0%,#FCD34D 60%,#FFD233 100%)', border:'none', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' };
const btnOutline = { padding:'9px 16px', borderRadius:7, background:'rgba(255,255,255,.04)', border:'1px solid rgba(236,72,153,.16)', color:'#8B9DC3', fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' };
const btnSm = { padding:'6px 12px', borderRadius:7, fontSize:11, fontWeight:600, border:'1px solid rgba(236,72,153,.16)', background:'rgba(255,255,255,.04)', color:'#8B9DC3', cursor:'pointer' };

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { section:'Overview', items:[{ id:'dashboard', icon:'⚡', label:'Dashboard' }] },
  { section:'Hiring',   items:[
    { id:'jobs',     icon:'📋', label:'Job Listings' },
    { id:'match',    icon:'💘', label:'TrustMatch', badge:5 },
    { id:'pipeline', icon:'🗂', label:'Pipeline' },
    { id:'inbox',    icon:'💬', label:'Inbox', badge:3 },
  ]},
  { section:'Insights', items:[
    { id:'analytics', icon:'📊', label:'Analytics' },
    { id:'team',      icon:'👥', label:'Team' },
  ]},
];

// ── Main EmployerPortal component ─────────────────────────────────────────────
// Map a candidate_trust_profiles row to the shape MatchPage/DashboardPage expect
const BG_PALETTE = ['#534AB7','#185FA5','#0F6E56','#993C1D','#72243E','#2D5A8E','#7B3F9C'];
function mapCandidate(row, idx) {
  const name = row.full_name || 'Candidate';
  const inits = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const salLabel = row.salary_min ? `${row.currency || 'USD'} ${(row.salary_min / 1000).toFixed(0)}–${(row.salary_max / 1000).toFixed(0)}k` : '';
  return {
    id: row.user_id, initials: inits, name, bg: BG_PALETTE[idx % BG_PALETTE.length],
    title: row.headline || 'Professional', exp: '', uni: '',
    trust: row.trust_score || 0, match: null, // no real matching engine yet, so no match % is invented
   
    ats: row.ats_score || 0, interview: row.interview_score || 0,
    star: row.star_score > 70 ? 'Strong' : row.star_score > 40 ? 'Good' : 'Developing',
    skills: row.skills || [], salary: salLabel, bio: row.bio || '',
    verified: [], blocker: null,
  };
}

export default function EmployerPortal({ user, onLogout }) {
  const [page,       setPage]       = useState('dashboard');
  const [employer,   setEmployer]   = useState(null);
  const [candidates, setCandidates] = useState(null); // null = loading, [] = loaded empty

  // Bootstrap: ensure employer record exists, then fetch visible candidates
  useEffect(() => {
    if (!user?.token) return;
    const bootstrap = async () => {
      try {
        // 1. Find or create employer record
        let employers = await sb.select('employers', { owner_id: `eq.${user.id}` }, user.token);
        let emp = employers?.[0];
        if (!emp) {
          const companyName = user.company || user.name || 'My Company';
          const created = await sb.insert('employers', { owner_id: user.id, name: companyName }, user.token);
          emp = Array.isArray(created) ? created[0] : created;
          // Also add owner as employer_member
          if (emp?.id) {
            try { await sb.insert('employer_members', { employer_id: emp.id, user_id: user.id, role: 'owner' }, user.token); } catch {}
          }
        }
        setEmployer(emp);

        // 2. Only a verified employer may see candidates (the database enforces this too)
        if (!emp?.verified_at) { setCandidates([]); return; }
        const rows = await sb.select('candidate_trust_profiles', { is_visible: 'eq.true', order: 'trust_score.desc', limit: 50 }, user.token);
        setCandidates((rows || []).map(mapCandidate));
      } catch (e) {
        console.warn('[EmployerPortal] bootstrap error:', e.message);
        setCandidates([]);
      }
    };
    bootstrap();
  }, [user]);

  const displayCandidates = candidates || [];

  if (employer && !employer.verified_at) {
    return (
      <div role="alert" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg, color:T.text, fontFamily:T.ff, padding:24 }}>
        <div style={{ maxWidth:440, textAlign:'center' }}>
          <div style={{ fontSize:20, fontWeight:800, marginBottom:10 }}>Your employer account is awaiting verification</div>
          <div style={{ fontSize:13, color:T.text2, lineHeight:1.7, marginBottom:20 }}>
            To protect candidates, employer accounts are reviewed before they can see candidate profiles or post jobs.
            We'll enable <strong>{employer.name}</strong> once the review is done.
          </div>
          <button onClick={onLogout} style={{ padding:'10px 20px', borderRadius:10, border:`1px solid ${T.bdr2}`, background:'transparent', color:T.text2, fontWeight:700, cursor:'pointer' }}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!employer && candidates === null) {
    return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg, color:T.text2, fontFamily:T.ff }}>Loading…</div>;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={setPage} candidates={displayCandidates} />;
      case 'jobs':      return <JobsPage onNavigate={setPage} employer={employer} user={user} />;
      case 'match':     return <MatchPage candidates={displayCandidates} />;
      case 'pipeline':  return <PipelinePage />;
      case 'inbox':     return <InboxPage />;
      case 'analytics': return <AnalyticsPage />;
      case 'team':      return <TeamPage />;
      default:          return <DashboardPage onNavigate={setPage} candidates={displayCandidates} />;
    }
  };

  const companyName = employer?.name || user?.company || 'Your company';
  const userName = user?.name || 'Recruiter';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:T.bg, color:T.text, fontFamily:T.ff, fontSize:13, lineHeight:1.55, WebkitFontSmoothing:'antialiased', overflow:'hidden', position:'relative' }}>
      {/* Ambient bg */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:'radial-gradient(ellipse 900px 600px at 10% 0%,rgba(245,158,11,.06),transparent 55%), radial-gradient(ellipse 700px 500px at 90% 100%,rgba(236,72,153,.05),transparent 55%)' }} />

      {/* Topbar */}
      <div style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', height:52, background:'rgba(8,12,20,.92)', borderBottom:`1px solid rgba(245,158,11,.14)`, flexShrink:0, backdropFilter:'blur(28px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:800, letterSpacing:'-.2px', background:T.gradHR, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            <div style={{ width:26, height:26, borderRadius:7, background:T.gradHR, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="#fff"><path d="M8 1L10.5 6H15L11 9.5L12.5 14.5L8 11.5L3.5 14.5L5 9.5L1 6H5.5Z"/></svg>
            </div>
            careerAIhub
          </div>
          <span style={{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:5, background:'rgba(245,158,11,.12)', color:T.violetTxt, border:`1px solid rgba(245,158,11,.25)`, letterSpacing:'.04em' }}>EMPLOYER PORTAL</span>
          <div style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 10px', borderRadius:T.rs, background:'rgba(255,255,255,.04)', border:`1px solid ${T.bdr2}` }}>
            <div style={{ width:20, height:20, borderRadius:5, background:T.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>{companyName.slice(0,2).toUpperCase()}</div>
            <span style={{ fontSize:11, fontWeight:600, color:T.text2 }}>{companyName}</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:T.gradHR, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', border:`2px solid rgba(245,158,11,.35)` }}>{initials}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ position:'relative', zIndex:1, flex:1, display:'flex', overflow:'hidden' }}>
        {/* Sidenav */}
        <nav style={{ width:200, background:'rgba(8,12,20,.8)', borderRight:`1px solid ${T.bdr}`, display:'flex', flexDirection:'column', flexShrink:0, padding:'12px 0', overflowY:'auto' }}>
          {NAV.map(section => (
            <div key={section.section} style={{ padding:'0 10px', marginBottom:4 }}>
              <div style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:T.text3, padding:'8px 8px 4px' }}>{section.section}</div>
              {section.items.map(item => (
                <button key={item.id} onClick={() => setPage(item.id)} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:T.rs, fontSize:12, fontWeight:500, color: page===item.id ? T.text : T.text3, background: page===item.id ? 'rgba(245,158,11,.1)' : 'none', borderLeft: page===item.id ? `2px solid ${T.violet}` : '2px solid transparent', borderTop:'none', borderRight:'none', borderBottom:'none', width:'100%', textAlign:'left', cursor:'pointer', transition:'all .18s', fontFamily:T.ff, position:'relative' }}>
                  <span style={{ fontSize:14, width:18, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  {item.label}
                  {item.badge && <span style={{ marginLeft:'auto', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'#FF4D6A', color:'#fff' }}>{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div style={{ height:1, background:T.bdr, margin:'8px 10px' }} />
          <div style={{ padding:'0 10px' }}>
            <button style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:T.rs, fontSize:12, fontWeight:500, color:T.text3, background:'none', border:'none', width:'100%', textAlign:'left', cursor:'pointer', fontFamily:T.ff }}>
              <span style={{ fontSize:14, width:18, textAlign:'center' }}>⚙</span>Settings
            </button>
          </div>
          <div style={{ marginTop:'auto', padding:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px', borderRadius:T.rs, background:'rgba(255,255,255,.03)', border:`1px solid ${T.bdr}` }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:T.gradHR, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials}</div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:T.text2 }}>{userName}</div>
              </div>
            </div>
            <button onClick={onLogout} style={{ background:'none', border:'none', fontSize:10, color:T.text3, padding:'6px 4px', marginTop:4, width:'100%', textAlign:'left', cursor:'pointer', transition:'color .15s', fontFamily:T.ff }}>← Sign out</button>
          </div>
        </nav>

        {/* Page content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          <div role="note" style={{ padding:'8px 20px', fontSize:11, color:T.text2, background:'rgba(245,158,11,.08)', borderBottom:`1px solid ${T.bdr}` }}>
            Preview: Pipeline, Inbox, Analytics, Team and the job and dashboard figures show sample data until those features launch. Candidate scores are practice scores from candidates' own activity and are not verified.
          </div>
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
