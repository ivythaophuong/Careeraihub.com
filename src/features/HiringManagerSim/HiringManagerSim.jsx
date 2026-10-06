import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';

const ROLE_OPTIONS = [
  { id: 'pm',        label: 'Product Manager' },
  { id: 'swe',       label: 'Software Engineer' },
  { id: 'data',      label: 'Data Scientist' },
  { id: 'design',    label: 'Product Designer' },
  { id: 'marketing', label: 'Marketing / Growth' },
  { id: 'general',   label: 'General' },
];

const ROLE_QUESTIONS = {
  metrics: {
    pm:        { question: 'Walk me through the exact approach you used to identify the drop-off point. What was your confidence interval, how did you validate the hypothesis, and what SQL did you run?', placeholder: 'Include specific metrics, percentages, how you validated results with data, and your SQL or analytics approach...' },
    swe:       { question: 'Walk me through how you diagnosed a production performance regression. What metrics did you monitor first, what tools did you use, and how did you confirm root cause?', placeholder: 'Include p50/p99 numbers, which profiling tools you used, your hypothesis and how you validated it...' },
    data:      { question: 'Walk me through a time your analysis or model drove a major decision. What was your validation methodology, what were the model metrics, and what does the core SQL or code look like?', placeholder: 'Include model metrics, validation approach, statistical significance, and code snippets if relevant...' },
    design:    { question: 'Walk me through how you measured the success of a design change you shipped. What metrics were you tracking, how did you structure the test, and what did the numbers say?', placeholder: 'Include the metrics you tracked, how you set up testing, your confidence threshold, and the actual results...' },
    marketing: { question: 'Walk me through a campaign where you drove measurable growth. What was your CAC/LTV math, how did you A/B test it, and what was your confidence interval?', placeholder: 'Include the channel, creative hypothesis, test setup, sample size, and the specific numbers that came out...' },
    general:   { question: 'Tell me about a time you used data to make a decision. Walk me through exactly what numbers you looked at and how you validated your conclusion before acting.', placeholder: 'Include the specific data you used, how you checked it was reliable, what the numbers showed, and what you decided...' },
  },
  founder: {
    pm:        { question: "Forget the metrics for a moment — tell me why you actually cared about this problem. What would you have done differently with no constraints at all?", placeholder: 'Share your genuine motivation, what first-principles thinking drove your approach, and your vision if you had full autonomy...' },
    swe:       { question: "Forget best practices — tell me about a system you'd rebuild completely from scratch. What's fundamentally wrong with how it was built, and what does the ideal architecture look like?", placeholder: 'Share the constraints that led to the current design, what you\'d change and why, what the ideal system looks like...' },
    data:      { question: "If you had no infrastructure constraints, what does your ideal data platform look like? Walk me through your first-principles thinking about how data should flow from source to decision.", placeholder: 'Share your ideal stack, why each piece exists, and what tradeoffs you\'d consciously make versus the current state...' },
    design:    { question: "Tell me about a product experience you use every day that's fundamentally broken. If you redesigned it from scratch with no legacy constraints, what would you build?", placeholder: 'Describe what\'s broken and why, walk through your redesign thinking, and share the specific decisions you\'d make differently...' },
    marketing: { question: "Forget your current budget and channels. If you were building growth from first principles for this company, what would you actually do — and why those specific moves?", placeholder: 'Share your first-principles view of the customer, the insight that drives your strategy, and the specific bets you\'d make...' },
    general:   { question: "Tell me about a problem you're personally obsessed with solving. If you had full autonomy and resources, how would you approach it — and why that approach?", placeholder: 'Share your genuine passion for the problem, your theory of change, and what you\'d actually do with full autonomy...' },
  },
  stresstester: {
    pm:        { question: "Your redesign shipped. Two weeks later a major integration drops support — revenue is down 23%. You have 48 hours. Walk me through exactly what you do, minute by minute.", placeholder: 'Walk through your exact decision process — who you call first, what you cut, how you communicate upward and to customers...' },
    swe:       { question: "You pushed a hotfix to production. 30 minutes later: 500 errors across all endpoints, latency spiked 10x, no clean rollback. Walk me through exactly what you do, minute by minute.", placeholder: 'Walk through your debugging process — what you check first, how you communicate, what mitigations you try, and when you escalate...' },
    data:      { question: "Your recommendation model just caused a $500K pricing error in production. Leadership wants answers in 20 minutes. Walk me through exactly how you handle the next hour.", placeholder: 'Walk through your immediate actions — how you diagnose it, what you communicate to whom, how you stop the bleeding, and your post-mortem process...' },
    design:    { question: "You shipped a major redesign. Day 3: NPS dropped 15 points, your top users are publicly complaining. CEO asks whether to roll back. What do you do in the next 24 hours?", placeholder: 'Walk through your exact decision process — what data you look at, who you talk to, how you assess rollback vs fix-forward, and how you communicate...' },
    marketing: { question: "Your primary paid channel just got suspended with no warning. Pipeline for the quarter is at risk. Leadership wants a recovery plan in 48 hours. Walk through exactly what you do.", placeholder: 'Walk through your triage — what you check immediately, which channels to activate fast, how you communicate to leadership, and what the 48-hour plan looks like...' },
    general:   { question: "A critical deadline just moved up by a week and two key teammates are unexpectedly out. Leadership is watching closely. Walk me through exactly how you handle the next 24 hours.", placeholder: 'Walk through your exact prioritization — what you drop, what you delegate, how you communicate, and what your plan looks like to still deliver...' },
  },
};

