import React, { useState } from 'react';
import HiringManagerSim from '../HiringManagerSim/HiringManagerSim';
import STARBuilder from '../STARBuilder/STARBuilder';
import WeaknessRadar from '../WeaknessRadar/WeaknessRadar';
import ReadinessScore from '../ReadinessScore/ReadinessScore';
import MemoryDashboard from '../MemoryDashboard/MemoryDashboard';
import { nextActions } from '../CareerRoadmap/roadmapNext';

const TABS = [
  { id: 'dashboard',  label: 'Overview' },
  { id: 'study',      label: 'Study Modules' },
  { id: 'session',    label: 'Live Session' },
  { id: 'weakness',   label: 'Weakness Radar' },
  { id: 'starbank',   label: 'STAR Bank' },
  { id: 'aimemory',   label: 'AI Memory' },
];

const tabBarStyle = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '8px 20px',
  background: 'rgba(236,72,153,.04)',
  borderBottom: '1px solid rgba(236,72,153,.1)',
  overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none',
};

const tabBtnStyle = (active) => ({
  padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  color: active ? 'var(--lp-teal)' : 'var(--lp-text2)',
  background: active ? 'var(--lp-teal-dim)' : 'transparent',
  border: `1px solid ${active ? 'var(--lp-teal-b)' : 'transparent'}`,
  cursor: 'pointer', transition: 'all .15s',
  fontFamily: 'var(--lp-ff)', whiteSpace: 'nowrap', flexShrink: 0,
});

// ── Interview Coach Overview ───────────────────────────────────────────────────
// What the user has DONE, as counts with their real names, and a next step from their real state. Nothing here grades the user:
// counts are not skills, and no module is locked (docs/architecture/plans/PROPOSAL-interview-overview-labels.md).
const countStyle = { background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '16px 14px' };

// nextActions() names app modules; inside this screen two of them are tabs.
const TAB_FOR_MODULE = { simulate: 'session', star: 'starbank' };

function InterviewDashboard({ memory, onNavigate, setActiveModule }) {
  const sessions = memory?.mockSessions || [];
  const stories = memory?.starBank || [];
  const questionsAnswered = sessions.reduce((n, s) => n + (Number.isFinite(s?.questionsCount) ? s.questionsCount : 0), 0);
  const last = sessions[0]?.date ? new Date(sessions[0].date) : null;
  const lastText = last && !Number.isNaN(last.getTime()) ? last.toLocaleDateString() : 'No session yet';

  const next = nextActions({
    hasResume: !!memory?.resumeText,
    sessionsCount: sessions.length,
    readiness: Number.isFinite(sessions[0]?.avgScore) ? sessions[0].avgScore : null,
    starCount: stories.length,
    hasSkillsGap: !!memory?.skillsGap?.result,
    trustScore: null, // this tab does not load the practice score: the Career Roadmap does
    trustVisible: false,
  });
  const go = (module) => (TAB_FOR_MODULE[module] ? onNavigate?.(TAB_FOR_MODULE[module]) : setActiveModule?.(module));

  const cards = [
    { key: 'mock-interviews', label: 'Mock interviews completed', value: String(sessions.length) },
    { key: 'questions-answered', label: 'Questions answered', value: String(questionsAnswered) },
    { key: 'star-stories', label: 'STAR stories saved', value: String(stories.length) },
    { key: 'last-practised', label: 'Last practised', value: lastText },
  ];

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: 'var(--lp-text3)', fontSize: 13 }}>
        {sessions.length === 0 && stories.length === 0
          ? 'Start your first session to see your activity here.'
          : `You have completed ${sessions.length} mock interview${sessions.length === 1 ? '' : 's'} and saved ${stories.length} STAR stor${stories.length === 1 ? 'y' : 'ies'}.`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.key} style={countStyle}>
            <div data-count={c.key} style={{ color: 'var(--lp-text)', fontSize: c.key === 'last-practised' ? 16 : 24, fontWeight: 900, lineHeight: 1.2, marginBottom: 6 }}>{c.value}</div>
            <div style={{ color: 'var(--lp-text2)', fontSize: 12, fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ color: 'var(--lp-text3)', fontSize: 11.5, lineHeight: 1.6 }}>
        These numbers count what you have done in CareerAiHub. They do not measure how well you answer.
      </div>

      {!next.allDone && next.items.length > 0 && (
        <section aria-label="What to do next" style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ color: 'var(--lp-text3)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 12 }}>What to do next</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {next.items.map((item) => (
              <div key={item.module} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--lp-text2)', fontSize: 13, lineHeight: 1.55, flex: 1, minWidth: 200 }}>{item.text}</div>
                <button
                  onClick={() => go(item.module)}
                  style={{ background: 'var(--lp-teal)', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {item.cta}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function InterviewCoach(props) {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Tab strip */}
      <div style={tabBarStyle}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: 'var(--lp-teal)',
          textTransform: 'uppercase', letterSpacing: '.12em',
          flexShrink: 0, marginRight: 6, whiteSpace: 'nowrap',
        }}>
          ✦ INTERVIEW COACH
        </span>
        <div style={{ width: 1, height: 16, background: 'rgba(236,72,153,.15)', flexShrink: 0, marginRight: 2 }} />
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={tabBtnStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && (
          <InterviewDashboard
            memory={props.memory}
            onNavigate={setActiveTab}
            setActiveModule={props.setActiveModule}
          />
        )}
        {activeTab === 'study'    && <HiringManagerSim {...props} />}
        {activeTab === 'session'  && <HiringManagerSim {...props} />}
        {activeTab === 'weakness' && <WeaknessRadar {...props} embedded />}
        {activeTab === 'starbank' && <STARBuilder {...props} embedded />}
        {activeTab === 'aimemory' && <MemoryDashboard {...props} embedded />}
      </div>
    </div>
  );
}
