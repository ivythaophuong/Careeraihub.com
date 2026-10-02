import React, { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import { sb } from './lib/supabase';
import { callLLM, extractJSON } from './lib/ai.jsx';
import { extractTextFromPdfFile } from './lib/resumeParser.js';
import { C, MODULES } from './styles/theme';
import { Badge, Btn, Card, Spinner } from './components/CommonUI';
import { useMemory } from './hooks/useMemory';

const _ab2b64 = (buf) => {
  let b = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
};
const _formatParsedResume = (p) => {
  const s = [];
  if (p.personalInfo?.fullName) s.push(p.personalInfo.fullName);
  if (p.summary) s.push('\n' + p.summary);
  if (p.experience?.length) {
    s.push('\n\nEXPERIENCE');
    p.experience.forEach(e => {
      s.push(`${e.position} at ${e.company} (${e.startDate} – ${e.endDate})`);
      (e.description || []).forEach(d => s.push('• ' + d));
    });
  }
  if (p.education?.length) {
    s.push('\n\nEDUCATION');
    p.education.forEach(e => s.push(`${e.degree} — ${e.school} ${e.year || ''}`));
  }
  if (p.skills?.length) {
    s.push('\n\nSKILLS');
    p.skills.forEach(sk => s.push(`${sk.category}: ${(sk.items || []).join(', ')}`));
  }
  return s.join('\n');
};
const RESUME_EXTRACT_PROMPT = `Extract this resume and return ONLY raw JSON (no markdown, start with {): {"personalInfo":{"fullName":"","email":"","phone":"","location":""},"summary":"","experience":[{"company":"","position":"","startDate":"","endDate":"","description":[]}],"education":[{"school":"","degree":"","year":""}],"skills":[{"category":"","items":[]}]}`;

// ── Feature Modules ──────────────────────────────────────────────────────────
import ResumeScan from './features/ResumeScan/ResumeScan';
import WeaknessRadar from './features/WeaknessRadar/WeaknessRadar';
import ReadinessScore from './features/ReadinessScore/ReadinessScore';
import JDAnalyzer from './features/JDAnalyzer/JDAnalyzer';
import STARBuilder from './features/STARBuilder/STARBuilder';
import HiringManagerSim from './features/HiringManagerSim/HiringManagerSim';
import SalaryCoach from './features/SalaryCoach/SalaryCoach';
import CoverLetterGen from './features/CoverLetterGen/CoverLetterGen';
import MarketIntel from './features/MarketIntel/MarketIntel';
import JobSearch from './features/JobSearch/JobSearch';
import MemoryDashboard from './features/MemoryDashboard/MemoryDashboard';
import ATSBuilder from './features/ATSBuilder/ATSBuilder';
import TrustMatch from './features/TrustMatch/TrustMatch';
import InterviewCoach from './features/InterviewCoach/InterviewCoach';
import VerifyCreds from './features/VerifyCreds/VerifyCreds';
import CultureQuiz from './features/CultureQuiz/CultureQuiz';
import PrivacyPolicy from './features/Legal/PrivacyPolicy';
import TermsOfService from './features/Legal/TermsOfService';
import LandingPage, { GuestNav, AppHubNav, LogoMark, StudyPlanModal, GetReadyTabStrip } from './features/Landing/LandingPage';
import { AppLoader, OrbitSpinner } from './components/OrbitMark';
import AppSidebar from './components/AppSidebar';
import Dashboard from './features/Dashboard/Dashboard';
import SkillsGap from './features/SkillsGap/SkillsGap';
import CareerRoadmap from './features/CareerRoadmap/CareerRoadmap';
import AICoach from './features/AICoach/AICoach';
import './styles/appTheme.css';

// ── Original Overlay Components ──────────────────────────────────────────────
import { Ticker, UserMenu, AuthGate } from './components/OriginalUIOverlays';
import { AuthModal, CommandPalette } from './components/OriginalFeatures';
import EmployerPortal from './features/EmployerPortal/EmployerPortal';

// ── Main App Shell ───────────────────────────────────────────────────────────
function App() {
  const [setupDone, setSetupDone] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [form, setForm] = useState({ role: "", industry: "", level: "Senior", market: "Singapore", urgency: "7 days" });
  const profileSyncRef = useRef(null);
  const [user, setUser] = useState(null);
  const [activeModule, _setActiveModule] = useState("dashboard");

  const navigate = (moduleId) => {
    window.history.pushState({ module: moduleId, showLanding: false }, '', `?tab=${moduleId}`);
    _setActiveModule(moduleId);
    setShowLanding(false);
  };
  const [authModal, setAuthModal] = useState(null);
  const [proModal, setProModal] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [toast, setToast] = useState(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [grModalOpen, setGrModalOpen] = useState(false);
  const [grModalTab, setGrModalTab] = useState('dashboard');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeProfile, _setResumeProfile] = useState(() => {
    try { const s = localStorage.getItem('careerai_profile'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const setResumeProfile = (val) => {
    if (val) localStorage.setItem('careerai_profile', JSON.stringify(val));
    else localStorage.removeItem('careerai_profile');
    _setResumeProfile(val);
  };
  const [profileLoading, setProfileLoading] = useState(false);
  const { memory, updateMemory, isSyncing } = useMemory(user, isRestoring, setIsRestoring, setRestoreError);
  
  // State is now fully managed by useMemory relational sync
  // localStorage used as resilient fallback — survives refreshes even if Supabase write is delayed
  const resumeKey = user?.id ? `careerai_rt_${user.id}` : 'careerai_rt_guest';
  const _rawStored = localStorage.getItem(resumeKey);
  const _storedResume = _rawStored ? (() => { try { return JSON.parse(_rawStored); } catch { return _rawStored; } })() : null;
  const resumeText = memory.resumeText || _storedResume || null;
  const scanResult = memory.scanResult || null;

  const setResumeText = (val) => {
    if (val) localStorage.setItem(resumeKey, typeof val === 'string' ? val : JSON.stringify(val));
    else localStorage.removeItem(resumeKey);
    updateMemory(m => ({ ...m, resumeText: val }));
  };
  const setScanResult = (val) => updateMemory(m => ({ ...m, scanResult: val }));

  // Capture beta/UTM source from URL params — persists through signup
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ref = p.get('ref') || p.get('utm_source');
    if (ref) localStorage.setItem('careerai_signup_source', ref);
  }, []);

  // Browser history support
  useEffect(() => {
    window.history.replaceState({ showLanding: true }, '', window.location.pathname);
    const handlePop = (e) => {
      const state = e.state;
      if (!state || state.showLanding) {
        setShowLanding(true);
      } else {
        _setActiveModule(state.module || 'dashboard');
        setShowLanding(false);
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Restore session
  useEffect(() => {
    const raw = localStorage.getItem("supabase.auth.token");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const session = data.currentSession;
      if (!session) return;

      // Reject expired tokens before restoring — avoids silent 401s on all DB calls
      const [, payload] = (session.access_token || '').split('.');
      if (payload) {
        const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        if (exp && Date.now() / 1000 > exp) {
          // Try refresh token if available
          const refresh = session.refresh_token;
          if (refresh) {
            sb.refreshToken(refresh).then(newSession => {
              const updated = { currentSession: { ...session, access_token: newSession.access_token, refresh_token: newSession.refresh_token } };
              localStorage.setItem("supabase.auth.token", JSON.stringify(updated));
              // Re-trigger restore with new token by reloading (simplest recovery path)
              window.location.reload();
            }).catch(() => {
              localStorage.removeItem("supabase.auth.token");
            });
          } else {
            localStorage.removeItem("supabase.auth.token");
          }
          return;
        }
      }

      const userObj = session.user;
      const meta = userObj.user_metadata || {};
      const restoredUser = {
        id: userObj.id,
        email: userObj.email,
        name: meta.full_name || userObj.email?.split("@")[0] || "User",
        token: session.access_token,
        role: meta.role || 'candidate',
        company: meta.company || null,
      };
      setUser(restoredUser);
      setIsRecruiter(meta.role === 'recruiter');
      loadProfile(restoredUser);
      setIsRestoring(true);
      setSetupDone(true);
    } catch (e) {
      console.error("Session restore failed", e);
      setIsRestoring(false);
    }
  }, []);

  const loadProfile = useCallback(async (userObj, { fromLogin = false, isRecruiter: recruiter = false } = {}) => {
    try {
      const rows = await sb.select('profiles', { id: `eq.${userObj.id}` }, userObj.token);
      const p = rows?.[0];
      if (p) {
        setForm(prev => ({
          ...prev,
          role:     p.role     || prev.role,
          industry: p.industry || prev.industry,
          level:    p.level    || prev.level,
          market:   p.market   || prev.market,
          urgency:  p.urgency  || prev.urgency,
        }));
        if (fromLogin && p.role && !recruiter) setSetupDone(true);
      }
      // fromLogin + no profile row = new user, leave setupDone=false → onboarding shows
    } catch {
      // If profile load fails for a login, don't block the user — show onboarding
    }
  }, []);

  const login = (session) => {
    const userObj = session.user;
    const meta = userObj.user_metadata || {};
    const newUser = {
      id: userObj.id,
      email: userObj.email,
      name: meta.full_name || userObj.email?.split("@")[0] || "User",
      token: session.access_token,
      role: meta.role || 'candidate',
      company: meta.company || null,
    };
    setUser(newUser);
    setIsRecruiter(meta.role === 'recruiter');
    localStorage.setItem("supabase.auth.token", JSON.stringify({ currentSession: session }));
    loadProfile(newUser, { fromLogin: true, isRecruiter: meta.role === 'recruiter' });
    setIsRestoring(true); // Trigger composite fetch
    setAuthModal(null);
    _setActiveModule('dashboard');
    showToast("✓ Welcome!", "success");
  };

  const logout = () => {
    sb.signOut(user?.token);
    localStorage.removeItem("supabase.auth.token");
    setUser(null);
    setIsRecruiter(false);
    setSetupDone(false);
    window.location.reload();
  };

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Persist form to profiles table (debounced 1s after last change)
  useEffect(() => {
    if (!user?.id || !user?.token || !form.role) return;
    if (profileSyncRef.current) clearTimeout(profileSyncRef.current);
    profileSyncRef.current = setTimeout(async () => {
      try {
        await sb.upsert('profiles', {
          id: user.id,
          email: user.email,
          role: form.role,
          industry: form.industry,
          level: form.level,
          market: form.market,
          urgency: form.urgency,
          updated_at: new Date().toISOString(),
        }, user.token);
      } catch { /* non-fatal */ }
    }, 1000);
    return () => { if (profileSyncRef.current) clearTimeout(profileSyncRef.current); };
  }, [form.role, form.industry, form.level, form.market, form.urgency, user]);

  const renderActiveModule = () => {
    const props = {
      resumeText, setResumeText, scanResult, setScanResult,
      form, memory, updateMemory,
      resumeProfile, profileLoading,
      onProTrigger: setProModal,
      user, setAuthModal, showToast, setActiveModule: navigate,
      onStudyPlan: (tab) => { setGrModalTab(tab); setGrModalOpen(true); },
    };
    
    switch (activeModule) {
      case "scan":     return <ResumeScan {...props} />;
      case "radar":    return <WeaknessRadar {...props} />;
      case "score":    return <ReadinessScore {...props} />;
      case "jd":       return <JDAnalyzer {...props} />;
      case "star":     return <STARBuilder {...props} />;
      case "simulate": return <InterviewCoach {...props} />;
      case "salary":   return <SalaryCoach {...props} />;
      case "cover":    return <CoverLetterGen {...props} />;
      case "market":   return <MarketIntel {...props} />;
      case "jobs":     return <JobSearch {...props} />;
      case "memory":   return <MemoryDashboard {...props} />;
      case "ats":        return <ATSBuilder {...props} />;
      case "trustmatch": return <TrustMatch {...props} />;
      case "verify":     return <VerifyCreds {...props} />;
      case "dashboard":  return <Dashboard {...props} />;
      case "skillsgap":  return <SkillsGap {...props} />;
      case "roadmap":    return <CareerRoadmap {...props} />;
      case "aichat":     return <AICoach {...props} />;
      case "culture":    return <CultureQuiz embedded user={user} onScan={() => navigate("scan")} />;
      case "privacy":  return <PrivacyPolicy onBack={() => navigate("jobs")} />;
      case "terms":    return <TermsOfService onBack={() => navigate("jobs")} />;
      default:         return <ResumeScan {...props} />;
    }
  };

  // ── 3. Render Helper ───────────────────────────────────────────────────────
  const goToModule = (moduleId) => navigate(moduleId);

  const renderMainContent = () => {

    if (!user && showLanding) return <LandingPage setAuthModal={setAuthModal} onModuleSelect={goToModule} />;

    if (user && isRecruiter) return <EmployerPortal user={user} onLogout={logout} />;

    if (!setupDone) {
      const INDUSTRIES = ['Software / Tech', 'Finance', 'Marketing', 'Healthcare', 'Education', 'Consulting', 'Other'];
      const MARKETS    = ['Singapore', 'Southeast Asia', 'Global'];
      const LEVELS     = ['Intern', 'Junior', 'Mid', 'Senior', 'Lead / Staff', 'Director+'];
      const URGENCIES  = ['This week', '1 month', '3 months', 'Exploring'];
      const STEP_TITLES = [
        { title: 'What role are you targeting?', sub: 'Powers your resume score, STAR prep, and coaching.' },
        { title: 'Your context', sub: 'We calibrate salaries, keywords, and urgency to your situation.' },
        { title: 'Add your resume', sub: 'Unlocks your ATS score, skills gap, and career roadmap.' },
      ];
      const handleSetupFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setResumeParsing(true);
        try {
          let text = '';
          if (file.name.toLowerCase().endsWith('.docx')) {
            const ab = await file.arrayBuffer();
            const { value } = await mammoth.extractRawText({ arrayBuffer: ab });
            text = value;
          } else {
            try {
              text = await extractTextFromPdfFile(file);
            } catch (_) {
              const ab = await file.arrayBuffer();
              const b64 = _ab2b64(ab);
              const raw = await callLLM([{ role: 'user', content: RESUME_EXTRACT_PROMPT }], 3000, b64);
              const parsed = extractJSON(raw);
              text = parsed.error ? '' : _formatParsedResume(parsed);
            }
          }
          if (text.trim()) {
            setResumeText(text);
          } else {
            showToast('Could not extract text — try a .docx file or paste your resume below.', 'error');
          }
        } catch {
          showToast('Could not read this file. Try a .docx or paste your resume below.', 'error');
        } finally {
          setResumeParsing(false);
        }
      };

      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", maxWidth: 560, margin: "0 auto", animation: "fadeIn 0.5s ease" }}>

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, boxShadow: `0 0 15px ${C.accent}`, animation: "pulse 2s ease infinite" }} />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, letterSpacing: "-1px", background: `linear-gradient(135deg, ${C.accent} 0%, #7B61FF 50%, ${C.pink} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CareerAiHub</span>
            </div>
            <div style={{ color: C.muted, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>The Career Acceleration OS</div>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div style={{ width: s === onboardStep ? 28 : 20, height: 8, borderRadius: 4, background: s === onboardStep ? C.accent : s < onboardStep ? C.green : C.border, transition: "all 0.2s ease" }} />
              </React.Fragment>
            ))}
          </div>

          {/* Card */}
          <div style={{ width: "100%", background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 32, boxShadow: `0 0 40px ${C.accent}0D` }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 18, marginBottom: 4 }}>{STEP_TITLES[onboardStep - 1].title}</div>
              <div style={{ color: C.muted, fontSize: 12 }}>{STEP_TITLES[onboardStep - 1].sub}</div>
            </div>

            {/* Step 1 — Target Role */}
            {onboardStep === 1 && (
              <div style={{ marginBottom: 20 }}>
                {/* Search-style role input */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 17, pointerEvents: 'none', userSelect: 'none' }}>🎯</span>
                  <input
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    placeholder="e.g. Senior Product Manager"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && form.role.trim() && setOnboardStep(2)}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(236,72,153,0.04)',
                      border: `1.5px solid ${form.role.trim() ? C.accent + '55' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 12, padding: '15px 16px 15px 46px',
                      fontSize: 15, color: C.text, fontFamily: 'inherit',
                      outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: form.role.trim() ? `0 0 24px ${C.accent}18` : 'none',
                    }}
                  />
                </div>
                {/* Role suggestion chips */}
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 700 }}>Popular roles</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {['Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer', 'Marketing Lead', 'Business Analyst', 'DevOps Engineer', 'Finance Analyst'].map(r => (
                    <button key={r} onClick={() => setForm(p => ({ ...p, role: r }))}
                      style={{
                        background: form.role === r ? `${C.accent}18` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${form.role === r ? C.accent + '55' : 'rgba(255,255,255,0.09)'}`,
                        borderRadius: 20, padding: '5px 13px', fontSize: 11.5,
                        color: form.role === r ? C.accent : C.muted,
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: form.role === r ? 700 : 400,
                        transition: 'all 0.15s',
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Industry + Level + Market + Urgency */}
            {onboardStep === 2 && (
              <>
                {/* Industry chips */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>Industry</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {INDUSTRIES.map(ind => (
                      <button key={ind} onClick={() => setForm(p => ({ ...p, industry: ind }))}
                        style={{
                          background: form.industry === ind ? `${C.accent}18` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${form.industry === ind ? C.accent + '55' : 'rgba(255,255,255,0.09)'}`,
                          borderRadius: 20, padding: '5px 13px', fontSize: 11.5,
                          color: form.industry === ind ? C.accent : C.muted,
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontWeight: form.industry === ind ? 700 : 400,
                          transition: 'all 0.15s',
                        }}>
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Experience level chips */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>Experience Level</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {LEVELS.map(l => (
                      <button key={l} onClick={() => setForm(p => ({ ...p, level: l }))}
                        style={{
                          background: form.level === l ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${form.level === l ? '#8B5CF6aa' : 'rgba(255,255,255,0.09)'}`,
                          borderRadius: 20, padding: '5px 13px', fontSize: 11.5,
                          color: form.level === l ? '#B89EFF' : C.muted,
                          cursor: 'pointer', fontFamily: 'inherit',
                          fontWeight: form.level === l ? 700 : 400,
                          transition: 'all 0.15s',
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Target market chips */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>Target Market</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {MARKETS.map(m => (
                      <button key={m} onClick={() => setForm(p => ({ ...p, market: m }))}
                        style={{
                          flex: 1, padding: '9px 4px', borderRadius: 10,
                          border: `1px solid ${form.market === m ? C.accent + '55' : 'rgba(255,255,255,0.09)'}`,
                          background: form.market === m ? `${C.accent}15` : 'rgba(255,255,255,0.03)',
                          color: form.market === m ? C.accent : C.muted,
                          fontSize: 11.5, fontWeight: form.market === m ? 700 : 400,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Timeline chips */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>Job Search Timeline</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {URGENCIES.map(u => (
                      <button key={u} onClick={() => setForm(p => ({ ...p, urgency: u }))}
                        style={{
                          flex: 1, padding: '9px 4px', borderRadius: 10,
                          border: `1px solid ${form.urgency === u ? '#FFB84Daa' : 'rgba(255,255,255,0.09)'}`,
                          background: form.urgency === u ? 'rgba(255,184,77,0.12)' : 'rgba(255,255,255,0.03)',
                          color: form.urgency === u ? '#FFB84D' : C.muted,
                          fontSize: 11, fontWeight: form.urgency === u ? 700 : 400,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                          lineHeight: 1.3, textAlign: 'center',
                        }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 3 — Resume */}
            {onboardStep === 3 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="setup-label" style={{ marginBottom: 0 }}>Resume Content</label>
                  <button
                    onClick={() => setResumeText(resumeText === null ? "" : null)}
                    style={{ background: "transparent", border: "none", color: C.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}
                  >
                    {resumeText === null ? "OR PASTE TEXT" : "UPLOAD FILE INSTEAD"}
                  </button>
                </div>
                {resumeText === null ? (
                  <div style={{ border: `2px dashed rgba(236,72,153,0.2)`, borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer", background: 'rgba(236,72,153,0.03)', transition: 'border-color 0.2s' }} onClick={() => document.getElementById('setup-file').click()}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(236,72,153,0.45)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(236,72,153,0.2)'}
                  >
                    <input type="file" id="setup-file" accept=".pdf,.docx" hidden onChange={handleSetupFile} />
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{resumeParsing ? '⏳' : '📄'}</div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{resumeParsing ? 'Extracting resume…' : 'Upload Resume (PDF or DOCX)'}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{resumeParsing ? 'This may take a few seconds' : 'Click to browse or drag & drop'}</div>
                  </div>
                ) : (
                  <textarea
                    value={typeof resumeText === 'string' ? resumeText : ""}
                    onChange={e => setResumeText(e.target.value)}
                    placeholder="Paste your full resume text here..."
                    style={{
                      width: '100%', boxSizing: 'border-box', minHeight: 140, resize: 'vertical',
                      background: 'rgba(236,72,153,0.03)', border: '1.5px solid rgba(236,72,153,0.15)',
                      borderRadius: 10, color: C.text, padding: '12px 14px', fontSize: 13,
                      fontFamily: 'inherit', outline: 'none', lineHeight: 1.6,
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(236,72,153,0.45)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(236,72,153,0.15)'}
                  />
                )}
              </div>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              {onboardStep > 1 && (
                <Btn onClick={() => setOnboardStep(s => s - 1)} color={C.border} style={{ flex: '0 0 auto', fontSize: 14, background: 'transparent', border: `1px solid ${C.border}` }}>← Back</Btn>
              )}
              {onboardStep < 3 ? (
                <Btn
                  onClick={() => setOnboardStep(s => s + 1)}
                  disabled={onboardStep === 1 && !form.role.trim()}
                  color={C.accent} dark
                  style={{ flex: 1, fontSize: 14 }}
                >Next →</Btn>
              ) : (
                <Btn
                  onClick={async () => {
                    const text = typeof resumeText === 'string' ? resumeText.trim() : '';
                    setSetupDone(true);
                    if (!text) return;
                    setProfileLoading(true);
                    try {
                      const prompt = `Extract a career profile from this resume. Return ONLY valid JSON, no markdown, no explanation:\n{"currentRole":"","yearsExp":0,"topSkills":[""],"headline":""}\n\nResume:\n${text.slice(0, 4000)}`;
                      const raw = await callLLM([{ role: 'user', content: prompt }], 800);
                      const snap = extractJSON(raw);
                      if (snap && !snap.error) {
                        setResumeProfile(snap);
                        if (!form.role.trim() && snap.currentRole) {
                          setForm(p => ({ ...p, role: snap.currentRole }));
                        }
                        showToast(`✓ Resume analyzed — ${snap.topSkills?.length || 0} skills found. Run ATS scan to get your score.`, 'success');
                      } else {
                        showToast('Resume uploaded. Paste a JD in ATS Scanner to get your score.', 'info');
                      }
                    } catch (err) {
                      console.error('[profileExtract]', err);
                      showToast('Resume saved. Run ATS scan to get started.', 'info');
                    } finally {
                      setProfileLoading(false);
                    }
                  }}
                  disabled={resumeParsing || (resumeText !== null && !resumeText?.trim())}
                  color={C.accent} dark
                  style={{ flex: 1, fontSize: 14 }}
                >{resumeParsing ? 'Extracting resume…' : 'Get started →'}</Btn>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
              {!user ? (
                <>
                  <button onClick={() => setAuthModal("login")} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 13, cursor: "pointer" }}>Sign In</button>
                  <span style={{ color: C.border }}>|</span>
                  <button onClick={() => setAuthModal("register")} style={{ background: "transparent", border: "none", color: C.accent, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create Account</button>
                </>
              ) : (
                <div style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>✓ Signed in as {user.name}</div>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="onboard-stats-grid">
            {[
              { stat: "75%", label: "rejection rate", color: C.red },
              { stat: "$18K", label: "salary gap", color: C.gold },
              { stat: "5 mo", label: "avg search", color: C.muted },
              { stat: "3.2×", label: "offer rate", color: C.green },
            ].map((p, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: p.color, marginBottom: 4 }}>{p.stat}</div>
                <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (isRestoring) return <AppLoader label="Restoring your session…" />;

    return (
      <div key={activeModule} style={{ animation: "fadeIn 0.4s ease" }}>
        {renderActiveModule()}
      </div>
    );
  };

  return (
    <div data-theme={darkMode ? "dark" : "light"} style={{ minHeight: "100vh", background: 'var(--lp-bg)', fontFamily: "var(--lp-ff, 'Inter', system-ui, sans-serif)", color: 'var(--lp-text)', '--card-bg': 'var(--lp-bg2)', '--card-bdr': 'rgba(236,72,153,0.09)' }}>
      
      {/* Modals */}
      {authModal && <AuthModal
        initialMode={authModal}
        onSuccess={login}
        onClose={() => setAuthModal(null)}
        onViewLegal={(m) => { navigate(m); setAuthModal(null); }}
      />}
      {cmdOpen && <CommandPalette modules={MODULES} setActiveModule={navigate} setAuthModal={setAuthModal} user={user} onClose={() => setCmdOpen(false)} />}
      {grModalOpen && (
        <StudyPlanModal
          onClose={() => setGrModalOpen(false)}
          initialTab={grModalTab}
          onModuleSelect={(moduleId) => { navigate(moduleId); setGrModalOpen(false); }}
        />
      )}
      
      {/* Sidebar + main — logged-in layout */}
      {user ? (
        <>
          <AppSidebar
            activeModule={activeModule}
            onNavigate={navigate}
            user={user}
            onLogout={logout}
            memory={memory}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(c => !c)}
          />
          <div className={`app-sidebar-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
            {/* Thin top bar: ⌘K + dark mode toggle */}
            <div className="desktop-topbar" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--lp-bg)', borderBottom: '1px solid var(--lp-bdr)', padding: '0 20px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDarkMode(d => !d)} title="Toggle theme" style={{ background: 'transparent', border: `1px solid var(--lp-bdr2)`, color: 'var(--lp-text2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>
                {darkMode ? 'Light' : 'Dark'}
              </button>
              <button onClick={() => setCmdOpen(true)} title="Command palette (⌘K)" style={{ background: 'transparent', border: `1px solid var(--lp-bdr2)`, color: 'var(--lp-text2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                ⌘K
              </button>
            </div>
            {renderMainContent()}
            <footer style={{ borderTop: `1px solid var(--lp-bdr)`, padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ color: 'var(--lp-text3)', fontSize: 11 }}>© 2026 CareerAiHub. All rights reserved.</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button onClick={() => navigate('privacy')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--lp-text3)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>Privacy</button>
                <button onClick={() => navigate('terms')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--lp-text3)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>Terms</button>
                <a href="mailto:hello@careeraihub.com" style={{ color: 'var(--lp-text3)', fontSize: 11, textDecoration: 'none', fontWeight: 600 }}>Support</a>
              </div>
            </footer>
          </div>
        </>
      ) : (
        /* Guest / landing layout */
        <>
          {!showLanding && setupDone && (
            <>
              <GuestNav onSignIn={() => setAuthModal('login')} onJoin={() => setAuthModal('register')} onHome={() => setShowLanding(true)} />
              <AppHubNav activeModule={activeModule} onNavigate={navigate} />
            </>
          )}
          {renderMainContent()}
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : toast.type === "success" ? C.green : C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 24px", color: (toast.type === "error" || toast.type === "success") ? "#000" : C.text, fontWeight: 800, fontSize: 13, zIndex: 1000, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", animation: "slideUp 0.3s ease", display: "flex", alignItems: "center", gap: 10 }}>
          <span>{toast.type === "error" ? "⚠️" : toast.type === "success" ? "✓" : "ℹ️"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default App;
