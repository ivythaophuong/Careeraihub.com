import React from 'react';

// Shared look of the Job Hunt screens (see jobhunt.css). The dark cards keep the same palette in light mode, like the rest of the app.
export const SOFT = '#9FB0CC'; // secondary text that stays readable on the dark cards
export const GRAD = 'linear-gradient(135deg,#EC4899,#38BDF8)';
export const STAGE_COLOR = { saved: '#8B9BB8', applied: '#A78BFA', noreply: '#F59E0B', interviewing: '#38BDF8', offer: '#00D484', closed: '#FB7185' };

const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 20px', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, textDecoration: 'none', cursor: 'pointer', boxSizing: 'border-box' };

// Main action: the platform's pink-to-sky gradient.
export function GradBtn({ children, onClick, disabled, style, className = '', ...rest }) {
  return (
    <button
      type="button" className={`jh-btn ${className}`} onClick={onClick} disabled={disabled}
      style={{ ...base, border: 'none', fontWeight: 800, background: disabled ? '#1B2740' : GRAD, color: disabled ? '#6B7E9F' : '#07101C', cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      {...rest}
    >{children}</button>
  );
}

// Secondary action: outline on the dark card.
export function GhostBtn({ children, onClick, disabled, color = '#E8F0FE', border = '#3A3560', style, className = '', ...rest }) {
  return (
    <button
      type="button" className={`jh-btn ${className}`} onClick={onClick} disabled={disabled}
      style={{ ...base, fontWeight: 700, background: 'transparent', color: disabled ? '#6B7E9F' : color, border: `1px solid ${disabled ? '#1E2D45' : border}`, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      {...rest}
    >{children}</button>
  );
}

export const Eyebrow = ({ children, color = SOFT, style }) => (
  <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color, ...style }}>{children}</div>
);
