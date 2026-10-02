import React from 'react';
import { C } from '../styles/theme';

export const Card = ({ children, glow, style, animate, onClick }) => (
  <div 
    onClick={onClick}
    style={{
      background: C.surface,
      border: `1px solid ${glow || C.border}`,
      borderRadius: 12,
      padding: "16px 18px",
      boxShadow: glow ? `0 0 28px ${glow}22` : "none",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      animation: animate ? "fadeIn 0.3s ease" : "none",
      ...style
    }}
  >
    {children}
  </div>
);

export const Badge = ({ label, color }) => (
  <span style={{
    background: `${color}15`,
    color: color,
    border: `1px solid ${color}33`,
    borderRadius: 20,
    padding: "2px 9px",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase"
  }}>
    {label}
  </span>
);

export const Btn = ({ children, onClick, disabled, color, dark, style }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? C.border : (dark ? `linear-gradient(135deg,${color},#0096CC)` : `${color}18`),
      color: disabled ? C.muted : (dark ? "#000" : color),
      border: disabled ? "none" : (dark ? "none" : `1px solid ${color}44`),
      borderRadius: 8,
      padding: "10px 24px",
      fontSize: 13,
      fontWeight: 900,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit",
      boxShadow: (dark && !disabled) ? `0 0 28px ${color}44` : "none",
      transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      outline: "none",
      ...style
    }}
  >
    {children}
  </button>
);

export const Spinner = ({ label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 20 }}>
    <div className="spinner" />
    {label && <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>}
  </div>
);

export const EmptyState = ({ icon, title, desc, cta, onCta, ctaColor = C.accent }) => (
  <div style={{ textAlign: "center", padding: "40px 24px", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 16 }}>
    <div style={{ fontSize: 44, marginBottom: 18 }}>{icon}</div>
    <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{title}</div>
    <div style={{ color: C.muted, fontSize: 12, marginBottom: 24, maxWidth: 300, margin: "0 auto 24px", lineHeight: 1.6 }}>{desc}</div>
    {cta && <Btn onClick={onCta} color={ctaColor} dark style={{ margin: "0 auto" }}>{cta}</Btn>}
  </div>
);
