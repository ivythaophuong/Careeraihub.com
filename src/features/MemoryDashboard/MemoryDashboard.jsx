import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai';
import { sb } from '../../lib/supabase';
import { GetReadyTabStrip } from '../Landing/LandingPage';
import '../../styles/featurePage.css';

function buildMemoryContext(mem, form) {
  if (!mem) return "";
  const lines = [];
  if (mem.scanHistory?.length) {
    const latest = mem.scanHistory[mem.scanHistory.length - 1];
    const trend = mem.scanHistory.length > 1
      ? (latest.score - mem.scanHistory[0].score > 0 ? "improving" : "declining")
      : "first scan";
    lines.push(`Resume scan history: ${mem.scanHistory.length} scans, latest score ${latest.score}/100 (${trend})`);
  }
  if (mem.starBank?.length) lines.push(`STAR story bank: ${mem.starBank.length} stories banked, avg score ${Math.round(mem.starBank.reduce((s,x)=>s+x.score,0)/mem.starBank.length)}/100`);
  if (mem.mockSessions?.length) lines.push(`Mock interview history: ${mem.mockSessions.length} sessions completed`);
  if (mem.negotiationPractice > 0) lines.push(`Negotiation practice: ${mem.negotiationPractice} roleplay sessions`);
  if (mem.jdAnalyses?.length) {
    const avgMatch = Math.round(mem.jdAnalyses.reduce((s,x)=>s+x.matchScore,0)/mem.jdAnalyses.length);
    lines.push(`JD analyses: ${mem.jdAnalyses.length} analyzed, avg match score ${avgMatch}%`);
  }
  lines.push(`Target: ${form.level} ${form.role} in ${form.industry}, ${form.market}`);
  return lines.length ? "\n\nUSER HISTORY CONTEXT:\n" + lines.join("\n") : "";
}

