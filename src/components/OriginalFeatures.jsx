import React, { useState, useEffect, useRef } from 'react';
import { sb } from '../lib/supabase';
import { sessionFromAuthResponse } from '../lib/session';
import { C, MODULES } from '../styles/theme';
import { Badge, Btn, Card, Spinner } from './CommonUI';

// ── Animated Score Counter ─────────────────────────────────────────────────────
export function AnimatedScore({ value, color, size = "large", suffix = "/100", prefix = "" }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    const duration = 1400;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * target));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value]);
  const fontSize = size === "large" ? 80 : size === "medium" ? 52 : 36;
  const unitSize = size === "large" ? 22 : size === "medium" ? 16 : 13;
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      {prefix && <span style={{ fontSize: unitSize, color, fontWeight: 700, opacity: 0.7 }}>{prefix}</span>}
      <span style={{ fontSize, color, fontWeight: 900, fontFamily: "var(--font-display)", textShadow: `0 0 40px ${color}44`, letterSpacing: "-2px" }}>
        {display}
      </span>
      {suffix && <span style={{ fontSize: unitSize, color, fontWeight: 600, opacity: 0.6 }}>{suffix}</span>}
    </div>
  );
}

// ── GlowBar (Radar component) ──────────────────────────────────────────────────
export function GlowBar({ score, color, delay = 0, height = 8, showLabel = true }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(score), 100 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ background: "#0A1020", borderRadius: 4, height, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 4, transition: `width 1.1s cubic-bezier(0.16,1,0.3,1) ${delay}ms`, boxShadow: `0 0 10px ${color}44` }} />
      </div>
      {showLabel && <div style={{ position: "absolute", right: 0, top: -18, fontFamily: "var(--font-mono)", fontSize: 10, color, fontWeight: 700 }}>{w}%</div>}
    </div>
  );
}

