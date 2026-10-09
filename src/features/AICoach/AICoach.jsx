import React, { useState, useRef, useEffect } from 'react';
import { callLLM } from '../../lib/ai.jsx';

const QUICK_PROMPTS = [
  { label: '💡 What should I focus on this week?',             text: 'What should I focus on this week to make the most progress?' },
  { label: '🧠 How do I answer the biggest weakness question?', text: 'How do I answer the "biggest weakness" interview question?' },
  { label: '📊 Why is my ATS score low?',                      text: 'Why might my ATS score be low and how do I fix it?' },
  { label: '🤝 How do I negotiate salary without an offer yet?',text: 'How do I negotiate salary before I have a formal offer?' },
  { label: '🎯 Should I apply broadly or target fewer roles?',  text: 'Should I apply to many roles broadly or target fewer, highly-tailored applications?' },
];

export function buildSystemPrompt(memory, form) {
  const lines = [
    `You are an expert AI career coach. You have full context on the user's profile.`,
    `Target role: ${form?.role || 'not specified'}`,
    `Level: ${form?.level || 'not stated'}`,
    `Market: ${form?.market || 'Singapore'}`,
    `Industry: ${form?.industry || 'Tech'}`,
  ];
  if (memory.scanHistory?.length) {
    const latest = memory.scanHistory[0];
    lines.push(Number.isFinite(latest?.score) ? `Latest resume ATS score: ${latest.score}/100` : 'Latest resume scan has no score recorded');
  }
  if (memory.starBank?.length) {
    lines.push(`STAR bank: ${memory.starBank?.length} stories saved`);
    lines.push(`Best STAR: "${memory.starBank?.[0]?.bankAs || memory.starBank?.[0]?.oneLiner?.slice(0, 50)}"`);
  }
  if (memory.mockSessions?.length) {
    lines.push(`Interview sessions: ${memory.mockSessions?.length} completed, latest score ${memory.mockSessions[0]?.avgScore ?? '—'}/100`);
  }
  if (memory.jdAnalyses?.length) {
    lines.push(`JDs analyzed: ${memory.jdAnalyses.length} · recent roles: ${memory.jdAnalyses.slice(0, 3).map(j => j.roleTitle || 'Role').join(', ')}`);
  }
  if (memory.coverLetters?.length) {
    lines.push(`Cover letters generated: ${memory.coverLetters.length}`);
  }
  if (memory.skillsGap?.result) {
    // Counted from the saved skill list; the AI-estimated match rates are no longer shown or stored.
    const gaps = (memory.skillsGap.result.skills || []).filter(sk => sk.status === 'gap').map(sk => sk.name).filter(Boolean);
    lines.push(`Skills gap analysis done${gaps.length ? `; flagged gaps: ${gaps.slice(0, 6).join(', ')}` : ''}`);
  }
  if ((memory.negotiationPractice ?? 0) > 0) {
    lines.push(`Salary negotiation practice sessions: ${memory.negotiationPractice}`);
  }
  lines.push('');
  lines.push('Give concise, actionable advice grounded in the user\'s actual data. Be direct — no generic platitudes. Reference their specific scores and history when relevant. Keep responses under 200 words unless a detailed breakdown is genuinely needed.');
  return lines.join('\n');
}

function Dot({ delay }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lp-teal)', display: 'inline-block', animation: `lp-pulse 1.2s ease ${delay}s infinite` }} />;
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ maxWidth: '82%', alignSelf: isUser ? 'flex-end' : 'flex-start', animation: 'lp-fadeUp .25s ease both' }}>
      {!isUser && (
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--lp-teal)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4, fontFamily: 'var(--lp-ffm)' }}>AI Coach</div>
      )}
      <div style={{
        background: isUser ? 'rgba(236,72,153,.1)' : 'var(--lp-bg3)',
        border: `1px solid ${isUser ? 'rgba(236,72,153,.2)' : 'var(--lp-bdr)'}`,
        borderRadius: isUser ? '10px 10px 2px 10px' : '2px 10px 10px 10px',
        padding: '10px 14px',
        fontSize: 13,
        color: 'var(--lp-text)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {msg.loading ? (
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <Dot delay={0} /><Dot delay={0.2} /><Dot delay={0.4} />
          </span>
        ) : msg.content}
      </div>
    </div>
  );
}

