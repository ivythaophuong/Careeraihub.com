import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { GlowBar } from '../../components/OriginalFeatures';
import ApplicationTracker, { AddJobForm } from './ApplicationTracker';
import { FRESHNESS, buildJobURL, sourcesFor, applyStatus, makeApplication } from './jobTracker';
import { buildActiveJob, peekRequestedTab, clearRequestedTab } from './jobHandoff';

// Salary figures are not shown in-app (there is no salary data source), so point to real ones.
const SALARY_SOURCES = [
  { name: "Glassdoor Salaries", url: "https://www.glassdoor.com/Salaries/index.htm", desc: "Employee-reported salaries by company and role." },
  { name: "Levels.fyi", url: "https://www.levels.fyi/", desc: "Compensation by level at tech companies." },
  { name: "Payscale", url: "https://www.payscale.com/", desc: "Salary survey and comparison tools." },
  { name: "MyCareersFuture", url: "https://www.mycareersfuture.gov.sg/", desc: "Singapore job listings that show salary ranges." },
];

// ── Main Component ───────────────────────────────────────────────────────────
export default function JobSearch({ form, memory, updateMemory, onProTrigger, user, setAuthModal, setActiveModule, showToast }) {
  const [activeTab, setActiveTab] = useState(() => peekRequestedTab() || "search");
  useEffect(() => { clearRequestedTab(); }, []);
  const [title, setTitle] = useState(form.role || "");
  const [location, setLocation] = useState(form.market || "");
  const [keywords, setKeywords] = useState("");
  const [expLevel, setExpLevel] = useState("Any");
  const [jobType, setJobType] = useState("all");
  const [days, setDays] = useState(3);
  const [searched, setSearched] = useState(false);
  const [searchErr, setSearchErr] = useState("");

  // Tracker State. Every change goes through the memory updater so it never works from a stale list.
  const [showAdd, setShowAdd] = useState(false);
  const tracker = memory?.applications || [];
  const sessionCount = memory?.mockSessions?.length || 0;

  const handleSearch = () => {
    if (!title.trim() || !location.trim()) {
      setSearchErr("Please enter both a job title and a location.");
      return;
    }
    setSearchErr("");
    setSearched(true);
  };

  const mapApps = (fn) => updateMemory?.(m => ({ applications: (m.applications || []).map(fn) }));
  const patchApp = (id, patch) => mapApps(a => (a.id === id ? { ...a, ...patch } : a));
  const updateStatus = (id, status) => {
    mapApps(a => (a.id === id ? applyStatus(a, status) : a));
    if (status === "Interviewing" && onProTrigger) onProTrigger("interviewing");
    if (status === "Offer" && onProTrigger) onProTrigger("salary");
  };
  const deleteJob = (id) => updateMemory?.(m => ({ applications: (m.applications || []).filter(a => a.id !== id) }));

  // Opens another module already pointed at this job (see jobHandoff.js).
  const openForJob = (module, app) => {
    updateMemory?.({ activeJob: buildActiveJob(app) });
    setActiveModule?.(module);
  };

  const saveJob = (fields, { checkFit } = {}) => {
    const app = makeApplication(fields);
    updateMemory?.(m => ({ applications: [app, ...(m.applications || [])] }));
    setShowAdd(false);
    setActiveTab("tracker");
    if (checkFit && app.jd) openForJob("jd", app);
    else showToast?.("Added to your tracker", "success");
  };

  const addJobForm = showAdd && (
    <AddJobForm initial={{ role: title.trim() }} onSave={saveJob} onCancel={() => setShowAdd(false)} />
  );

  const tabBtn = (id, label, count) => (
    <button 
      onClick={() => setActiveTab(id)} 
      style={{ 
        background: activeTab === id ? C.green + "1A" : "transparent", 
        border: `1px solid ${activeTab === id ? C.green : C.border}`, 
        color: activeTab === id ? C.green : C.muted, 
        borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer", 
        display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" 
      }}
    >
      {label} {count > 0 && <span style={{ background: C.green, color: "#000", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 900 }}>{count}</span>}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "24px clamp(16px, 3vw, 28px)", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "var(--lp-text)", fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Job Search Engine</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Open the newest jobs on the major job boards from one form, add the ones you like, and track every application to its next step.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${C.border}33`, paddingBottom: 16 }}>
        {tabBtn("search", "🔎 Search", 0)}
        {tabBtn("tracker", "📊 Application Tracker", tracker.length)}
        {tabBtn("salary", "💰 Salary Research", 0)}
      </div>


      {/* ── SEARCH TAB ── */}
      {activeTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Card style={{ border: `1px solid ${C.border}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ color: "#C9D6EC", fontSize: 13, lineHeight: 1.6, flex: "1 1 280px" }}>
              {sessionCount > 0
                ? <>You have completed <strong style={{ color: C.text }}>{sessionCount}{sessionCount >= 10 ? "+" : ""} mock interview{sessionCount === 1 ? "" : "s"}</strong>. Turn that practice into applications: find a job, add it here, and every job gets a next step.</>
                : <>Find a job, add it here, and every job gets a next step. Want to practise first? A mock interview takes a few minutes.</>}
            </div>
            {sessionCount === 0 && setActiveModule && <Btn onClick={() => setActiveModule("simulate")} color={C.accent} style={{ minHeight: 44 }}>Practise first</Btn>}
          </Card>

          <Card style={{ border: `1px solid ${C.green}33`, boxShadow: `0 0 30px ${C.green}08` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Job Title</div>
                <input value={title} onChange={e => { setTitle(e.target.value); setSearched(false); }} placeholder="e.g. Senior PM" style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Location</div>
                <input value={location} onChange={e => { setLocation(e.target.value); setSearched(false); }} placeholder="e.g. Remote, NYC" style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 14, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Experience Level</div>
                <select aria-label="Experience level" value={expLevel} onChange={e => setExpLevel(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {["Any", "Entry", "Mid", "Senior", "Executive"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Type</div>
                <select aria-label="Job type" value={jobType} onChange={e => setJobType(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {["all", "Full-time", "Contract", "Intern"].map(o=> <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Keywords</div>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="React, B2B..." style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div role="group" aria-label="Posted within" style={{ marginBottom: 20 }}>
              <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Posted within</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FRESHNESS.map(f => (
                  <button key={f.days} type="button" aria-pressed={days === f.days} onClick={() => setDays(f.days)} style={{ minHeight: 44, padding: "0 18px", borderRadius: 99, fontSize: 13, fontWeight: days === f.days ? 800 : 600, cursor: "pointer", fontFamily: "inherit", background: days === f.days ? C.accent + "22" : "transparent", color: days === f.days ? C.accent : "#9FB0CC", border: `1px solid ${days === f.days ? C.accent : C.border}` }}>{f.label}</button>
                ))}
              </div>
            </div>
            <Btn onClick={handleSearch} color={C.border} style={{ width: "100%", padding: 18, fontSize: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.text }}>🔎 Find Jobs Now</Btn>
            {searchErr && <div role="alert" style={{ color: C.red, fontSize: 12, marginTop: 10 }}>⚠️ {searchErr}</div>}
          </Card>

          {addJobForm || (
            <Card style={{ border: `1px dashed ${C.border}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ color: "#C9D6EC", fontSize: 13, lineHeight: 1.6, flex: "1 1 280px" }}><strong style={{ color: C.text }}>Found a job?</strong> Paste the link or description and track it from here. You can also check how well your resume fits it.</div>
              <Btn onClick={() => setShowAdd(true)} color={C.green} dark style={{ minHeight: 44 }}>+ Add a job you found</Btn>
            </Card>
          )}

          {!searched && (
            <>
              {/* ── SECTION 4: What you get for free — no account needed ── */}
              <div key="free-features" style={{ marginTop: 12 }}>
                <div style={{ color: "#6B7E9F", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>What's free</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { title: "Job Search", desc: "Search 20+ boards — LinkedIn, Glassdoor, Indeed, Jobstreet and more in one place", color: C.green, tag: "Always Free" },
                    { title: "Resume Scan", desc: "AI credibility score and specific issues quoted from YOUR resume", color: C.accent, tag: "Free account" },
                    { title: "Weakness Radar", desc: "7-dimension gap map showing exactly which skills are costing you interviews right now", color: C.red, tag: "Free account" },
                    { title: "Regional Guide", desc: "General guidance on hiring norms and interview styles for 4 regions (not live data)", color: C.muted, tag: "Always Free" },
                  ].map((f, i) => (
                    <Card key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, boxShadow: `0 0 6px ${f.color}88` }} />
                          <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{f.title}</div>
                        </div>
                        <span style={{ background: f.color + "15", color: f.color, border: `1px solid ${f.color}33`, borderRadius: 20, padding: "2px 8px", fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>{f.tag}</span>
                      </div>
                      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.55 }}>{f.desc}</div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* ── SECTION 5: Platform modules — account unlocks ── */}
              <div key="modules" style={{ height: 1, background: C.border, margin: "16px 0" }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7E9F", marginBottom: 16 }}>Unlock with a free account — still no credit card</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 32 }}>
                {[
                  { title: "JD Analyzer", desc: "Match score + ATS keywords for any job posting", color: C.pink },
                  { title: "STAR Builder", desc: "Refine interview stories, build a persistent bank", color: C.gold },
                  { title: "Pay Coach", desc: "Word-for-word negotiation scripts and a plan for your offer", color: C.orange },
                  { title: "Readiness", desc: "A readiness score based on your resume scan", color: C.accent },
                  { title: "App Tracker", desc: "Track every application, status, and pipeline", color: C.green },
                  { title: "AI Insights", desc: "Cross-module tips personalised to your activity", color: C.purple },
                ].map((m, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 12px", transition: "border-color 0.2s" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, marginBottom: 10, boxShadow: `0 0 6px ${m.color}88` }} />
                    <div style={{ color: m.color, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{m.title}</div>
                    <div style={{ color: C.muted, fontSize: 10, lineHeight: 1.5 }}>{m.desc}</div>
                  </div>
                ))}
              </div>

              {/* ── SECTION 6: Pro teaser — full pricing in modal ── */}
              <div key="pro" style={{ height: 1, background: C.border, margin: "16px 0" }} />
              <div style={{ background: `linear-gradient(135deg,${C.accent}06,${C.purple}04)`, border: `1px solid ${C.accent}1A`, borderRadius: 14, padding: "20px 24px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 4, letterSpacing: "-0.2px" }}>Unlock the full platform</div>
                  <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, maxWidth: 340 }}>HM Simulator, Salary Coach, AI Memory, Rejection Coach and more. One coaching session costs $200. Pro is everything, unlimited.</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => updateMemory({})} style={{ background: "transparent", border: `1px solid ${C.accent}66`, color: C.accent, borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    View pricing →
                  </button>
                  <button onClick={() => setAuthModal("register")} style={{ background: `linear-gradient(135deg,${C.accent},#0096CC)`, color: "#000", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 900, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    Start free
                  </button>
                </div>
              </div>

              {/* ── SECTION 7: How it works ── */}
              <div key="how-it-works" style={{ height: 1, background: C.border, margin: "16px 0" }} />
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7E9F", marginBottom: 16 }}>How it works — 5 steps to your next offer</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 32 }}>
                {[
                  { n: 1, color: C.accent, title: "Tell us about you", desc: "Set your role, market, and level. Every module personalises instantly." },
                  { n: 2, color: C.green, title: "Scan your resume", desc: "AI reads it like a hiring manager. Get a credibility score in 20 seconds." },
                  { n: 3, color: C.gold, title: "See your gaps", desc: "Weakness Radar shows which skills are costing you interviews right now." },
                  { n: 4, color: C.purple, title: "Prepare to win", desc: "Mock interviews, STAR stories, and cover letters built from your data." },
                  { n: 5, color: C.pink, title: "Negotiate and close", desc: "Negotiation scripts and AI roleplay before the real call, using the numbers you enter." },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: i < 4 ? `1px solid ${C.border}44` : "none" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, background: s.color + "22", color: s.color, border: `1px solid ${s.color}44` }}>{s.n}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.title}</div>
                      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── SECTION 8: Company culture reviews ── */}
              <div key="culture" style={{ height: 1, background: C.border, margin: "16px 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6B7E9F" }}>Company culture intel</div>
                <div style={{ fontSize: 10, color: C.muted }}>Powered by CareerAiHub community</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {[
                  {
                    company: "Grab",
                    role: "Product Manager",
                    location: "Singapore",
                    rating: 4,
                    tags: ["Fast-paced", "Strong eng culture", "Equity upside"],
                    interview: "3 rounds — case study + PM metrics deep-dive + leadership panel. Expect SQL proficiency questions even for PM roles.",
                    culture: "High ownership, cross-functional pods. OKRs are taken seriously. Burnout risk at senior levels.",
                    verdict: "Recommend",
                    verdictColor: C.green,
                  },
                  {
                    company: "Shopee",
                    role: "Senior Data Analyst",
                    location: "Singapore · Remote",
                    rating: 3,
                    tags: ["High volume", "Data-driven", "Long hours"],
                    interview: "4 rounds — take-home case, SQL test, stakeholder round, bar-raiser. Turnaround 10 days.",
                    culture: "Metrics obsessed. Good for early career growth. Work-life balance varies heavily by team.",
                    verdict: "Neutral",
                    verdictColor: C.gold,
                  },
                  {
                    company: "Stripe",
                    role: "Software Engineer",
                    location: "US · Remote",
                    rating: 5,
                    tags: ["Top compensation", "Rigorous bar", "Strong docs culture"],
                    interview: "5 rounds — Stripe-specific system design, distributed systems, and a writing exercise. Prepare for depth.",
                    culture: "Writing-heavy async culture. Extremely high calibre peers. Comp is top 5% in market.",
                    verdict: "Highly recommend",
                    verdictColor: C.accent,
                  },
                ].map((r, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", transition: "border-color 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{r.company}</div>
                          <div style={{ color: C.muted, fontSize: 11 }}>· {r.role}</div>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>{r.location}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(s => <div key={s} style={{ width: 8, height: 8, borderRadius: 2, background: s <= r.rating ? C.gold : C.border }} />)}
                        </div>
                        <span style={{ background: `${r.verdictColor}15`, color: r.verdictColor, border: `1px solid ${r.verdictColor}33`, borderRadius: 20, padding: "2px 9px", fontSize: 9, fontWeight: 700, letterSpacing: "0.05em" }}>{r.verdict}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                      {r.tags.map((t, j) => (
                        <span key={j} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "2px 9px", fontSize: 9, color: C.muted, fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ marginBottom: 7 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent, marginBottom: 3 }}>Interview process</div>
                      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.55 }}>{r.interview}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.purple, marginBottom: 3 }}>Work culture</div>
                      <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.55 }}>{r.culture}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── SECTION 9: Final CTA repeat ── */}
              <div key="final-cta" style={{ textAlign: "center", padding: "24px 0 8px" }}>
                <div style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>Ready to build your career OS?</div>
                <button onClick={() => setAuthModal("register")} style={{ background: C.accent, color: "#000", border: "none", borderRadius: 8, padding: "12px 32px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 0 28px ${C.accent}44` }}>
                  ⚡ Start Free — No Card Needed
                </button>
                <div style={{ color: C.muted, fontSize: 10, marginTop: 12, lineHeight: 1.6 }}>
                  Free forever for core features · Pro from $19/month
                </div>
              </div>
            </>
          )}


          {searched && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* PLATFORMS: links only. The job site shows the live results; nothing is fetched or stored by us. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {sourcesFor(`${location} ${form.market || ""}`).map(p => (
                  <Card key={p.id} style={{ border: `1px solid ${p.color}33`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: C.text }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#9FB0CC", marginTop: 2 }}>{p.dated ? `Posted within ${FRESHNESS.find(f => f.days === days).label}` : p.note}</div>
                    </div>
                    <a href={buildJobURL(p.id, title, location, keywords, days)} target="_blank" rel="noopener noreferrer" aria-label={`Search ${p.name} in a new tab`} style={{ background: p.color, color: "#fff", textDecoration: "none", padding: "12px 18px", borderRadius: 8, fontSize: 12, fontWeight: 900, minHeight: 20 }}>Search ↗</a>
                  </Card>
                ))}
              </div>
              <div style={{ color: "#9FB0CC", fontSize: 12, lineHeight: 1.6 }}>Each board opens in a new tab with your search filled in. When you find a job you like, come back and add it above.</div>
            </div>
          )}
        </div>
      )}

      {/* ── TRACKER TAB ── */}
      {activeTab === "tracker" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {addJobForm}
          <ApplicationTracker
            apps={tracker}
            userName={user?.name || ""}
            onPatch={patchApp}
            onStatus={updateStatus}
            onDelete={deleteJob}
            onOpen={openForJob}
            onAddClick={() => setShowAdd(true)}
            onFind={() => setActiveTab("search")}
          />
        </div>
      )}

      {/* ── SALARY TAB ── */}
      {activeTab === "salary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card style={{ border: `1px solid ${C.purple}33` }}>
            <div style={{ color: C.text, fontWeight: 900, fontSize: 16, marginBottom: 8 }}>Find real salary data</div>
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
              CareerAiHub doesn't have a salary database yet; benchmarks from verified sources are being prepared. Until then, check current ranges for <strong style={{ color: C.text }}>{title.trim() || "your role"}</strong>{location.trim() ? <> in <strong style={{ color: C.text }}>{location.trim()}</strong></> : null} on several of these sources and compare them:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SALARY_SOURCES.map(src => (
                <a key={src.name} href={src.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "block" }}>
                  <div style={{ color: C.accent, fontWeight: 800, fontSize: 13 }}>{src.name} ↗</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{src.desc}</div>
                </a>
              ))}
            </div>
          </Card>
          <Card style={{ border: `1px solid ${C.green}33` }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Got an offer or heading into negotiation?</div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>The Salary Coach gives you word-for-word scripts and a plan for your situation, using the numbers you enter.</div>
            {setActiveModule && <Btn onClick={() => setActiveModule("salary")} color={C.green} dark style={{ width: "100%" }}>💰 Open Salary Coach</Btn>}
          </Card>
        </div>
      )}
    </div>
  );
}
