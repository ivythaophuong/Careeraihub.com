import React, { useState } from 'react';
import { LogoMark } from '../features/Landing/LandingPage';

// ── SVG icon set — 16×16 viewBox, stroke-based ───────────────────────────────
function Icon({ id, size = 15, color = 'currentColor' }) {
  const s = { width: size, height: size, display: 'block', flexShrink: 0 };
  const p = { fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'dashboard':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><rect {...p} x="1" y="1" width="6" height="6" rx="1.2"/><rect {...p} x="9" y="1" width="6" height="6" rx="1.2"/><rect {...p} x="1" y="9" width="6" height="6" rx="1.2"/><rect {...p} x="9" y="9" width="6" height="6" rx="1.2"/></svg>;
    case 'ats':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><path {...p} d="M3 2h7l3 3v9H3V2z"/><path {...p} d="M10 2v3h3"/><path {...p} d="M5 7h6M5 10h4"/></svg>;
    case 'scan':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><path {...p} d="M1 5V3a2 2 0 012-2h2M11 1h2a2 2 0 012 2v2M15 11v2a2 2 0 01-2 2h-2M5 15H3a2 2 0 01-2-2v-2"/><circle {...p} cx="8" cy="8" r="2.5"/></svg>;
    case 'cover':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><rect {...p} x="1" y="3" width="14" height="10" rx="1.5"/><path {...p} d="M1 5l7 5 7-5"/></svg>;
    case 'simulate':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><circle {...p} cx="8" cy="8" r="6.5"/><path {...p} d="M5.5 6c0-1.1.9-2 2.5-2s2.5.9 2.5 2c0 1.5-2.5 2-2.5 3.5"/><circle fill={color} stroke="none" cx="8" cy="12" r=".8"/></svg>;
    case 'salary':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><circle {...p} cx="8" cy="8" r="6.5"/><path {...p} d="M8 4.5v7M6 6.5c0-.9.9-1.5 2-1.5s2 .7 2 1.5S9 8 8 8s-2 .6-2 1.5S6.9 11 8 11s2-.6 2-1.5"/></svg>;
    case 'skillsgap':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><path {...p} d="M1 13l4-5 3 3 3-4 4-3"/><circle {...p} cx="1" cy="13" r=".8"/></svg>;
    case 'roadmap':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><circle {...p} cx="3" cy="13" r="1.5"/><circle {...p} cx="8" cy="3" r="1.5"/><circle {...p} cx="13" cy="9" r="1.5"/><path {...p} d="M3 11.5V7l5-3.5M8 4.5l5 4"/></svg>;
    case 'verify':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><path {...p} d="M8 1L2 4v4c0 3.5 2.7 6.2 6 7 3.3-.8 6-3.5 6-7V4L8 1z"/><path {...p} d="M5.5 8l2 2 3-3"/></svg>;
    case 'trustmatch':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><path {...p} d="M5 8.5C5 7.1 6.1 6 7.5 6S10 7.1 10 8.5V10H5V8.5z"/><path {...p} d="M1 14v-1.5C1 11.1 2.3 10 4 10M15 14v-1.5C15 11.1 13.7 10 12 10M4 7.5A2 2 0 104 3.5M12 7.5A2 2 0 1012 3.5"/></svg>;
    case 'aichat':
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><rect {...p} x="1" y="2" width="14" height="9" rx="2"/><path {...p} d="M4 14l2-3M12 14l-2-3"/><path {...p} d="M5 6.5h6M5 8.5h4"/></svg>;
    default:
      return <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" style={s}><circle {...p} cx="8" cy="8" r="6"/></svg>;
  }
}

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard',     badge: null      },
    ],
  },
  {
    label: 'Get Seen',
    items: [
      { id: 'ats',   label: 'Resume Builder',  badge: 'live' },
      { id: 'scan',  label: 'ATS Scanner',     badge: 'live' },
      { id: 'cover', label: 'Cover Letter AI', badge: 'new'  },
    ],
  },
  {
    label: 'Get Ready',
    items: [
      { id: 'simulate',  label: 'Interview Coach', badge: 'live' },
      { id: 'salary',    label: 'Salary Prep',     badge: 'live' },
      { id: 'skillsgap', label: 'Skills Gap',      badge: 'new'  },
      { id: 'roadmap',   label: 'Career Roadmap',  badge: 'new'  },
    ],
  },
  {
    label: 'Get Verified',
    items: [
      { id: 'verify', label: 'Verify Creds', badge: 'dev' },
    ],
  },
  {
    label: 'Get Matched',
    items: [
      { id: 'trustmatch', label: 'TrustMatch',     badge: 'planned' },
      { id: 'aichat',     label: 'AI Career Coach', badge: 'new'    },
    ],
  },
];

