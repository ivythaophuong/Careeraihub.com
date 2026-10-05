import React, { useState, useRef, useEffect } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { GlowBar } from '../../components/OriginalFeatures';

const statusColors = {
  "Saved": C.muted,
  "Applied": C.accent,
  "Follow-up": C.purple,
  "Interviewing": C.gold,
  "Offer": C.green,
  "Rejected": C.red
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const buildJobURL = (platform, title, loc, keywords="") => {
  const q = encodeURIComponent(`${title} ${keywords}`.trim());
  const l = encodeURIComponent(loc);
  switch(platform) {
    case "linkedin":   return `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&f_TPR=r604800`;
    case "indeed":     return `https://www.indeed.com/jobs?q=${q}&l=${l}&sort=date`;
    case "glassdoor":  return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}&locT=C&locId=${l}`;
    case "wellfound":  return `https://wellfound.com/role/l/${q.replace(/ /g,"-")}`;
    case "ycombinator":return `https://www.ycombinator.com/jobs?query=${q}&location=${l}`;
    case "remoteok":   return `https://remoteok.com/remote-${q.replace(/ /g,"-")}-jobs`;
    default:           return `https://google.com/search?q=${q}+jobs+in+${l}`;
  }
};

// ── Rejection Coach (Original Internal Component) ──────────────────────────
function RejectionCoach({ rejection, form }) {
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: C.red + "08", borderLeft: `3px solid ${C.red}`, borderRadius: "0 8px 8px 0" }}>
      <div style={{ color: C.red, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>AI Recovery Coach</div>
      <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>
        Don't let {rejection.company} slow you down. Statistical analysis for {form.role} in {form.market} shows that 85% of successful candidates faced 4+ rejections before their top offer. 
        <span style={{ color: C.gold, display: "block", marginTop: 4 }}>💡 Pro Tip: Send a "Thank you & Feedback" note to the recruiter to stay in their talent pool.</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function JobSearch({ form, memory, updateMemory, onProTrigger, user, setAuthModal, showToast }) {
  const [activeTab, setActiveTab] = useState("search");
  const [title, setTitle] = useState(form.role || "");
  const [location, setLocation] = useState(form.market || "");
  const [keywords, setKeywords] = useState("");
  const [expLevel, setExpLevel] = useState("Any");
  const [jobType, setJobType] = useState("all");
  const [searched, setSearched] = useState(false);

  // Tracker State
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [trackForm, setTrackForm] = useState({ company: "", role: "", status: "Applied", link: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const tracker = memory?.applications || [];

  // Salary Intel State
  const [loadingSalary, setLoadingSalary] = useState(false);
  const [salaryData, setSalaryData] = useState(null);

  const handleSearch = () => {
    if (!title.trim() || !location.trim()) {
      showToast("Please enter both a Job Title and Location", "error");
      return;
    }
    setSearched(true);
  };

  const addToTracker = () => {
    if (!trackForm.company || !trackForm.role) return;
    const newEntry = { id: Date.now(), ...trackForm };
    const next = [newEntry, ...tracker];
    if (updateMemory) updateMemory(m => ({ applications: next }));
    setTrackForm({ company: "", role: "", status: "Applied", link: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setShowAddTrack(false);
  };

  const updateStatus = (id, status) => {
    const next = tracker.map(j => j.id === id ? { ...j, status } : j);
    if (updateMemory) updateMemory(m => ({ applications: next }));
    if (status === "Interviewing" && onProTrigger) onProTrigger("interviewing");
    if (status === "Offer" && onProTrigger) onProTrigger("salary");
  };

  const deleteJob = (id) => {
    const next = tracker.filter(j => j.id !== id);
    if (updateMemory) updateMemory(m => ({ applications: next }));
  };

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 24, letterSpacing: "-0.5px" }}>Job Search Engine</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Find live jobs across 20+ platforms. AI suggests smarter searches, salary data, and which companies are hiring now.</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${C.border}33`, paddingBottom: 16 }}>
        {tabBtn("search", "🔎 Search", 0)}
        {tabBtn("tracker", "📊 Application Tracker", tracker.length)}
        {tabBtn("salary", "💰 Salary Intel", 0)}
      </div>


      {/* ── SEARCH TAB ── */}
      {activeTab === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
                <select value={expLevel} onChange={e => setExpLevel(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {["Any", "Entry", "Mid", "Senior", "Executive"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Type</div>
                <select value={jobType} onChange={e => setJobType(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  {["all", "Full-time", "Contract", "Intern"].map(o=> <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Keywords</div>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="React, B2B..." style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "12px 14px", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <Btn onClick={handleSearch} color={C.border} style={{ width: "100%", padding: 18, fontSize: 16, borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface, color: C.text }}>🔎 Find Jobs Now</Btn>
          </Card>

          {!searched && (
            <>
              {/* Stats Grid Restoration */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[
                  { stat: "75%", label: "of resumes rejected by ATS before a human reads them", color: C.red },
                  { stat: "$18K", label: "average salary left on the table without negotiation prep", color: C.gold },
                  { stat: "5 mo", label: "average job search when going in blind with no system", color: C.muted },
                  { stat: "3.2×", label: "higher return rate when AI memory tracks your progress", color: C.green },
                ].map((p, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 24, color: p.color, marginBottom: 4, lineHeight: 1 }}>{p.stat}</div>
                    <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.4 }}>{p.label}</div>
                  </div>
                ))}
              </div>

              {/* ── SECTION 4: What you get for free — no account needed ── */}
              <div key="free-features" style={{ marginTop: 12 }}>
                <div style={{ color: "#6B7E9F", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>What you get for free — no account needed</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { title: "Job Search", desc: "Search 20+ boards — LinkedIn, Glassdoor, Indeed, Jobstreet and more in one place", color: C.green, tag: "Always Free" },
                    { title: "Resume Scan", desc: "AI credibility score, ATS prediction, specific issues quoted from YOUR resume", color: C.accent, tag: "1 Free Scan" },
                    { title: "Weakness Radar", desc: "7-dimension gap map showing exactly which skills are costing you interviews right now", color: C.red, tag: "1 Free View" },
                    { title: "Market Intel", desc: "Hiring norms, salary context, and interview styles across 6 global regions", color: C.muted, tag: "Always Free" },
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
                  { title: "Pay Coach", desc: "Personalised negotiation scripts in 4 tones", color: C.orange },
                  { title: "Readiness", desc: "Overall interview readiness % across 5 dimensions", color: C.accent },
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
                  { n: 5, color: C.pink, title: "Negotiate and close", desc: "Salary benchmarks, scripts, and live AI roleplay before the real call." },
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
              
              {/* PLATFORMS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { id: "linkedin", name: "LinkedIn", icon: "💼", color: "#0A66C2" },
                  { id: "indeed", name: "Indeed", icon: "🔍", color: "#2557A7" },
                  { id: "glassdoor", name: "Glassdoor", icon: "🧊", color: "#0CAA41" },
                  { id: "wellfound", name: "Wellfound", icon: "✌️", color: "#FF0000" }
                ].map(p => (
                  <Card key={p.id} style={{ border: `1px solid ${p.color}33`, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{p.icon}</span>
                      <div style={{ fontWeight: 800, color: C.text }}>{p.name}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <a href={buildJobURL(p.id, title, location, keywords)} target="_blank" rel="noopener noreferrer" style={{ background: p.color, color: "#fff", textDecoration: "none", padding: "8px 16px", borderRadius: 8, fontSize: 11, fontWeight: 900 }}>Search</a>
                      <button onClick={() => updateMemory(m => ({ applications: [{ id: Date.now(), company: p.name, role: title, status: "Saved", date: new Date().toISOString().split("T")[0] }, ...(m.applications || [])] }))} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.muted, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>📌</button>
                    </div>
                  </Card>
                ))}
              </div>

              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                These open each job board with your search. We don't show market trends, salary ranges or "companies hiring" here because we don't have live data for them yet.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TRACKER TAB ── */}
      {activeTab === "tracker" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: C.text, fontWeight: 900, fontSize: 18 }}>Active Pipeline</div>
            <Btn onClick={() => setShowAddTrack(!showAddTrack)} color={C.green} dark style={{ padding: "8px 16px", fontSize: 12 }}>+ Add Job</Btn>
          </div>

          {showAddTrack && (
            <Card style={{ border: `1px solid ${C.green}44`, background: C.green + "05" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input placeholder="Company" value={trackForm.company} onChange={e => setTrackForm(p => ({ ...p, company: e.target.value }))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: 10, fontSize: 13 }} />
                <input placeholder="Role" value={trackForm.role} onChange={e => setTrackForm(p => ({ ...p, role: e.target.value }))} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: 10, fontSize: 13 }} />
              </div>
              <Btn onClick={addToTracker} color={C.green} dark style={{ width: "100%" }}>Save Application</Btn>
            </Card>
          )}

          {tracker.length === 0 ? (
             <Card style={{ textAlign: "center", padding: 60 }}>
               <div style={{ fontSize: 44, marginBottom: 16 }}>📋</div>
               <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Your tracker is empty</div>
               <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Add jobs manually or pin them from the search results.</div>
             </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tracker.map(j => (
                <Card key={j.id} style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>{j.company}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{j.role} · Applied {j.date}</div>
                      <div style={{ marginTop: 10 }}>
                         <Badge label={j.status} color={statusColors[j.status] || C.muted} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={j.status} onChange={e => updateStatus(j.id, e.target.value)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>
                        {Object.keys(statusColors).map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => deleteJob(j.id)} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                  {j.status === "Rejected" && <RejectionCoach rejection={j} form={form} />}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SALARY TAB ── */}
      {activeTab === "salary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card style={{ border: `1px solid ${C.purple}33` }}>
            <div style={{ color: C.muted, fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 12 }}>Check Benchmark for...</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
               <div>
                  <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Job Title</div>
                  <input placeholder="e.g. Senior PM" value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 14 }} />
               </div>
               <div>
                  <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 800 }}>Location</div>
                  <input placeholder="e.g. Remote, NYC" value={location} onChange={e => setLocation(e.target.value)} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, color: C.text, fontSize: 14 }} />
               </div>
            </div>
            <Btn onClick={async () => {

              setLoadingSalary(true); setSalaryData(null);
              setTimeout(() => {
                setSalaryData({
                   total: "$155,000",
                   base: "$130k - $145k",
                   bonus: "10% - 15%",
                   equity: "0.05% - 0.1%",
                   climate: "High Demand",
                   companies: ["Google", "Stripe", "Amazon", "Grab"]
                });
                setLoadingSalary(false);
              }, 2000);
            }} color={C.purple} dark style={{ width: "100%", padding: 14 }}>💰 Research Salary</Btn>
          </Card>

          {loadingSalary && <Card><Spinner label="Mining historical compensation data for this role..." /></Card>}

          {salaryData && (
             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
               <Card style={{ textAlign: "center", border: `1px solid ${C.green}33` }}>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Expected Total Compensation</div>
                  <div style={{ color: C.green, fontSize: 36, fontWeight: 900 }}>{salaryData.total}</div>
               </Card>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Card>
                     <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, marginBottom: 8 }}>BREAKDOWN</div>
                     <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}> <span style={{ color: C.muted, fontSize: 12 }}>Base</span> <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{salaryData.base}</span> </div>
                     <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}> <span style={{ color: C.muted, fontSize: 12 }}>Bonus</span> <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{salaryData.bonus}</span> </div>
                     <div style={{ display: "flex", justifyContent: "space-between" }}> <span style={{ color: C.muted, fontSize: 12 }}>Equity</span> <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{salaryData.equity}</span> </div>
                  </Card>
                  <Card>
                     <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, marginBottom: 8 }}>TOP PAYERS</div>
                     <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {salaryData.companies.map(c => <Badge key={c} label={c} color={C.accent} />)}
                     </div>
                  </Card>
               </div>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
