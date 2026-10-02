import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { copyToClipboard } from '../CoverLetterGen/coverLetter';
import { SECTIONS, MIN_FIELD_CHARS, MAX_FIELD_CHARS, buildStarPrompt, normalizeStarResult, findInventedNumbers, scoreColorKey } from './star';

const fc = [C.accent, C.gold, C.purple, C.green];
const FIELDS = [
  { k: 'situation', l: 'Situation', h: 'Context', rows: 3 },
  { k: 'task', l: 'Task', h: 'Responsibility', rows: 2 },
  { k: 'action', l: 'Action', h: 'Action Taken', rows: 4 },
  { k: 'result', l: 'Result', h: 'Outcome', rows: 2 },
];
const scoreColor = (s) => C[scoreColorKey(s)];
const storyAsText = (r) => `${r.oneLiner}\n\n${SECTIONS.map(k => `${k[0].toUpperCase()}${k.slice(1)}: ${r.refined[k]}`).join('\n\n')}`;

export default function STARBuilder({ memory, updateMemory, setAuthModal }) {
  const [story, setStory] = useState({ situation: '', task: '', action: '', result: '' });
  const [result, setResult] = useState(null);
  const [analysed, setAnalysed] = useState(null); // the exact input the result was generated from
  const [invented, setInvented] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [openId, setOpenId] = useState(null);

  const bank = memory?.starBank || [];
  const short = FIELDS.filter(f => story[f.k].trim().length < MIN_FIELD_CHARS);

  const setField = (k, v) => { setStory(s => ({ ...s, [k]: v })); setErr(''); };

  const refine = async () => {
    if (short.length) { setErr(`Add a little more detail to: ${short.map(f => f.l).join(', ')} (at least ${MIN_FIELD_CHARS} characters each).`); return; }
    setLoading(true); setResult(null); setErr(''); setSaved(false); setCopied('');
    const input = { ...story };
    try {
      const raw = await callLLM([{ role: 'user', content: buildStarPrompt(input) }], 2500);
      const parsed = normalizeStarResult(extractJSON(raw));
      setResult(parsed);
      setAnalysed(input);
      setInvented(findInventedNumbers(input, parsed));
    } catch (e) {
      if (e.status === 401 && setAuthModal) {
        setErr('Create a free account or sign in to refine your stories.');
        setAuthModal('register');
      } else {
        setErr(e.message || 'Could not review the story. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToBank = () => {
    if (!result || saved) return;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      score: result.score,
      oneLiner: result.oneLiner,
      situation: analysed.situation, // kept for compatibility with older bank entries
      original: analysed,
      refined: result.refined,
      competencies: result.competencies,
    };
    updateMemory?.(m => ({ starBank: [entry, ...(m.starBank || [])].slice(0, 30) }));
    setSaved(true);
  };

  const deleteStory = (id) => {
    updateMemory?.(m => ({ starBank: (m.starBank || []).filter(s => s.id !== id) }));
    setConfirmDelete(null);
  };

  const copy = async (what, text) => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? what : `${what}-failed`);
    setTimeout(() => setCopied(''), 2000);
  };
  const copyLabel = (what, idle) => copied === what ? 'Copied ✓' : copied === `${what}-failed` ? 'Copy failed' : idle;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>STAR Story Builder</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Build, score, and bank your best interview stories.</div>
      </div>

      <Card>
        {FIELDS.map((f, i) => (
          <div key={f.k} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <span style={{ background: fc[i] + "22", color: fc[i], borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>{f.l}</span>
              <span style={{ color: C.muted, fontSize: 11 }}>{f.h}</span>
            </div>
            <textarea
              aria-label={f.l}
              value={story[f.k]}
              maxLength={MAX_FIELD_CHARS}
              onChange={e => setField(f.k, e.target.value)}
              rows={f.rows}
              style={{ width: "100%", background: C.surface, border: `1px solid ${fc[i]}44`, borderRadius: 8, color: C.text, fontSize: 13, padding: 12, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.6 }}
            />
          </div>
        ))}
        {err && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
        <Btn onClick={refine} disabled={loading} color={C.gold} dark style={{ width: "100%", padding: 16, fontSize: 14 }}>{loading ? "Reviewing your story..." : "⭐ Refine My Story"}</Btn>
      </Card>

      {loading && <Card><Spinner label="Reviewing and polishing your story..." /></Card>}

      {result && !loading && (
        <>
          <Card style={{ border: `1px solid ${scoreColor(result.score)}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Your draft scores</div>
                <div style={{ color: scoreColor(result.score), fontWeight: 900, fontSize: 36 }} aria-label="Overall score">{result.score}<span style={{ fontSize: 16 }}>/100</span></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
                {SECTIONS.map((k, i) => (
                  <div key={k} style={{ background: C.surface, borderRadius: 8, padding: "6px 12px", borderLeft: `2px solid ${fc[i]}` }}>
                    <div style={{ color: fc[i], fontSize: 9, fontWeight: 900, textTransform: "uppercase" }}>{k}</div>
                    <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{result.scores[k]}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>Scored on your original wording, not the polished version below.</div>
          </Card>

          {invented.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}66`, background: C.gold + "0D" }}>
              <div role="alert" style={{ color: C.gold, fontWeight: 900, fontSize: 12, marginBottom: 6 }}>⚠️ Check these numbers before you use this story</div>
              <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>
                The polished version contains numbers that are not in what you wrote: <strong>{invented.join(', ')}</strong>. Remove them or replace them with your real figures. Never claim a number you can't back up in an interview.
              </div>
            </Card>
          )}

          <Card style={{ border: `1px solid ${C.gold}44`, background: C.gold + "05" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ color: C.gold, fontWeight: 900, fontSize: 15 }}>✨ Refined STAR Output</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copy('story', storyAsText(result))} style={smallBtn}>{copyLabel('story', 'Copy Story')}</button>
                <button onClick={saveToBank} disabled={saved} style={{ ...smallBtn, color: saved ? C.green : C.gold, borderColor: saved ? C.green : C.gold }}>{saved ? 'Saved ✓' : '💾 Save to Story Bank'}</button>
              </div>
            </div>
            <div style={{ color: C.text, fontSize: 12, lineHeight: 1.7, background: C.surface, padding: 16, borderRadius: 8, fontStyle: "italic", borderLeft: `3px solid ${C.gold}` }}>"{result.oneLiner}"</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              {SECTIONS.map((k, i) => (
                <div key={k} style={{ background: C.surface, borderRadius: 8, padding: 12, borderLeft: `2px solid ${fc[i]}` }}>
                  <div style={{ color: fc[i], fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 4 }}>{k}</div>
                  <div style={{ color: C.text, fontSize: 12, lineHeight: 1.6 }}>{result.refined[k]}</div>
                </div>
              ))}
            </div>
            {result.competencies.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {result.competencies.map((c, i) => <span key={i} style={{ background: C.accent + "15", color: C.accent, border: `1px solid ${C.accent}33`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800 }}>{c}</span>)}
              </div>
            )}
          </Card>

          {result.feedback.length > 0 && (
            <Card>
              <div style={{ color: C.text, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>🎯 How To Improve Your Draft</div>
              {result.feedback.map((f, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {f}</div>)}
            </Card>
          )}

          {result.missingDetails.length > 0 && (
            <Card style={{ border: `1px solid ${C.accent}33` }}>
              <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, marginBottom: 10 }}>❓ Details That Would Make It Stronger</div>
              {result.missingDetails.map((d, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {d}</div>)}
            </Card>
          )}
        </>
      )}

      {bank.length > 0 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 14, marginBottom: 12 }}>📚 Your Story Bank <span style={{ color: C.muted, fontWeight: 600, fontSize: 11 }}>({bank.length})</span></div>
          {bank.map(s => (
            <div key={s.id} style={{ borderTop: `1px solid ${C.border}`, padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                <span style={{ color: scoreColor(s.score || 0), fontWeight: 900, fontSize: 13, minWidth: 28 }}>{s.score ?? '–'}</span>
                <span style={{ color: C.text, fontSize: 12, flex: 1 }}>{s.oneLiner || s.situation}</span>
                <span style={{ color: C.muted, fontSize: 10 }}>{s.date ? new Date(s.date).toLocaleDateString() : ''}</span>
              </div>
              {openId === s.id && (
                <div style={{ marginTop: 10 }}>
                  {s.refined && SECTIONS.map((k, i) => (
                    <div key={k} style={{ background: C.surface, borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: `2px solid ${fc[i]}` }}>
                      <div style={{ color: fc[i], fontSize: 9, fontWeight: 900, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                      <div style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>{s.refined[k]}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {s.refined && <button onClick={() => copy(`bank-${s.id}`, storyAsText(s))} style={smallBtn}>{copyLabel(`bank-${s.id}`, 'Copy')}</button>}
                    {confirmDelete === s.id
                      ? <><button onClick={() => deleteStory(s.id)} style={{ ...smallBtn, color: C.red, borderColor: C.red }}>Confirm delete</button><button onClick={() => setConfirmDelete(null)} style={smallBtn}>Cancel</button></>
                      : <button onClick={() => setConfirmDelete(s.id)} style={smallBtn}>Delete</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

const smallBtn = { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