const BADGE_CLASS  = { live: 'snb-live', new: 'snb-new', dev: 'snb-dev', planned: 'snb-planned' };
const BADGE_LABEL  = { live: 'Live', new: 'New', dev: 'In dev', planned: 'Planned' };

const INTERVIEW_COACH_IDS = ['simulate', 'star', 'radar', 'score', 'memory'];
const MOBILE_ITEMS        = ['dashboard', 'scan', 'simulate', 'trustmatch', 'aichat'];

function initials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const MOB_PRIMARY = [
  { id: 'dashboard', label: 'Home' },
  { id: 'jobs',      label: 'Jobs' },
  { id: 'scan',      label: 'Scan' },
  { id: 'star',      label: 'STAR' },
];

const MOB_DRAWER_TOOLS = [
  { id: 'simulate',   label: 'Interviews'  },
  { id: 'salary',     label: 'Salary'      },
  { id: 'cover',      label: 'Cover'       },
  { id: 'ats',        label: 'ATS Builder' },
  { id: 'radar',      label: 'Radar'       },
  { id: 'score',      label: 'Readiness'   },
  { id: 'market',     label: 'Market'      },
  { id: 'memory',     label: 'Memory'      },
  { id: 'jd',         label: 'JD Analyzer' },
  { id: 'trustmatch', label: 'TrustMatch'  },
  { id: 'verify',     label: 'Verify'      },
  { id: 'aichat',     label: 'AI Coach'    },
];

const MOB_DRAWER_IDS = new Set(MOB_DRAWER_TOOLS.map(t => t.id));

function getMobActiveIdx(moduleId, moreOpen) {
  if (moreOpen || MOB_DRAWER_IDS.has(moduleId)) return 4;
  const idx = MOB_PRIMARY.findIndex(t => t.id === moduleId);
  return idx >= 0 ? idx : 0;
}

