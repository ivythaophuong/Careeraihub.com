import React, { useEffect, useMemo, useState } from 'react';
import { C } from '../../styles/theme';
import { AXES, AXIS_LABELS, QUESTIONS, ANSWER_CHOICES } from './questions';
import { AXIS_INSIGHTS } from './personas';
import { scoreAnswers, personaFor, bandFor, isComplete } from './scoring';
import { track, saveLead, submittedRecently, EMAIL_RE } from './tracking';
import { downloadShareCard } from './shareCard';

// Links out of the quiz always go to the official live site, even when testing locally.
const SITE_URL = 'https://careeraihub.com';

const ANSWERS_KEY = 'cq_answers';
const UNLOCKED_KEY = 'cq_unlocked';

function load(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

const page = {
  minHeight: '100vh',
  background: C.bg,
  color: C.text,
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '32px 20px 64px',
};
const column = { width: '100%', maxWidth: 680 };
const card = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 28,
};
const primaryBtn = (disabled) => ({
  background: disabled ? C.border : `linear-gradient(135deg, ${C.accent}, #0096CC)`,
  color: disabled ? C.muted : '#001018',
  border: 'none',
  borderRadius: 10,
  padding: '14px 28px',
  fontSize: 15,
  fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
});
const ghostBtn = {
  background: 'transparent',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: '12px 20px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  display: 'inline-block',
};

function Header() {
  return (
    <div style={{ ...column, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
      <a href={SITE_URL} style={{ color: C.text, fontWeight: 800, fontSize: 18, textDecoration: 'none' }}>
        Career<span style={{ color: C.accent }}>AI</span>Hub
      </a>
      <span style={{ color: C.muted, fontSize: 13 }}>Work Culture Quiz</span>
    </div>
  );
}

function Intro({ onStart }) {
  return (
    <div style={{ ...card, textAlign: 'center', padding: '44px 28px' }}>
      <div style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
        Free · 2 minutes · No signup
      </div>
      <h1 style={{ fontSize: 34, lineHeight: 1.2, margin: '0 0 14px', fontWeight: 800 }}>
        What is your work culture persona?
      </h1>
      <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.6, margin: '0 auto 28px', maxWidth: 480 }}>
        Answer 10 quick questions to find the kind of workplace where you do your best work, and
        what to look for in your next role.
      </p>
      <button style={primaryBtn(false)} onClick={onStart}>Start the quiz</button>
    </div>
  );
}

function Question({ index, answers, onAnswer, onBack }) {
  const q = QUESTIONS[index];
  const current = answers[q.id];
  const pct = Math.round((index / QUESTIONS.length) * 100);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 13, marginBottom: 8 }}>
        <span>Question {index + 1} of {QUESTIONS.length}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 6, background: C.border, borderRadius: 3, marginBottom: 28 }} aria-hidden="true">
        <div style={{ width: `${pct}%`, height: '100%', background: C.accent, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>

      <h2 style={{ fontSize: 22, margin: '0 0 20px', fontWeight: 700 }}>{q.prompt}</h2>

      {[{ key: 'A', opt: q.a }, { key: 'B', opt: q.b }].map(({ key, opt }) => (
        <div
          key={key}
          style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '14px 16px', marginBottom: 12,
          }}
        >
          <span style={{ color: C.accent, fontWeight: 800 }}>{key}</span>
          <span style={{ fontSize: 16, lineHeight: 1.5 }}>{opt.text}</span>
        </div>
      ))}

      <div style={{ color: C.muted, fontSize: 13, margin: '20px 0 10px' }}>Which is closer to you?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {ANSWER_CHOICES.map((c) => {
          const selected = current === c.value;
          return (
            <button
              key={c.value}
              aria-pressed={selected}
              onClick={() => onAnswer(q.id, c.value)}
              style={{
                background: selected ? `${C.accent}22` : C.card,
                border: `1px solid ${selected ? C.accent : C.border}`,
                color: selected ? C.accent : C.text,
                borderRadius: 10, padding: '12px 4px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {index > 0 && (
        <button onClick={onBack} style={{ ...ghostBtn, marginTop: 24, padding: '8px 16px', color: C.muted }}>
          ← Back
        </button>
      )}
    </div>
  );
}

function Teaser({ persona }) {
  return (
    <div style={{ ...card, borderColor: `${C.accent}66`, textAlign: 'center', padding: '40px 28px' }}>
      <div style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
        Your work culture persona
      </div>
      <h1 style={{ fontSize: 38, margin: '0 0 10px', fontWeight: 800 }}>{persona.name}</h1>
      <p style={{ color: C.accent, fontSize: 17, margin: '0 0 18px' }}>{persona.tagline}</p>
      <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.65, margin: 0 }}>{persona.summary}</p>
    </div>
  );
}

