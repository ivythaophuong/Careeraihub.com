import React from 'react';
import { C } from '../styles/theme';
import { OrbitSpinner } from './OrbitMark';

export const Card = ({ children, glow, style, animate, onClick }) => (
  <div
    className="ui-card"
    onClick={onClick}
    style={{
      background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 100%), var(--card-bg, ${C.surface})`,
      border: `1px solid ${glow || 'var(--card-bdr, rgba(255,255,255,0.1))'}`,
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
      ...style
    }}
  >
    {children}
  </button>
);

export const Spinner = ({ label, size = 32 }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 20 }}>
    <OrbitSpinner size={size} />
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

export const NextStepBanner = ({ message, cta, onClick, onDismiss }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: `${C.green}12`, border: `1px solid ${C.green}40`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
    <div style={{ fontSize: 16, flexShrink: 0 }}>✓</div>
    <div style={{ flex: 1, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{message}</div>
    {cta && onClick && (
      <button onClick={onClick} style={{ background: C.green, border: 'none', color: '#000', borderRadius: 6, padding: '6px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {cta}
      </button>
    )}
    {onDismiss && (
      <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
    )}
  </div>
);