// ── Command Palette (⌘K) ─────────────────────────────────────────────────────
export function CommandPalette({ modules, setActiveModule, setAuthModal, user, onClose }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const commands = [
    ...modules.map(m => ({ type: "module", icon: m.icon, label: m.label, id: m.id, desc: `Open ${m.label}` })),
    { type: "action", icon: "✨", label: "Sign Up Free", id: "signup", desc: "Create your free account" },
    { type: "action", icon: "🔑", label: "Sign In", id: "signin", desc: "Sign in to your account" },
  ].filter(c => {
    if (c.id === "signup" || c.id === "signin") return !user;
    return true;
  });
  const filtered = q.trim() ? commands.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : commands;
  const [sel, setSel] = useState(0);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const run = (cmd) => {
    if (cmd.type === "module") setActiveModule(cmd.id);
    else if (cmd.id === "signup") setAuthModal("register");
    else if (cmd.id === "signin") setAuthModal("login");
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(9,12,18,0.92)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120, backdropFilter: "blur(12px)", animation: "fadeIn 0.15s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#0F1520", border: "1px solid #1E2D45", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #1E2D45" }}>
          <span style={{ color: "#6B7E9F", fontSize: 16 }}>⌘</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search modules, actions..." style={{ flex: 1, background: "transparent", border: "none", color: "#E8F0FE", fontSize: 15, fontFamily: "var(--font-mono)", outline: "none" }} />
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px" }}>
          {filtered.map((cmd, i) => (
            <div key={cmd.id} onClick={() => run(cmd)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 8, cursor: "pointer", background: i === sel ? "#131B2A" : "transparent" }} onMouseEnter={() => setSel(i)}>
              <span style={{ fontSize: 18 }}>{cmd.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#E8F0FE", fontSize: 13, fontWeight: 600 }}>{cmd.label}</div>
                <div style={{ color: "#6B7E9F", fontSize: 11 }}>{cmd.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Auth Modal (Standardized Original UI) ────────────────────────────────────
export function AuthModal({ initialMode, onSuccess, onClose, onViewLegal }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [accountType, setAccountType] = useState("candidate");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (mode === "register") {
        const signupSource = localStorage.getItem('careerai_signup_source') || 'organic';
        const { data, error } = await sb.signUp(email, pass, name, { role: accountType, company: accountType === 'recruiter' ? company : null, source: signupSource, is_beta: signupSource !== 'organic' });
        if (error) throw error;
        if (!data?.user) throw new Error("Registration started. Please check your email for confirmation.");
        const session = sessionFromAuthResponse(data);
        if (!session) throw new Error("Registration started. Please check your email for confirmation.");
        onSuccess(session);
      } else {
        const { data, error } = await sb.signIn(email, pass);
        if (error) throw error;
        if (!data?.user) throw new Error("Could not retrieve user data.");
        const session = sessionFromAuthResponse(data);
        if (!session) throw new Error("Could not start your session. Please try again.");
        onSuccess(session);
      }
    } catch (err) { setErr(err.message); } finally { setLoading(false); }
  };

  const modeConfig = {
    login: { 
      title: "Welcome Back", 
      sub: "Sign in to access your AI memory", 
      btn: "Sign In", 
      toggle: "Don't have an account? Sign up", 
      mode: "register" 
    },
    register: { 
      title: "Start Your Journey", 
      sub: "Create your career operating system", 
      btn: "Create Account", 
      toggle: "Already have an account? Sign in", 
      mode: "login" 
    }
  };

  const config = modeConfig[mode];

  const LP = {
    bg:      '#07090F',
    card:    'rgba(10,15,28,0.98)',
    border:  'rgba(236,72,153,0.13)',
    borderFocus: 'rgba(236,72,153,0.45)',
    inputBg: 'rgba(236,72,153,0.03)',
    text:    '#E8F0FE',
    muted:   '#6B7E9F',
    teal:    '#EC4899',
    red:     '#FF4757',
    surface: 'rgba(255,255,255,0.04)',
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: LP.inputBg, border: `1.5px solid ${LP.border}`,
    borderRadius: 10, color: LP.text, padding: '12px 14px',
    fontSize: 14, outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,7,14,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(16px)', animation: 'fadeIn 0.18s ease-out' }}>
      <div style={{ background: LP.card, border: `1px solid ${LP.border}`, borderRadius: 22, padding: '38px 32px 32px', width: '100%', maxWidth: 420, boxShadow: `0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(236,72,153,0.06), 0 0 80px rgba(236,72,153,0.05)`, position: 'relative', backdropFilter: 'blur(20px)' }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', right: 18, top: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: LP.muted, cursor: 'pointer', fontSize: 16, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 0.15s' }}>×</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 14, background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 100, padding: '5px 14px 5px 10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: LP.teal, boxShadow: `0 0 8px ${LP.teal}`, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: LP.teal, letterSpacing: '0.06em', textTransform: 'uppercase' }}>CareerAiHub</span>
          </div>
          <div style={{ fontSize: 23, fontWeight: 900, color: LP.text, marginBottom: 5, fontFamily: 'inherit', letterSpacing: '-0.4px', lineHeight: 1.2 }}>{config.title}</div>
          <div style={{ fontSize: 13, color: LP.muted, lineHeight: 1.5 }}>{config.sub}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <>
              {/* Account type toggle */}
              <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: `1px solid ${LP.border}` }}>
                {[['candidate', '🎯 Job Seeker'], ['recruiter', '🏢 Employer']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setAccountType(val)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .18s',
                      background: accountType === val ? (val === 'recruiter' ? 'linear-gradient(135deg,#9333EA,#E040FB)' : `linear-gradient(135deg,${LP.teal},#0096CC)`) : 'transparent',
                      color: accountType === val ? (val === 'recruiter' ? '#fff' : '#06090F') : LP.muted,
                      boxShadow: accountType === val ? (val === 'recruiter' ? '0 4px 16px rgba(147,51,234,0.3)' : `0 4px 16px rgba(236,72,153,0.25)`) : 'none' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <div style={{ color: LP.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Full Name</div>
                <input placeholder="Your full name" value={name} onChange={e => { setName(e.target.value); setErr(''); }} required style={inputStyle} onFocus={e => { e.target.style.borderColor = LP.borderFocus; e.target.style.boxShadow = `0 0 0 3px rgba(236,72,153,0.08)`; }} onBlur={e => { e.target.style.borderColor = LP.border; e.target.style.boxShadow = 'none'; }} />
              </div>

              {accountType === 'recruiter' && (
                <div>
                  <div style={{ color: LP.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Company Name</div>
                  <input placeholder="e.g. Acme Corp" value={company} onChange={e => { setCompany(e.target.value); setErr(''); }} required style={inputStyle} onFocus={e => { e.target.style.borderColor = LP.borderFocus; e.target.style.boxShadow = `0 0 0 3px rgba(236,72,153,0.08)`; }} onBlur={e => { e.target.style.borderColor = LP.border; e.target.style.boxShadow = 'none'; }} />
                </div>
              )}
            </>
          )}

          <div>
            <div style={{ color: LP.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Email Address</div>
            <input type="email" placeholder="you@email.com" value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} required style={inputStyle} onFocus={e => { e.target.style.borderColor = LP.borderFocus; e.target.style.boxShadow = `0 0 0 3px rgba(236,72,153,0.08)`; }} onBlur={e => { e.target.style.borderColor = LP.border; e.target.style.boxShadow = 'none'; }} />
          </div>

          <div>
            <div style={{ color: LP.muted, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 700 }}>Password</div>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={pass} onChange={e => { setPass(e.target.value); setErr(''); }} required style={{ ...inputStyle, paddingRight: 42 }} onFocus={e => { e.target.style.borderColor = LP.borderFocus; e.target.style.boxShadow = `0 0 0 3px rgba(236,72,153,0.08)`; }} onBlur={e => { e.target.style.borderColor = LP.border; e.target.style.boxShadow = 'none'; }} />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: LP.muted, cursor: 'pointer', fontSize: 13 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {err && <div style={{ color: LP.red, fontSize: 12, textAlign: 'center', background: `${LP.red}12`, padding: '9px 12px', borderRadius: 9, border: `1px solid ${LP.red}30` }}>⚠ {err}</div>}

          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg,${LP.teal},#0086BB)`, color: loading ? LP.muted : '#04080F', border: 'none', borderRadius: 11, padding: '14px', fontWeight: 900, fontSize: 14, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 6, transition: 'all 0.2s', boxShadow: loading ? 'none' : `0 6px 24px rgba(236,72,153,0.25)`, letterSpacing: '0.01em' }}>
            {loading ? 'Connecting…' : config.btn + ' →'}
          </button>

          {mode === 'register' && (
            <div style={{ fontSize: 11, color: LP.muted, textAlign: 'center', marginTop: 8, lineHeight: 1.6 }}>
              By creating an account, you agree to our{' '}
              <span onClick={() => onViewLegal('terms')} style={{ color: LP.teal, fontWeight: 700, cursor: 'pointer' }}>Terms</span>
              {' '}and{' '}
              <span onClick={() => onViewLegal('privacy')} style={{ color: LP.teal, fontWeight: 700, cursor: 'pointer' }}>Privacy Policy</span>.
            </div>
          )}
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'login' && (
            <button onClick={() => setErr("Password reset isn't available yet.")} style={{ background: 'transparent', border: 'none', color: LP.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
              Forgot your password?
            </button>
          )}
          <button onClick={() => { setMode(config.mode); setErr(''); }} style={{ background: 'transparent', border: 'none', color: LP.muted, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {config.toggle.split('?')[0]}?{' '}
            <span style={{ color: LP.teal, fontWeight: 700 }}>{config.toggle.split('?')[1]} →</span>
          </button>
        </div>

      </div>
    </div>
  );
}