const ARCHETYPES = [
  {
    id: 'metrics',
    label: 'Metrics-Obsessed Head of Growth',
    icon: '📊',
    desc: 'Expects hard numbers, SQL fluency, and conversion data behind every claim.',
    color: C.accent,
    systemPrompt: `You are a Metrics-Obsessed Head of Growth interviewing a candidate. You are rigorous, data-driven, and deeply skeptical of vague claims. You care about hard numbers, SQL, A/B testing, statistical significance, and conversion metrics. When the candidate is vague, call it out. Demand specifics. Score harshly if there are no numbers or the reasoning is woolly. Return ONLY raw JSON: {"score":0-100,"verdict":"string","worked":"string","missed":"string","tip":"string","followUp":"string"}`
  },
  {
    id: 'founder',
    label: 'Visionary Founder',
    icon: '🚀',
    desc: 'Tests for culture fit, first-principles thinking, and big-picture alignment.',
    color: C.purple,
    systemPrompt: `You are a Visionary Founder interviewing a candidate. You care deeply about culture fit, passion, and big-picture thinking. You're skeptical of corporate-speak and love candidates who think from first principles. You want to know their genuine motivation and whether they see beyond immediate constraints. Score harshly if answers feel rehearsed, metric-heavy without soul, or lack any original thinking. Return ONLY raw JSON: {"score":0-100,"verdict":"string","worked":"string","missed":"string","tip":"string","followUp":"string"}`
  },
  {
    id: 'stresstester',
    label: 'Stress-Tester',
    icon: '🔥',
    desc: 'High-pressure scenarios, edge cases, and failure modes. Nothing passes unchallenged.',
    color: C.red,
    systemPrompt: `You are a high-pressure Stress-Tester interviewer. Your job is to find the breaking point of every candidate. Challenge every assumption, poke at failure modes, and ask uncomfortable "what if" questions. Do not let anything slide — if the candidate glosses over a detail, push hard. Score based on how well they handle ambiguity, pressure, and failure scenarios. Return ONLY raw JSON: {"score":0-100,"verdict":"string","worked":"string","missed":"string","tip":"string","followUp":"string"}`
  }
];

