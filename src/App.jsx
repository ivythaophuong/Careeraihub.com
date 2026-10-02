import React, { useState, useEffect, useRef } from 'react';
import { sb } from './lib/supabase';
import { loadSession, saveSession, clearSession, getValidSession, refreshSession, isAuthRejection, REFRESH_SKEW_MS } from './lib/session';
import { C, MODULES } from './styles/theme';
import { Badge, Btn, Card, Spinner } from './components/CommonUI';
import { useMemory } from './hooks/useMemory';
import { useDevice } from './hooks/useDevice';
import BottomNav, { BOTTOM_NAV_HEIGHT } from './components/BottomNav';

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
import PrivacyPolicy from './features/Legal/PrivacyPolicy';
import TermsOfService from './features/Legal/TermsOfService';
import LandingPage, { GuestNav, ModulePills, PILLS, LogoMark, TickerBar } from './features/Landing/LandingPage';

// ── Original Overlay Components ──────────────────────────────────────────────
import { Ticker, UserMenu, AuthGate } from './components/OriginalUIOverlays';
import { AuthModal, CommandPalette } from './components/OriginalFeatures';

// ── Main App Shell ───────────────────────────────────────────────────────────
function App() {
  const [setupDone, setSetupDone] = useState(true);
  const [form, setForm] = useState({ role: "", industry: "", level: "Senior", market: "Singapore", urgency: "7 days" });
  const [user, setUser] = useState(null);
  const [activeModule, setActiveModule] = useState("jobs");
  const [authModal, setAuthModal] = useState(null);
  const [proModal, setProModal] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [toast, setToast] = useState(null);
  const { device, isMobile } = useDevice();
  const showBottomNav = isMobile && !!user;

  const [showLanding, setShowLanding] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const { memory, updateMemory, isSyncing } = useMemory(user, isRestoring, setIsRestoring, setRestoreError);
  
  // State is now fully managed by useMemory relational sync
  const resumeText = memory.resumeText || null;
  const scanResult = memory.scanResult || null;

  const setResumeText = (val) => updateMemory(m => ({ ...m, resumeText: val }));
  const setScanResult = (val) => updateMemory(m => ({ ...m, scanResult: val }));

  const userFromSession = (session) => {
    const userObj = session.user || {};
    const meta = userObj.user_metadata || {};
    return {
      id: userObj.id,
      email: userObj.email,
      name: meta.full_name || userObj.email?.split("@")[0] || "User",
      token: session.access_token,
      expiresAt: session.expiresAt ?? null,
    };
  };

  const handleSessionExpired = () => {
    clearSession();
    setUser(null);
    setSetupDone(false);
    setAuthModal("login");
    showToast("Your session expired. Please sign in again.", "error");
  };

  // Restore session (refreshing the token if it has expired or is about to)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!loadSession()) return;
      const session = await getValidSession();
      if (cancelled) return;
      if (!session) { handleSessionExpired(); return; }
      setUser(userFromSession(session));
      setIsRestoring(true); // Trigger composite fetch on session restore
      setSetupDone(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep the token fresh while the app is open so database calls don't start failing.
  useEffect(() => {
    if (!user?.expiresAt) return;
    let timer;
    const attempt = async () => {
      try {
        const next = await refreshSession(loadSession());
        setUser(u => (u ? { ...u, token: next.access_token, expiresAt: next.expiresAt } : u));
      } catch (e) {
        if (isAuthRejection(e)) handleSessionExpired();
        else timer = setTimeout(attempt, 30000); // network blip: try again shortly
      }
    };
    timer = setTimeout(attempt, Math.max(user.expiresAt - Date.now() - REFRESH_SKEW_MS, 5000));
    return () => clearTimeout(timer);
  }, [user?.expiresAt]);

  const login = (session) => {
    if (!session?.access_token) {
      // Sign-up that needs email confirmation returns no session.
      setAuthModal("login");
      showToast("Check your email to confirm your account, then sign in.", "info");
      return;
    }
    const saved = saveSession(session);
    setUser(userFromSession(saved));
    setIsRestoring(true); // Trigger composite fetch
    setAuthModal(null);
    setSetupDone(true);
    showToast("✓ Welcome back!", "success");
  };

  const logout = () => {
    const token = user?.token;
    clearSession();
    setUser(null);
    setSetupDone(false);
    Promise.resolve(sb.signOut(token)).catch(() => {}).finally(() => window.location.reload());
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

  const renderActiveModule = () => {
    const props = { 
      resumeText, setResumeText, scanResult, setScanResult, 
      form, memory, updateMemory, 
      onProTrigger: setProModal,
      user, setAuthModal, showToast, setActiveModule
    };
    
    switch (activeModule) {
      case "scan":     return <ResumeScan {...props} />;
      case "radar":    return <WeaknessRadar {...props} />;
      case "score":    return <ReadinessScore {...props} />;
      case "jd":       return <JDAnalyzer {...props} />;
      case "star":     return <STARBuilder {...props} />;
      case "simulate": return <HiringManagerSim {...props} />;
      case "salary":   return <SalaryCoach {...props} />;
      case "cover":    return <CoverLetterGen {...props} />;
      case "market":   return <MarketIntel {...props} />;
      case "jobs":     return <JobSearch {...props} />;
      case "memory":   return <MemoryDashboard {...props} />;
      case "ats":      return <ATSBuilder {...props} />;
      case "privacy":  return <PrivacyPolicy onBack={() => setActiveModule("jobs")} />;
      case "terms":    return <TermsOfService onBack={() => setActiveModule("jobs")} />;
      default:         return <ResumeScan {...props} />;
    }
  };

  // ── 3. Render Helper ───────────────────────────────────────────────────────
  const goToModule = (moduleId) => {
    setActiveModule(moduleId);
    setShowLanding(false);
  };

  const renderMainContent = () => {

    if (!user && showLanding) return <LandingPage setAuthModal={setAuthModal} onModuleSelect={goToModule} />;

    if (!setupDone) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", maxWidth: 600, margin: "0 auto", animation: "fadeIn 0.5s ease" }}>
          
          {/* Logo (Onboarding version) */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, boxShadow: `0 0 15px ${C.accent}`, animation: "pulse 2s ease infinite" }} />
              <span style={{ 
                fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, letterSpacing: "-1px",
                background: `linear-gradient(135deg, ${C.accent} 0%, #7B61FF 50%, ${C.pink} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>CareerAiHub</span>
            </div>
            <div style={{ color: C.muted, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>The Career Acceleration OS</div>
          </div>

          {/* Form Card */}
          <div style={{ width: "100%", background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 16, padding: 32, boxShadow: `0 0 40px ${C.accent}0D` }}>
            <div style={{ marginBottom: 24 }}>
               <div style={{ color: C.text, fontWeight: 900, fontSize: 18, marginBottom: 4 }}>Build your personalized system</div>
               <div style={{ color: C.muted, fontSize: 12 }}>Takes 30 seconds. Powers every AI module.</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="setup-label">Target Role</label>
              <input 
                className="setup-input" 
                value={form.role} 
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))} 
                placeholder="e.g. Senior Software Engineer, Product Lead" 
              />
            </div>

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
                <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center", cursor: "pointer" }} onClick={() => document.getElementById('setup-file').click()}>
                  <input type="file" id="setup-file" hidden onChange={async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setResumeText("Parsing file..."); 
                      setResumeText(`Content of ${file.name} (simulated)`);
                    }
                  }} />
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>Upload your Resume (PDF/DOCX)</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>We extract your full career history automatically</div>
                </div>
              ) : (
                <textarea 
                  className="setup-input"
                  style={{ minHeight: 120, resize: "vertical" }}
                  value={typeof resumeText === 'string' ? resumeText : ""}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here..."
                />
              )}
            </div>

            <Btn onClick={() => setSetupDone(true)} disabled={!form.role.trim() || (resumeText === null ? false : !resumeText?.trim())} color={C.accent} dark style={{ width: "100%", fontSize: 14 }}>⚡ Scan my resume to begin →</Btn>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 32, width: "100%" }}>
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

    return (
      <>
        {/* Ticker */}
        <TickerBar />

        {restoreError && (
          <div role="alert" style={{ maxWidth: 1200, margin: "12px auto 0", padding: "10px 16px", background: `${C.red}14`, border: `1px solid ${C.red}55`, borderRadius: 10, color: C.text, fontSize: 13, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 220 }}>We couldn't load your saved data, so changes are <strong>not being saved</strong> right now. Your existing data is untouched.</span>
            <Btn color={C.red} onClick={() => { setRestoreError(false); setIsRestoring(true); }} style={{ padding: "6px 16px", fontSize: 12 }}>Retry</Btn>
          </div>
        )}

        {/* Content Wrapper */}
        <div className="app-container" style={{ animation: "fadeIn 0.4s ease" }}>
          <div key={activeModule}>
            {renderActiveModule()}
          </div>
        </div>
      </>
    );
  };

  return (
    <div data-theme={darkMode ? "dark" : "light"} data-device={device} style={{ "--bottom-nav-h": showBottomNav ? `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` : "0px", paddingBottom: "var(--bottom-nav-h)", minHeight: "100dvh", background: darkMode ? C.bg : "#F8FAFC", fontFamily: "var(--font-body)", color: darkMode ? C.text : "#0F172A" }}>
      
      {/* Modals */}
      {authModal && <AuthModal 
        initialMode={authModal} 
        onSuccess={login} 
        onClose={() => setAuthModal(null)} 
        onViewLegal={(m) => { setActiveModule(m); setAuthModal(null); }}
      />}
      {cmdOpen && <CommandPalette modules={MODULES} setActiveModule={setActiveModule} setAuthModal={setAuthModal} user={user} onClose={() => setCmdOpen(false)} />}
      
      {/* Guest nav — landing page style, shown when browsing modules without an account */}
      {!user && !showLanding && (
        <>
          <GuestNav
            onSignIn={() => setAuthModal('login')}
            onJoin={() => setAuthModal('register')}
            onHome={() => setShowLanding(true)}
          />
          <ModulePills
            active={PILLS.findIndex(p => p.moduleId === activeModule)}
            setActive={(i) => { setActiveModule(PILLS[i].moduleId); }}
          />
        </>
      )}

      {/* App header — only shown when logged in */}
      {user && <>
        <nav className="lp-nav scrolled">
          <button className="lp-nav-logo" onClick={() => setActiveModule("jobs")}>
            <LogoMark size={26} radius={7} />
            CareerAiHub
          </button>
          <div className="lp-nav-r">
            <button onClick={() => setDarkMode(d => !d)} title="Toggle light/dark mode" style={{ background: "transparent", border: `1px solid var(--lp-bdr2)`, color: "var(--lp-text2)", borderRadius: 6, padding: "4px 8px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            {!isMobile && <button onClick={() => setCmdOpen(true)} title="Command palette (⌘K)" style={{ background: "transparent", border: `1px solid var(--lp-bdr2)`, color: "var(--lp-text2)", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              ⌘K
            </button>}
            <UserMenu user={user} onLogout={logout} />
          </div>
        </nav>
        {!isMobile && <div className="lp-mod-nav">
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setActiveModule(m.id)} className={`lp-mpill${activeModule === m.id ? " on" : ""}`}>
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>}
      </>}

      {showBottomNav && <BottomNav activeModule={activeModule} setActiveModule={setActiveModule} onOpenLegal={setActiveModule} />}

      {/* Main Content Area */}
      {renderMainContent()}

      {/* Trust Footer — only shown when logged in */}
      {user && <footer style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, padding: "20px clamp(12px, 3vw, 24px)", background: C.surface }}>
        <div className="app-footer-inner" style={{ margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ color: C.muted, fontSize: 11 }}>© 2026 CareerAiHub. All rights reserved.</div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <button onClick={() => setActiveModule("privacy")} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, fontSize: 11, textDecoration: "none", fontWeight: 600 }}>Privacy Policy</button>
            <button onClick={() => setActiveModule("terms")} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, fontSize: 11, textDecoration: "none", fontWeight: 600 }}>Terms of Service</button>
            <a href="mailto:hello@careeraihub.com" style={{ color: C.muted, fontSize: 11, textDecoration: "none", fontWeight: 600 }}>Support & Trust</a>
          </div>
        </div>
      </footer>}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: "calc(var(--bottom-nav-h, 0px) + 24px)", left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? C.red : toast.type === "success" ? C.green : C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 24px", color: (toast.type === "error" || toast.type === "success") ? "#000" : C.text, fontWeight: 800, fontSize: 13, zIndex: 1000, boxShadow: "0 10px 30px rgba(0,0,0,0.4)", animation: "slideUp 0.3s ease", display: "flex", alignItems: "center", gap: 10 }}>
          <span>{toast.type === "error" ? "⚠️" : toast.type === "success" ? "✓" : "ℹ️"}</span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default App;