function Gate({ onUnlock }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState(''); // honeypot: real people never see or fill this
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) return setError('Please enter a valid email address.');
    if (!consent) return setError('Please tick the box so we can send you your report.');
    if (trap) return; // bot
    if (submittedRecently()) return setError('Please wait a moment before trying again.');

    setStatus('saving');
    try {
      await onUnlock({ email, name, consent });
    } catch (err) {
      setStatus('idle');
      setError('We could not save that just now. Please try again in a moment.');
    }
  };

  const input = {
    width: '100%', boxSizing: 'border-box', background: C.card, color: C.text,
    border: `1px solid ${C.border}`, borderRadius: 10, padding: '13px 14px',
    fontSize: 15, fontFamily: 'inherit', marginBottom: 12,
  };

  return (
    <form onSubmit={submit} style={{ ...card, marginTop: 20 }}>
      <h2 style={{ fontSize: 22, margin: '0 0 6px', fontWeight: 800 }}>Get your full report</h2>
      <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 18px' }}>
        See all five culture scores, the environments where you thrive, what to watch out for,
        and a tip for your interviews.
      </p>
      <input style={input} type="text" placeholder="First name (optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      <input style={input} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <input
        type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap}
        onChange={(e) => setTrap(e.target.value)}
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>
          Send me my report and occasional career tips from CareerAIHub. We store your email and
          quiz scores only, never sell them, and you can unsubscribe or ask us to delete them at
          any time via hello@careeraihub.com.
        </span>
      </label>
      {error && <div role="alert" style={{ color: C.red, fontSize: 14, marginBottom: 12 }}>{error}</div>}
      <button type="submit" style={{ ...primaryBtn(status === 'saving'), width: '100%' }} disabled={status === 'saving'}>
        {status === 'saving' ? 'Unlocking...' : 'Unlock my full report'}
      </button>
    </form>
  );
}

