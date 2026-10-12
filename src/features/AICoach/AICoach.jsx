import React, { useState, useRef, useEffect } from 'react';
import { callLLMFor } from '../../lib/aiFeature.js';
import { buildCoachRequest, COACH_LIMITS } from './coachRequest.js';

// What the coach honestly has: a short summary, not the user's documents.
const GREETING = "Hi! I'm your AI Career Coach. I can see a short summary of your activity here (for example how many STAR stories you saved and your latest mock interview average), but not your resume text, your STAR stories or your interview answers.\n\nWhat would you like to work on today?";

const QUICK_PROMPTS = [
  { label: '💡 What should I focus on this week?',             text: 'What should I focus on this week to make the most progress?' },
  { label: '🧠 How do I answer the biggest weakness question?', text: 'How do I answer the "biggest weakness" interview question?' },
  { label: '📊 Why do resumes get filtered out early?',        text: 'What are the most common reasons a resume is filtered out before a person reads it, and how do I avoid them?' },
  { label: '🤝 How do I negotiate salary without an offer yet?',text: 'How do I negotiate salary before I have a formal offer?' },
  { label: '🎯 Should I apply broadly or target fewer roles?',  text: 'Should I apply to many roles broadly or target fewer, highly-tailored applications?' },
];

// Free text the user typed is clipped before it goes into the context, so the context stays small whatever was typed.
const clip = (s, n = 100) => { const t = String(s ?? ''); return t.length > n ? `${t.slice(0, n)}…` : t; };

export function buildSystemPrompt(memory, form) {
  const lines = [
    `You are an expert AI career coach. You have a short summary of the user's profile (counts and a few labels), not their documents: you do not have the user's resume text, the text of their STAR stories or their interview answers. Do not claim to have seen them; if something you need is not below, ask the user.`,
    `Target role: ${clip(form?.role) || 'not specified'}`,
    `Level: ${clip(form?.level) || 'not stated'}`,
    `Market: ${clip(form?.market) || 'not stated'}`,
    `Industry: ${clip(form?.industry) || 'not stated'}`,
  ];
  if (memory.starBank?.length) {
    lines.push(`STAR stories saved: ${memory.starBank.length}`);
    // The list is newest first, so the first entry is the most recent story, not the best one.
    lines.push(`Most recent STAR story: "${clip(memory.starBank[0]?.bankAs || memory.starBank[0]?.oneLiner, 80)}"`);
  }
  if (memory.mockSessions?.length) {
    const latest = memory.mockSessions[0]?.avgScore;
    lines.push(`Mock interviews completed: ${memory.mockSessions.length}; ${Number.isFinite(latest)
      ? `latest session average ${latest}/100 (an AI estimate, based on the first attempt at each question; not a verified assessment)`
      : 'the latest session has no scored answer'}`);
  }
  if (memory.jdAnalyses?.length) {
    lines.push(`JDs analyzed: ${memory.jdAnalyses.length} · recent roles: ${memory.jdAnalyses.slice(0, 3).map(j => clip(j.roleTitle, 80) || 'Role').join(', ')}`);
  }
  if (memory.coverLetters?.length) {
    lines.push(`Cover letters generated: ${memory.coverLetters.length}`);
  }
  if (memory.skillsGap?.result) {
    // Counted from the saved skill list; the AI-estimated match rates are no longer shown or stored.
    const gaps = (memory.skillsGap.result.skills || []).filter(sk => sk.status === 'gap').map(sk => sk.name).filter(Boolean);
    lines.push(`Skills gap analysis done${gaps.length ? `; flagged gaps: ${gaps.slice(0, 6).map(g => clip(g, 60)).join(', ')}` : ''}`);
  }
  if ((memory.negotiationPractice ?? 0) > 0) {
    lines.push(`Salary negotiation practice sessions: ${memory.negotiationPractice}`);
  }
  lines.push('');
  lines.push('Give concise, actionable advice grounded in what is listed above. Be direct — no generic platitudes. Reference their specific numbers when relevant, and say when a number is an AI estimate. Keep responses under 200 words unless a detailed breakdown is genuinely needed.');
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
      : [{ role: 'assistant', content: GREETING, ts: Date.now() }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [sendError, setSendError] = useState('');
  const [dropped, setDropped] = useState(0); // how many earlier messages the last request left out

  const send = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    // Build the request first: if the message cannot be sent at all, say so and keep what the user typed.
    const built = buildCoachRequest({ systemPrompt: buildSystemPrompt(memory, form), history: messages, content });
    if (built.error === 'context_too_long') {
      setSendError('Your profile summary is too large to send. Please shorten the target role, level, market and industry fields and try again.');
      return;
    }
    if (built.error) {
      setSendError(`That message is too long to send (the limit is about ${built.maxChars.toLocaleString('en-US')} characters). Shorten it and try again.`);
      return;
    }
    setSendError('');
    setDropped(built.dropped);
    setInput('');

    const userMsg = { role: 'user', content, ts: Date.now() };
    const loadingMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() + 1 };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const raw = await callLLMFor('ai_coach')(built.messages, 600);
      const reply = { role: 'assistant', content: raw.trim(), ts: Date.now() };

      setMessages(prev => {
        const next = [...prev.filter(m => !m.loading), reply];
        // Error bubbles are shown but never stored.
        updateMemory(m => ({ ...m, aiChat: next.filter(x => !x.error).slice(-60).map(({ role, content, ts }) => ({ role, content, ts })) }));
        return next;
      });
    } catch (e) {
      const errMsg = { role: 'assistant', content: `Something went wrong: ${e.message}. Try again.`, ts: Date.now(), error: true };
      setMessages(prev => [...prev.filter(m => !m.loading), errMsg]);
      showToast('AI Coach error: ' + e.message, 'error');
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  // Once the conversation is longer than one request can carry, the oldest messages stay on screen but are no longer sent.
  const sentCount = messages.filter(m => !m.loading && !m.error).length;
  const willTrim = dropped > 0 || sentCount > COACH_LIMITS.maxMessages - 3;

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

          {willTrim && (
            <div role="note" style={{ padding: '6px 18px', fontSize: 11, color: 'var(--lp-text3)', borderTop: '1px solid var(--lp-bdr)' }}>
              Only the most recent messages are sent to the AI. Earlier ones stay on this screen, but the coach no longer sees them.
            </div>
          )}
          {sendError && <div role="alert" style={{ padding: '6px 18px', fontSize: 12, color: '#FF5A5A' }}>{sendError}</div>}

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
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--lp-text3)', fontFamily: 'var(--lp-ffm)', marginBottom: 10 }}>What the coach can see</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { label: `STAR stories (${memory.starBank?.length ?? 0})`,          ok: (memory.starBank?.length ?? 0) > 0 },
                { label: `Mock interviews (${memory.mockSessions?.length ?? 0})`,    ok: (memory.mockSessions?.length ?? 0) > 0 },
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
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--lp-text3)', lineHeight: 1.5 }}>
              Not shared with the coach: your resume text, the text of your STAR stories and your interview answers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
