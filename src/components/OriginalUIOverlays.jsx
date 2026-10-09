import React, { useState, useEffect, useRef } from 'react';
import { C, MODULES } from '../styles/theme';
import { Card, Btn, Spinner, Badge } from '../components/CommonUI';

// ── Ticker ───────────────────────────────────────────────────────────────────
export const Ticker = ({ text }) => (
  <div style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
    <div style={{ display: "inline-block", animation: "ticker 35s linear infinite", paddingRight: "50px" }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 2, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>{text} — {text}</span>
    </div>
  </div>
);

export const AuthGate = ({ children, user, setAuthModal }) => {
  if (user) return children;
  return (
    <div style={{ position: "relative", minHeight: 400 }}>
      {/* Blurred Feature Preview */}
      <div style={{ filter: "blur(14px)", pointerEvents: "none", opacity: 0.35, userSelect: "none" }}>
        {children}
      </div>
      
      {/* Auth Overlay */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
        <Card style={{ textAlign: "center", padding: "48px 32px", border: `1px solid ${C.accent}44`, background: `${C.card}EE`, backdropFilter: "blur(24px)", maxWidth: 420, boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 50px ${C.accent}15` }}>
          <div style={{ fontSize: 52, marginBottom: 24, filter: `drop-shadow(0 0 15px ${C.accent}44)` }}>🔒</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 26, color: C.text, marginBottom: 12, letterSpacing: "-0.5px" }}>Upgrade your career OS</div>
          <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 32 }}>Sign up to save your scan history, build your STAR bank, and unlock professional negotiation scripts.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Btn onClick={() => setAuthModal("register")} color={C.accent} dark style={{ width: "100%", padding: 16, fontSize: 15, fontWeight: 900 }}>⚡ Create Free Account</Btn>
            <button onClick={() => setAuthModal("login")} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}>Already have an account? Sign In</button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ── User Menu (Header component) ──────────────────────────────────────────
export const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ 
          display: "flex", alignItems: "center", gap: 8, background: C.surface, 
          border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" 
        }}
      >
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg,${C.accent},${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#000" }}>
          {user?.avatar || "U"}
        </div>
        <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>{user?.name?.split(" ")[0]}</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, zIndex: 1000, minWidth: 120, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "8px 12px", color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>Account</div>
          <div onClick={onLogout} style={{ padding: "8px 12px", color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 4 }}>Sign Out</div>
        </div>
      )}
    </div>
  );
};