export default function MemoryDashboard({ memory, form, user, updateMemory, setActiveModule, onStudyPlan, embedded }) {
  if (!memory) return <div style={{textAlign:"center",padding:40}}><Spinner label="Assembling AI memory bank..."/></div>;

  const [aiSummary, setAiSummary]   = useState(null);
  const [loadingSummary, setLoading] = useState(false);
  const [cleared, setCleared]        = useState(false);

  const totalActivity = (memory.scanHistory?.length||0)+(memory.starBank?.length||0)+(memory.mockSessions?.length||0)+(memory.applications?.length||0);

  const getPersonalizedPlan = async () => {
    setLoading(true);
    const memCtx = buildMemoryContext(memory, form);
    try {
      const raw = await callLLM([{role:"user", content:`Elite career coach. Based on comprehensive user history, generate a personalized career acceleration plan.${memCtx}

Return ONLY raw JSON:
{"overallProgress":"0-100 score based on activity","status":"Ready|Almost|Needs Work","topStrength":"best thing about their journey","biggestRisk":"most critical risk to landing the job","weeklyPlan":[{"day":"Mon","action":"..."},{"day":"Tue","action":"..."},{"day":"Wed","action":"..."},{"day":"Thu","action":"..."},{"day":"Fri","action":"..."}],"uniqueInsights":["insight1 specific to their data","insight2","insight3"],"predictedTimeline":"estimated weeks to get offer based on their activity pace","nextMilestone":"the single most important thing to do next"}`}], 1500);
      setAiSummary(extractJSON(raw));
    } catch(e) { setAiSummary({error:e.message}); }
    setLoading(false);
  };

  const clearMemory = async () => {
    setCleared(true);
    setAiSummary(null);
    // Updates merge into memory, so to clear everything we explicitly empty every key that exists
    // (lists become [], numbers 0, everything else null) on top of the known defaults.
    updateMemory(m => ({
      scanHistory: [], starBank: [], mockSessions: [], applications: [],
      rejections: [], negotiationPractice: 0, coverLetters: [], jdAnalyses: [],
      insights: [], totalSessions: 0, lastSeen: null, profile: {}, lastResume: null,
      ...Object.fromEntries(Object.keys(m || {}).map(k => [k, Array.isArray(m[k]) ? [] : typeof m[k] === 'number' ? 0 : null])),
    }));
    if (user?.id && user?.token) {
      const filter = { user_id: `eq.${user.id}` };
      const tables = ['resume_scans', 'star_stories', 'mock_sessions', 'cover_letters',
                      'jd_analyses', 'applications', 'negotiation_practice', 'insights'];
      await Promise.allSettled(tables.map(t => sb.delete(t, filter, user.token)));
    }
  };

  const statCards = [
    { icon:"⚡", label:"Resume Scans",        val: memory.scanHistory?.length || 0,      color: C.accent },
    { icon:"⭐", label:"STAR Stories Banked",  val: memory.starBank?.length || 0,         color: C.gold   },
    { icon:"🧠", label:"Mock Sessions",        val: memory.mockSessions?.length || 0,     color: C.purple },
    { icon:"📊", label:"Jobs Tracked",         val: memory.applications?.length || 0,     color: C.green  },
    { icon:"🔍", label:"JD Analyses",          val: memory.jdAnalyses?.length || 0,       color: C.pink   },
    { icon:"💰", label:"Negotiation Practice", val: memory.negotiationPractice || 0,      color: C.orange },
    { icon:"✉️", label:"Cover Letters",       val: memory.coverLetters?.length || 0,     color: "#FF9500" },
    { icon:"📅", label:"Days Active",          val: memory.lastSeen ? Math.max(1, Math.ceil((Date.now()-new Date(memory.joinedAt||memory.lastSeen))/86400000)) : 1, color: C.muted },
  ];

  const latestScore = memory.scanHistory?.length ? memory.scanHistory[memory.scanHistory.length-1].score : null;
  const firstScore  = memory.scanHistory?.length > 1 ? memory.scanHistory[0].score : null;

  return (
    <div className="fp-wrap" style={{display:"flex",flexDirection:"column",gap:0}}>
      {!embedded && <GetReadyTabStrip activeModuleId="memory" onNavigate={setActiveModule} onStudyPlan={onStudyPlan || (() => {})} />}
      <div style={{display:"flex",flexDirection:"column",gap:16,padding:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{color:C.text, fontWeight:900, fontSize:24}}>🧬 AI Memory Dashboard</div>
          <div style={{color:C.muted,fontSize:13,marginTop:4}}>Your personalized career intelligence — built from {totalActivity} activity events across all sessions.</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={getPersonalizedPlan} disabled={loadingSummary||totalActivity<2} color={C.purple} style={{width:"auto",padding:"8px 16px",fontSize:12}}>
            {loadingSummary?"Analyzing...":"🧠 Get AI Career Plan"}
          </Btn>
        </div>
      </div>

      {cleared && <Card glow={C.gold}><div style={{color:C.gold,fontSize:13}}>✓ Memory cleared. Fresh start!</div></Card>}

      {/* Activity Stats Grid */}
      <div className="fp-grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {statCards.map(s=>(
          <Card key={s.label} glow={s.color} style={{padding:"14px 16px",textAlign:"center"}}>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{color:s.color,fontSize:22,fontWeight:900}}>{s.val}</div>
            <div style={{color:C.muted,fontSize:10,marginTop:3,textTransform:"uppercase",letterSpacing:0.5}}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Resume Score Trend */}
      {memory.scanHistory?.length > 0 && (
        <Card glow={C.accent}>
          <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:12}}>📈 Resume Score Progression</div>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60,marginBottom:10}}>
            {memory.scanHistory.map((s,i)=>{
              const h=Math.max(6,Math.round((s.score/100)*60));
              const c=s.score>=70?C.green:s.score>=50?C.gold:C.red;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{color:C.muted,fontSize:8}}>{s.score}</div>
                  <div style={{width:"100%",height:h,background:c,borderRadius:3,transition:"height 0.8s"}}/>
                  <div style={{color:C.muted,fontSize:8}}>{new Date(s.date).toLocaleDateString("en",{month:"short",day:"numeric"})}</div>
                </div>
              );
            })}
          </div>
          {firstScore && latestScore && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{color:C.muted,fontSize:12}}>Started: <strong style={{color:C.text}}>{firstScore}/100</strong></div>
              <div style={{color:latestScore>firstScore?C.green:C.red,fontWeight:800,fontSize:13}}>
                {latestScore>firstScore?"📈 +"+(latestScore-firstScore)+" pts improvement":"📉 "+(latestScore-firstScore)+" pts"}
              </div>
              <div style={{color:C.muted,fontSize:12}}>Latest: <strong style={{color:C.text}}>{latestScore}/100</strong></div>
            </div>
          )}
        </Card>
      )}

      {/* Application Pipeline Funnel */}
      {memory.applications?.length > 0 && (
        <Card glow={C.green}>
          <div style={{color:C.green,fontWeight:700,fontSize:13,marginBottom:12}}>📊 Application Pipeline Funnel</div>
          {[
            ["Saved",       memory.applications.filter(a=>a.status==="Saved").length,       C.muted],
            ["Applied",     memory.applications.filter(a=>a.status==="Applied").length,     C.accent],
            ["Follow-up",   memory.applications.filter(a=>a.status==="Follow-up").length,   C.orange],
            ["Interviewing",memory.applications.filter(a=>a.status==="Interviewing").length,C.gold],
            ["Offer",       memory.applications.filter(a=>a.status==="Offer").length,       C.green],
            ["Rejected",    memory.applications.filter(a=>a.status==="Rejected").length,    C.red],
          ].map(([l,v,c])=>{
            const pct = memory.applications.length ? Math.round((v/memory.applications.length)*100) : 0;
            return (
              <div key={l} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:C.text,fontSize:12}}>{l}</span>
                  <span style={{color:c,fontWeight:700,fontSize:12}}>{v} <span style={{color:C.muted,fontWeight:400}}>({pct}%)</span></span>
                </div>
                <div style={{background:C.surface,borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:4,transition:"width 1s"}}/>
                </div>
              </div>
            );
          })}
          {memory.applications.filter(a=>a.status==="Offer").length > 0 && (
            <div style={{color:C.gold,fontWeight:800,fontSize:12,marginTop:10}}>
              🏆 Offer rate: {Math.round((memory.applications.filter(a=>a.status==="Offer").length/memory.applications.length)*100)}%
            </div>
          )}
        </Card>
      )}

      {/* AI-Generated Career Plan */}
      {loadingSummary && <Card><Spinner label="AI analyzing your entire career journey..."/></Card>}
      {aiSummary && !aiSummary.error && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Card glow={C.purple}>
              <div style={{color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>Overall Progress</div>
              <div style={{color:C.purple,fontSize:40,fontWeight:900}}>{aiSummary.overallProgress}%</div>
              <div style={{color:aiSummary.status==="Ready"?C.green:aiSummary.status==="Almost"?C.gold:C.red,fontWeight:700,fontSize:12,marginTop:4}}>
                {aiSummary.status==="Ready"?"🟢 Interview Ready":aiSummary.status==="Almost"?"🟡 Almost There":"🔴 Needs Work"}
              </div>
            </Card>
            <Card glow={C.gold}>
              <div style={{color:C.gold,fontWeight:700,fontSize:13,marginBottom:6}}>⏱ Predicted Timeline</div>
              <div style={{color:C.text,fontSize:15,fontWeight:800}}>{aiSummary.predictedTimeline}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:6}}>🎯 Next: {aiSummary.nextMilestone}</div>
            </Card>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Card glow={C.green}><div style={{color:C.green,fontWeight:700,fontSize:12,marginBottom:8}}>💪 Top Strength</div><div style={{color:C.text,fontSize:13,lineHeight:1.7}}>{aiSummary.topStrength}</div></Card>
            <Card glow={C.red}><div style={{color:C.red,fontWeight:700,fontSize:12,marginBottom:8}}>⚡ Biggest Risk</div><div style={{color:C.text,fontSize:13,lineHeight:1.7}}>{aiSummary.biggestRisk}</div></Card>
          </div>
          <Card glow={C.accent}>
            <div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:12}}>📅 Your Personalized Weekly Plan</div>
            <div className="fp-grid-5" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {aiSummary.weeklyPlan?.map((d,i)=>(
                <div key={i} style={{background:C.surface,borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                  <div style={{color:C.accent,fontWeight:800,fontSize:11,marginBottom:6}}>{d.day}</div>
                  <div style={{color:C.text,fontSize:10,lineHeight:1.5}}>{d.action}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{color:C.purple,fontWeight:700,fontSize:13,marginBottom:10}}>🧬 AI Insights From Your History</div>
            {aiSummary.uniqueInsights?.map((ins,i)=>(
              <div key={i} style={{color:C.text,fontSize:13,padding:"8px 12px",background:C.purple+"11",borderRadius:6,marginBottom:6,borderLeft:`3px solid ${C.purple}`}}>{ins}</div>
            ))}
          </Card>
        </>
      )}

      {/* Danger zone */}
      <Card style={{borderColor:C.red+"33"}}>
        <div style={{color:C.muted,fontSize:12,marginBottom:8}}>⚠️ Data Management</div>
        <div style={{color:C.muted,fontSize:11,marginBottom:10}}>Memory is stored locally in your browser. Clearing removes all history.</div>
        <button onClick={clearMemory} style={{background:"transparent",border:`1px solid ${C.red}44`,color:C.red,borderRadius:6,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          🗑 Clear All Memory
        </button>
      </Card>
      </div>
    </div>
  );
}