function Section({ title, items }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function FullReport({ persona, scores, onShareEvent }) {
  const shareUrl = `${window.location.origin}/culture-quiz?utm_source=share&utm_medium=result`;
  const shareText = `I'm a ${persona.name}. What's your work culture persona? Take the free 2-minute quiz:`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
    onShareEvent('copy');
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={card}>
        <h2 style={{ fontSize: 22, margin: '0 0 18px', fontWeight: 800 }}>Your culture profile</h2>
        {AXES.map((axis) => {
          const band = bandFor(scores[axis]);
          return (
            <div key={axis} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                <span>{AXIS_LABELS[axis]}</span>
                <span style={{ color: C.accent }}>{scores[axis]}</span>
              </div>
              <div style={{ height: 8, background: C.border, borderRadius: 4 }} aria-hidden="true">
                <div style={{ width: `${scores[axis]}%`, height: '100%', background: C.accent, borderRadius: 4 }} />
              </div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>{AXIS_INSIGHTS[axis][band]}</div>
            </div>
          );
        })}
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
          Scores show your leaning relative to the other four areas. They describe preferences, not ability, and are a guide rather than a verdict.
        </div>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <Section title="Your strengths" items={persona.strengths} />
        <Section title="Where you tend to thrive" items={persona.thrives} />
        <Section title="Watch out for" items={persona.watchOut} />
        <div style={{ color: C.accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Interview tip</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{persona.interviewTip}</p>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <h2 style={{ fontSize: 20, margin: '0 0 12px', fontWeight: 800 }}>Share your result</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a
            style={ghostBtn} target="_blank" rel="noopener noreferrer"
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            onClick={() => onShareEvent('linkedin')}
          >Share on LinkedIn</a>
          <a
            style={ghostBtn} target="_blank" rel="noopener noreferrer"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            onClick={() => onShareEvent('facebook')}
          >Share on Facebook</a>
          <button style={ghostBtn} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          <button style={ghostBtn} onClick={() => { downloadShareCard(persona.name, scores); onShareEvent('image'); }}>
            Download image
          </button>
        </div>
      </div>

      <div style={{ ...card, marginTop: 20, borderColor: `${C.accent}66`, textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, margin: '0 0 8px', fontWeight: 800 }}>Next: check your CV against a real job</h2>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: '0 0 18px' }}>
          Culture is one part of the fit. See how your CV scores against the requirements and
          where it needs stronger evidence.
        </p>
        <a
          href={`${SITE_URL}/?utm_source=culture_quiz&utm_medium=result`}
          onClick={() => track('cta_click', { target: 'scan' })}
          style={{ ...primaryBtn(false), textDecoration: 'none', display: 'inline-block' }}
        >
          Scan my CV free
        </a>
      </div>
    </div>
  );
}

export default function CultureQuiz() {
  const [answers, setAnswers] = useState(() => load(ANSWERS_KEY, {}));
  const [started, setStarted] = useState(() => Object.keys(load(ANSWERS_KEY, {})).length > 0);
  const [unlocked, setUnlocked] = useState(() => load(UNLOCKED_KEY, false));

  const complete = isComplete(answers);
  // Resume at the first unanswered question after a refresh.
  const firstOpen = QUESTIONS.findIndex((q) => !answers[q.id]);
  const [index, setIndex] = useState(() => Math.max(0, firstOpen));

  const scores = useMemo(() => (complete ? scoreAnswers(answers) : null), [complete, answers]);
  const persona = useMemo(() => (scores ? personaFor(scores) : null), [scores]);

  useEffect(() => {
    document.title = 'Work Culture Quiz | CareerAIHub';
    track('view');
  }, []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [started, complete, unlocked, index]);

  const start = () => {
    setStarted(true);
    track('start');
  };

  const answer = (qid, value) => {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    save(ANSWERS_KEY, next);
    if (isComplete(next)) {
      track('complete', { persona: personaFor(scoreAnswers(next)).name });
    } else if (index < QUESTIONS.length - 1) {
      setIndex(index + 1);
    }
  };

  const unlock = async ({ email, name, consent }) => {
    await saveLead({ email, name, scores, persona: persona.name, consent });
    save(UNLOCKED_KEY, true);
    setUnlocked(true);
    track('unlock', { persona: persona.name });
  };

  const retake = () => {
    setAnswers({});
    setStarted(false);
    setUnlocked(false);
    setIndex(0);
    save(ANSWERS_KEY, {});
    save(UNLOCKED_KEY, false);
  };

  let body;
  if (!started && !complete) {
    body = <Intro onStart={start} />;
  } else if (!complete) {
    body = <Question index={index} answers={answers} onAnswer={answer} onBack={() => setIndex(Math.max(0, index - 1))} />;
  } else {
    body = (
      <>
        <Teaser persona={persona} />
        {unlocked
          ? <FullReport persona={persona} scores={scores} onShareEvent={(channel) => track('share', { channel })} />
          : <Gate onUnlock={unlock} />}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={retake} style={{ ...ghostBtn, color: C.muted }}>Retake the quiz</button>
        </div>
      </>
    );
  }

  return (
    <div style={page}>
      <Header />
      <div style={column}>{body}</div>
    </div>
  );
}