function MobNavIcon({ id, active }) {
  const col = active ? '#00D484' : '#5a6e8a';
  const p = { fill: 'none', stroke: col, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const s = { width: 18, height: 18, display: 'block' };
  switch (id) {
    case 'dashboard': return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><path {...p} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline {...p} points="9 22 9 12 15 12 15 22"/></svg>;
    case 'jobs':      return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><rect {...p} x="2" y="7" width="20" height="14" rx="2"/><path {...p} d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>;
    case 'scan':      return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><path {...p} d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline {...p} points="14 2 14 8 20 8"/><line {...p} x1="16" y1="13" x2="8" y2="13"/><line {...p} x1="16" y1="17" x2="8" y2="17"/></svg>;
    case 'star':      return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><polygon {...p} points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'more':      return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><line {...p} x1="8" y1="6" x2="21" y2="6"/><line {...p} x1="8" y1="12" x2="21" y2="12"/><line {...p} x1="8" y1="18" x2="21" y2="18"/><line {...p} x1="3" y1="6" x2="3.01" y2="6"/><line {...p} x1="3" y1="12" x2="3.01" y2="12"/><line {...p} x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    default:          return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" style={s}><circle {...p} cx="12" cy="12" r="9"/></svg>;
  }
}

export default function AppSidebar({ activeModule, onNavigate, user, onLogout, collapsed, onToggle }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const allItems   = NAV_GROUPS.flatMap(g => g.items);
  const mobileItems = allItems.filter(i => MOBILE_ITEMS.includes(i.id));
  const mobActiveIdx = getMobActiveIdx(activeModule, moreOpen);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className={`app-sidebar${collapsed ? ' collapsed' : ''}`}>
        {/* Logo + collapse toggle */}
        <div className="app-sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <LogoMark size={26} />
            <div className="app-sidebar-logo-name">CareerAiHub</div>
          </div>
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, flexShrink: 0,
              background: 'transparent', border: '1px solid var(--lp-bdr)',
              borderRadius: 6, color: 'var(--lp-text3)', cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--lp-text)'; e.currentTarget.style.borderColor = 'var(--lp-bdr2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--lp-text3)'; e.currentTarget.style.borderColor = 'var(--lp-bdr)'; }}
          >
            <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="M6 3l5 5-5 5"/> : <path d="M10 3L5 8l5 5"/>}
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="app-sidebar-nav" aria-label="Main">
          {NAV_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {group.label && (
                <div className="app-sidebar-sep">{group.label}</div>
              )}
              {group.items.map(item => {
                const active = activeModule === item.id || (item.id === 'simulate' && INTERVIEW_COACH_IDS.includes(activeModule));
                return (
                  <button
                    key={item.id}
                    className={`app-sidebar-item${active ? ' active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    data-mobile-hide={!MOBILE_ITEMS.includes(item.id) ? '' : undefined}
                  >
                    <span className="app-sidebar-icon">
                      <Icon id={item.id} size={15} color={active ? 'var(--lp-teal)' : 'var(--lp-text3)'} />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="sni-lbl" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                        {item.badge && (
                          <span className={`app-sidebar-badge ${BADGE_CLASS[item.badge] || ''}`}>
                            {BADGE_LABEL[item.badge]}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* User bar */}
        <div className="app-sidebar-user" title={collapsed ? (user?.name || 'User') : undefined}>
          <div className="app-sidebar-avatar">{initials(user?.name)}</div>
          {!collapsed && (
            <>
              <div className="app-sidebar-user-text" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--lp-text3)' }}>{user?.email?.split('@')[0]}</div>
              </div>
              <button
                className="app-sidebar-logout"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                style={{
                  background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)',
                  borderRadius: 7, color: '#FF6B7A', cursor: 'pointer',
                  padding: '4px 9px', lineHeight: 1, flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.18)'; e.currentTarget.style.borderColor = 'rgba(255,71,87,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,71,87,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,71,87,0.2)'; }}
              >
                <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 8H2M5 5l-3 3 3 3M8 4V3a1 1 0 011-1h4a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1v-1"/>
                </svg>
                Sign out
              </button>
            </>
          )}
        </div>

      </div>

      {/* ── Mobile nav: glass top bar + bottom 5-tab nav + More drawer ── */}

      {/* Glass top bar */}
      <div className="mob-glass-bar">
        <div className="mob-glass-brand">
          <LogoMark size={18} />
          <span className="mob-glass-name">CareerAiHub</span>
        </div>
        <div className="mob-glass-avatar">{initials(user?.name)}</div>
      </div>

      {/* Bottom nav */}
      <div className="mob-bottom-nav" role="navigation" aria-label="Primary">
        <div
          className="mob-nav-indicator"
          style={{ left: `calc(${mobActiveIdx * 20 + 10}% - 12px)` }}
        />
        {MOB_PRIMARY.map((item) => {
          const active = mobActiveIdx === MOB_PRIMARY.indexOf(item) && !moreOpen;
          return (
            <button
              key={item.id}
              className={`mob-bn-tab${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => { setMoreOpen(false); onNavigate(item.id); }}
            >
              <MobNavIcon id={item.id} active={active} />
              <span className="mob-bn-label">{item.label}</span>
            </button>
          );
        })}
        <button
          className={`mob-bn-tab${moreOpen ? ' active' : ''}`}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen(o => !o)}
        >
          <MobNavIcon id="more" active={moreOpen} />
          <span className="mob-bn-label">More</span>
        </button>
      </div>

      {/* More drawer */}
      {moreOpen && (
        <div className="mob-drawer-overlay" onClick={() => setMoreOpen(false)}>
          <div className="mob-drawer" role="dialog" aria-modal="true" aria-label="All tools" onClick={e => e.stopPropagation()}>
            <div className="mob-drawer-handle" />
            <div className="mob-drawer-title">All tools</div>
            <div className="mob-drawer-grid">
              {MOB_DRAWER_TOOLS.map(item => (
                <button
                  key={item.id}
                  className="mob-di"
                  onClick={() => { setMoreOpen(false); onNavigate(item.id); }}
                >
                  <Icon id={item.id} size={16} color="#5a6e8a" />
                  <span className="mob-di-label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
