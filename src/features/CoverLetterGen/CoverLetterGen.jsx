import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';
import { callLLM, extractJSON } from '../../lib/ai.jsx';
import { pickResumeSource } from '../../lib/resumeSource';
import '../../styles/featurePage.css';
import { TONES, buildCoverLetterPrompt, normalizeCoverLetterResult, blockReason, copyToClipboard, wordCount } from './coverLetter';

const label = { color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 };

export default function CoverLetterGen({ resumeText, form, memory, user, updateMemory, setAuthModal, setActiveModule }) {
  const [jd, setJd] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState(form?.role || "");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  const resume = pickResumeSource({ memory, resumeText });
  const blocked = blockReason({ resumeKind: resume.kind, resumeText });
  const needsTarget = !jd.trim() && !role.trim();

  const generate = async () => {
    if (blocked) { setErr(blocked); return; }
    if (needsTarget) { setErr("Enter the role you're applying for, or paste the job description."); return; }
    setLoading(true); setResult(null); setErr(""); setCopied("");
    try {
      const applicantName = memory?.resumeData?.personalInfo?.fullName || user?.name || "";
      const prompt = buildCoverLetterPrompt({ jd, role: role.trim(), tone, resume, applicantName, company: company.trim() });
      const raw = await callLLM([{ role: 'user', content: prompt }], 2500, resume.pdfBase64);
      const parsed = normalizeCoverLetterResult(extractJSON(raw), { role: role.trim() });
      setResult(parsed);
      setLetter(parsed.coverLetter);
      // Newest first, keep the 20 most recent.
      updateMemory?.(
        m => ({
          coverLetters: [
            { date: new Date().toISOString(), roleTitle: parsed.roleTitle, company: parsed.company, tone, subject: parsed.subject, coverLetter: parsed.coverLetter, sellingPoints: parsed.sellingPoints },
            ...(m.coverLetters || []),
          ].slice(0, 20),
        }),
        { table: 'cover_letters', data: { company: parsed.company !== 'Not stated' ? parsed.company : company.trim(), tone, subject: parsed.subject, content: parsed.coverLetter } },
      );
    } catch (e) {
      if (e.status === 401 && setAuthModal) {
        setErr('Create a free account or sign in to generate cover letters.');
        setAuthModal('register');
      } else {
        setErr(e.message || 'Could not generate the letter. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = async (what, text) => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? what : `${what}-failed`);
    setTimeout(() => setCopied(""), 2000);
  };
  const download = () => {
    if (!letter) return;
    const url = URL.createObjectURL(new Blob([letter], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = `cover-letter-${(result?.roleTitle || role || 'draft').trim().replace(/[^\w.-]+/g, '-')}.txt`; a.click();
    URL.revokeObjectURL(url);
  };
  const copyLabel = (what, idle) => copied === what ? "Copied ✓" : copied === `${what}-failed` ? "Copy failed — select the text" : idle;

  return (
    <div className="fp-wrap" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Cover Letter Generator</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>AI writes a tailored letter from your real resume + JD. No generic templates.</div>
        {blocked && (
          <div role="note" style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 8, padding: "8px 12px", background: C.gold + "11", borderRadius: 8, border: `1px solid ${C.gold}33` }}>
            ⚠️ {blocked}
            {setActiveModule && <button onClick={() => setActiveModule('scan')} style={{ marginLeft: 8, background: "transparent", border: "none", color: C.accent, fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Go to Resume Scan</button>}
          </div>
        )}
      </div>

      <Card>
        <div style={label}>Select Tone</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(TONES).map(([id, t]) => (
            <button key={id} onClick={() => setTone(id)} aria-pressed={tone === id} style={{ background: tone === id ? C.orange + "22" : "transparent", border: `1px solid ${tone === id ? C.orange : C.border}`, color: tone === id ? C.orange : C.muted, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={label}>Target Company (Optional)</div>
          <input
            aria-label="Target company"
            value={company}
            onChange={e => { setCompany(e.target.value); setErr(""); }}
            placeholder="e.g. Grab Singapore"
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={label}>Role You're Applying For</div>
          <input
            aria-label="Role"
            value={role}
            onChange={e => { setRole(e.target.value); setErr(""); }}
            placeholder="e.g. Senior Product Manager"
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={label}>Job Description (Optional)</div>
          <textarea
            aria-label="Job description"
            value={jd}
            onChange={e => { setJd(e.target.value); setErr(""); }}
            placeholder="Paste job description for a fully tailored letter..."
            style={{ width: "100%", minHeight: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 14, fontSize: 13, outline: "none", lineHeight: 1.7, fontFamily: "inherit", resize: "vertical" }}
          />
        </div>
        {err && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>⚠️ {err}</div>}
        <Btn onClick={generate} disabled={loading || !!blocked} color={C.orange} dark style={{ width: "100%", padding: 16 }}>{loading ? "Writing your letter..." : "✉️ Generate Cover Letter"}</Btn>
      </Card>

      {loading && <Card><Spinner label="Crafting your personalized letter..." /></Card>}

      {result && !loading && (
        <>
          <Card style={{ border: `1px solid ${C.orange}44`, background: C.orange + "05" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ color: C.orange, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>Email Subject</div>
              <button onClick={() => copy("subject", result.subject)} style={copyBtn}>{copyLabel("subject", "Copy Subject")}</button>
            </div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{result.subject}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>{result.roleTitle} · {result.company}</div>
          </Card>

          <Card style={{ border: `1px solid ${C.accent}44` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
              <div style={{ color: C.accent, fontWeight: 900, fontSize: 14 }}>✉️ Your Cover Letter <span style={{ color: C.muted, fontWeight: 600, fontSize: 11 }}>· {wordCount(letter)} words · editable</span></div>
              <span style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copy("letter", letter)} style={copyBtn}>{copyLabel("letter", "Copy Text")}</button>
                <button onClick={download} style={copyBtn}>Download</button>
              </span>
            </div>
            <textarea
              aria-label="Cover letter text"
              value={letter}
              onChange={e => setLetter(e.target.value)}
              style={{ width: "100%", minHeight: 320, color: C.text, fontSize: 13, lineHeight: 1.9, background: C.surface, padding: 20, borderRadius: 10, border: "none", borderLeft: `4px solid ${C.orange}`, outline: "none", resize: "vertical", fontFamily: "inherit" }}
            />
            <div style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>AI-written from your resume. Read it through and check every fact before you send it.</div>
          </Card>

          {result.sellingPoints.length > 0 && (
            <Card>
              <div style={{ color: C.green, fontWeight: 900, fontSize: 12, marginBottom: 10 }}>💪 Facts From Your Resume Used In The Letter</div>
              {result.sellingPoints.map((p, i) => (
                <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${C.green}` }}>{p}</div>
              ))}
            </Card>
          )}

          {result.missingInfo.length > 0 && (
            <Card style={{ border: `1px solid ${C.gold}33` }}>
              <div style={{ color: C.gold, fontWeight: 900, fontSize: 12, marginBottom: 10 }}>📝 Double-check Before Sending</div>
              {result.missingInfo.map((m, i) => <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6 }}>• {m}</div>)}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const copyBtn = { background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