export default function HiringManagerSim({ resumeText, scanResult, form, memory, updateMemory }) {
  const [archetype, setArchetype] = useState(null);
  const [targetRole, setTargetRole] = useState('pm');
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const simulate = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    setFb(null);
    setError('');

    const resumeStr = typeof resumeText === 'string' ? resumeText : resumeText?.content || '';
    const resumeContext = resumeStr
      ? `\n\nCandidate's resume:\n${resumeStr.slice(0, 3000)}`
      : '';
    const memoryContext = memory?.profile
      ? `\n\nCandidate profile from memory: ${JSON.stringify(memory.profile).slice(0, 800)}`
      : '';

    const roleLabel = ROLE_OPTIONS.find(r => r.id === targetRole)?.label || 'professional';
    const roleQ = ROLE_QUESTIONS[archetype.id]?.[targetRole] || ROLE_QUESTIONS[archetype.id]?.pm;
    const roleContext = `\n\nThe candidate is interviewing for a ${roleLabel} position.`;

    const messages = [
      {
        role: 'user',
        content: `${archetype.systemPrompt}${roleContext}${resumeContext}${memoryContext}\n\nQuestion asked: "${roleQ.question}"\n\nCandidate's answer: "${answer}"\n\nEvaluate the answer strictly as this archetype would. Return raw JSON only.`
      }
    ];

    try {
      const raw = await callLLM(messages, 1024);
      const result = extractJSON(raw);
      if (result.error) throw new Error('Could not parse response');
      setFb(result);
      if (updateMemory) {
        updateMemory(
          m => ({ mockSessions: [{ score: result.score, avgScore: result.score, mode: archetype.id, date: new Date().toISOString() }, ...(m.mockSessions || [])].slice(0, 20) }),
          { table: 'mock_sessions', data: { avg_score: result.score, questions_count: 1, mode: archetype.id } }
        );
      }
    } catch (e) {
      setError('Evaluation failed — please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setArchetype(null); setFb(null); setAnswer(''); setError(''); };
  const switchArchetype = () => { setArchetype(null); setFb(null); setAnswer(''); setError(''); };

  // ── Archetype selector ────────────────────────────────────────────────────────
  if (!archetype) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Hiring Manager Simulator</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Choose your target role and interviewer archetype. Questions adapt to your role.</div>
        {!resumeText && (
          <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 10, padding: '10px 14px', background: C.gold + '11', borderRadius: 8, border: `1px solid ${C.gold}33` }}>
            ⚠️ Upload a resume for personalized, context-aware questions.
          </div>
        )}
      </div>

      {/* Role selector */}
      <div>
        <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>I'm interviewing for</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ROLE_OPTIONS.map(r => (
            <button
              key={r.id}
              onClick={() => setTargetRole(r.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${targetRole === r.id ? C.accent : C.border}`,
                background: targetRole === r.id ? C.accent + '15' : 'transparent',
                color: targetRole === r.id ? C.accent : C.muted,
                transition: 'all 0.15s',
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ARCHETYPES.map(a => (
          <div
            key={a.id}
            onClick={() => setArchetype(a)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '18px 20px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${a.color}33`,
              background: a.color + '06',
              transition: 'all 0.18s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = a.color + '66'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = a.color + '33'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ fontSize: 28, flexShrink: 0 }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: a.color, fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{a.label}</div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{a.desc}</div>
            </div>
            <div style={{ color: C.muted, fontSize: 18, flexShrink: 0 }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Active session ────────────────────────────────────────────────────────────
  const scoreColor = fb ? (fb.score >= 75 ? C.green : fb.score >= 50 ? C.gold : C.red) : C.accent;
  const activeRoleQ = ROLE_QUESTIONS[archetype.id]?.[targetRole] || ROLE_QUESTIONS[archetype.id]?.pm;
  const activeRoleLabel = ROLE_OPTIONS.find(r => r.id === targetRole)?.label || 'Professional';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: archetype.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Interviewing as</div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 20 }}>{archetype.icon} {archetype.label}</div>
        </div>
        <button
          onClick={switchArchetype}
          style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}
        >
          ← Switch archetype
        </button>
      </div>

      {/* Question */}
      <Card style={{ border: `1px solid ${archetype.color}44`, background: archetype.color + '07' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ color: archetype.color, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Question</div>
          <div style={{ color: C.muted, fontSize: 10, fontWeight: 600, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '2px 8px' }}>{activeRoleLabel}</div>
        </div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1.65 }}>"{activeRoleQ.question}"</div>
      </Card>

      {/* Answer */}
      <textarea
        value={answer}
        onChange={e => setAnswer(e.target.value)}
        placeholder={activeRoleQ.placeholder}
        style={{ width: '100%', minHeight: 130, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 16, fontSize: 13, outline: 'none', lineHeight: 1.7, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />

      {error && (
        <div style={{ background: C.red + '15', border: `1px solid ${C.red}44`, borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 12 }}>⚠ {error}</div>
      )}

      <Btn onClick={simulate} disabled={loading || !answer.trim()} color={archetype.color} dark style={{ width: '100%' }}>
        🧠 Get AI Feedback
      </Btn>

      {loading && <Card><Spinner label={`Evaluating as ${archetype.label}...`} /></Card>}

      {/* Feedback */}
      {fb && (
        <Card style={{ border: `1px solid ${scoreColor}44`, background: scoreColor + '06' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ color: scoreColor, fontWeight: 900, fontSize: 20 }}>{fb.verdict}</div>
            <div style={{ color: scoreColor, fontWeight: 900, fontSize: 28, fontFamily: 'var(--font-mono)' }}>{fb.score}%</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ color: C.green, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>✓ What Worked</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.65 }}>{fb.worked}</div>
            </div>
            <div>
              <div style={{ color: C.red, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>✗ What Missed</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.65 }}>{fb.missed}</div>
            </div>
            <div style={{ background: C.surface, padding: '12px 14px', borderRadius: 8, borderLeft: `3px solid ${archetype.color}` }}>
              <div style={{ color: archetype.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Sharpen This</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.65, fontStyle: 'italic' }}>{fb.tip}</div>
            </div>
            {fb.followUp && (
              <div style={{ background: archetype.color + '08', border: `1px solid ${archetype.color}33`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ color: archetype.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Follow-up Question</div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>"{fb.followUp}"</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <Btn onClick={() => { setAnswer(''); setFb(null); }} color={archetype.color} dark style={{ flex: 1 }}>Try Again →</Btn>
            <Btn onClick={reset} color={C.border} style={{ padding: '11px 18px' }}>New Archetype</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