export default function AICoach({ memory, form, updateMemory, showToast }) {
  const storedHistory = memory.aiChat || [];
  const [messages, setMessages] = useState(
    storedHistory.length > 0
      ? storedHistory
      : [{ role: 'assistant', content: `Hi! I'm your AI Career Coach. I have full context on your profile — your resume scans, STAR bank, interview sessions, and goals.\n\nWhat would you like to work on today?`, ts: Date.now() }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content, ts: Date.now() };
    const loadingMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() + 1 };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(memory, form);
      // Prepend system context as first user/assistant exchange so all providers handle it
      const history = [
        { role: 'user',      content: `[COACH CONTEXT]\n${systemPrompt}\n[END CONTEXT]\n\nAcknowledge you have this context.` },
        { role: 'assistant', content: 'Understood — I have your full profile context loaded.' },
        ...messages.filter(m => !m.loading).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content },
      ];
      const raw = await callLLM(history, 600);
      const reply = { role: 'assistant', content: raw.trim(), ts: Date.now() };

      setMessages(prev => {
        const next = [...prev.filter(m => !m.loading), reply];
        updateMemory(m => ({ ...m, aiChat: next.slice(-60).map(({ role, content, ts }) => ({ role, content, ts })) }));
        return next;
      });
    } catch (e) {
      const errMsg = { role: 'assistant', content: `Something went wrong: ${e.message}. Try again.`, ts: Date.now() };
      setMessages(prev => [...prev.filter(m => !m.loading), errMsg]);
      showToast('AI Coach error: ' + e.message, 'error');
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    const init = [{ role: 'assistant', content: 'Chat cleared. What would you like to work on?', ts: Date.now() }];
    setMessages(init);
    updateMemory(m => ({ ...m, aiChat: init }));
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--lp-ff)', color: 'var(--lp-text)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--lp-ff)', fontSize: 20, fontWeight: 800, color: 'var(--lp-text)', letterSpacing: '-.02em' }}>AI Career Coach</div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', background: 'linear-gradient(90deg,rgba(236,72,153,.18),rgba(245,158,11,.12))', color: '#8B7CF6', border: '1px solid rgba(139,124,246,.22)', borderRadius: 20, padding: '2px 8px', fontFamily: 'var(--lp-ffm)' }}>New</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--lp-text2)' }}>
            Ask anything · knows your full profile, sessions, STAR bank, and goals
          </div>
        </div>
        <button onClick={clearChat} style={{ fontSize: 11, background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr2)', color: 'var(--lp-text2)', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--lp-ff)', fontWeight: 600 }}>
          Clear chat
        </button>
      </div>

      <div className="aic-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>
        {/* Chat area */}
        <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, display: 'flex', flexDirection: 'column', height: 560 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,.06) transparent' }}>
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--lp-bdr)', display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about resume, interview prep, salary, strategy…"
              disabled={loading}
              style={{ flex: 1, background: 'var(--lp-bg4, #1A2540)', border: '1px solid var(--lp-bdr2)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--lp-ff)', fontSize: 13, color: 'var(--lp-text)', outline: 'none', transition: 'border-color .15s' }}
              onFocus={e => (e.target.style.borderColor = 'rgba(236,72,153,.35)')}
              onBlur={e => (e.target.style.borderColor = 'var(--lp-bdr2)')}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{ background: loading || !input.trim() ? 'var(--lp-bg3)' : 'var(--lp-teal)', color: loading || !input.trim() ? 'var(--lp-text3)' : '#000', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'var(--lp-ff)', transition: 'all .14s' }}
            >
              Send →
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick prompts */}
          <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 10 }}>Quick prompts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.text)}
                  disabled={loading}
                  style={{ background: 'var(--lp-bg3)', border: '1px solid var(--lp-bdr)', color: 'var(--lp-text2)', borderRadius: 7, padding: '8px 12px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--lp-ff)', fontSize: 12, textAlign: 'left', transition: 'all .14s', lineHeight: 1.4, opacity: loading ? 0.5 : 1 }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.color = 'var(--lp-text)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--lp-text2)')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI context summary */}
          <div style={{ background: 'var(--lp-bg2)', border: '1px solid var(--lp-bdr)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 10 }}>AI context loaded</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: `Resume scans (${memory.scanHistory?.length ?? 0})`,      ok: (memory.scanHistory?.length ?? 0) > 0 },
                { label: `STAR stories (${memory.starBank?.length ?? 0})`,          ok: (memory.starBank?.length ?? 0) > 0 },
                { label: `Interview sessions (${memory.mockSessions?.length ?? 0})`,ok: (memory.mockSessions?.length ?? 0) > 0 },
                { label: `JDs analyzed (${memory.jdAnalyses?.length ?? 0})`,        ok: (memory.jdAnalyses?.length ?? 0) > 0 },
                { label: `Skills gap analysis`,                                      ok: !!memory.skillsGap?.result },
                { label: `Cover letters (${memory.coverLetters?.length ?? 0})`,     ok: (memory.coverLetters?.length ?? 0) > 0 },
                { label: `Target: ${form?.role || 'Role not set'}`,                 ok: !!form?.role },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: item.ok ? '#00E5A0' : 'var(--lp-text3)', flexShrink: 0, fontSize: 13 }}>{item.ok ? '✓' : '○'}</span>
                  <span style={{ color: item.ok ? 'var(--lp-text)' : 'var(--lp-text2)' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
