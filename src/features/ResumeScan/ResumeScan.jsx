import React, { useState, useRef } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner } from '../../components/CommonUI';
import { AnimatedScore, GlowBar } from '../../components/OriginalFeatures';
import { callLLM, extractJSON } from '../../lib/ai.jsx';

function buildScanPrompt(targetRole) {
  return `You are a ruthless hiring expert. Analyze this resume${targetRole ? ` for the role: ${targetRole}` : ''}.
Return ONLY raw JSON (no markdown, start with {):
{"credibilityScore":0-100,"metricsFound":0,"summary":"2-3 sentence verdict","issues":[{"severity":"critical|warning|ok","type":"Vague Bullet|Missing Metric|Weak Ownership|Strong Claim","original":"short quote max 8 words","fix":"specific fix"}],"interrogationQuestions":[{"source":"which claim","question":"tough specific question"}]}
Generate 4-6 issues and 5-7 questions hyper-specific to this resume's actual companies, roles, and claims.`;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Scan History Card ─────────────────────────────────────────────────────────
function ScanHistoryCard({ item, initExpanded }) {
  const [expanded, setExpanded] = useState(initExpanded);
  const res = item.result || { credibilityScore: item.score, issues: item.issues || [] };

  return (
    <Card style={{ padding: 0, overflow: 'hidden', border: expanded ? `1px solid ${C.accent}44` : `1px solid ${C.border}`, boxShadow: expanded ? `0 0 24px ${C.accent}15` : 'none' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: expanded ? C.accent + '08' : 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 24 }}>📄</div>
          <div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{item.fileName}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{new Date(item.date || Date.now()).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: res.credibilityScore >= 70 ? C.green : res.credibilityScore >= 50 ? C.gold : C.red, fontWeight: 800, fontSize: 15 }}>{res.credibilityScore}%</div>
            <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Score</div>
          </div>
          <div style={{ color: C.muted, fontSize: 16, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}44` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20, marginBottom: 20 }}>
            <Card style={{ padding: 12, border: `1px solid ${res.credibilityScore >= 70 ? C.green : C.gold}33` }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Score</div>
              <AnimatedScore value={res.credibilityScore} color={res.credibilityScore >= 70 ? C.green : res.credibilityScore >= 50 ? C.gold : C.red} size="small" />
            </Card>
            <Card style={{ padding: 12, border: `1px solid ${C.accent}33` }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Metrics</div>
              <div style={{ color: C.accent, fontSize: 18, fontWeight: 800 }}>{res.metricsFound || 0} <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>found</span></div>
            </Card>
            <Card style={{ padding: 12, border: `1px solid ${C.red}33` }}>
              <div style={{ color: C.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Issues</div>
              <div style={{ color: C.red, fontSize: 18, fontWeight: 800 }}>{res.issues?.length || 0} <span style={{ fontSize: 10, fontWeight: 400, color: C.muted }}>flags</span></div>
            </Card>
          </div>

          {res.summary && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.purple, fontWeight: 700, marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>🧠 AI Verdict</div>
              <div style={{ color: C.text, fontSize: 13, lineHeight: 1.7, background: C.purple + '08', padding: 14, borderRadius: 10, border: `1px solid ${C.purple}22` }}>{res.summary}</div>
            </div>
          )}

          {res.issues?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>📋 Issue Report</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {res.issues.map((issue, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${issue.severity === 'critical' ? C.red + '55' : issue.severity === 'warning' ? C.gold + '44' : C.green + '44'}`, borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Badge label={issue.severity} color={issue.severity === 'critical' ? C.red : issue.severity === 'warning' ? C.gold : C.green} />
                      <span style={{ color: C.muted, fontSize: 11 }}>{issue.type}</span>
                    </div>
                    <div style={{ color: C.accent, fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 8, background: '#0A1020', padding: '6px 10px', borderRadius: 6 }}>"{issue.original}"</div>
                    <div style={{ color: C.gold, fontSize: 12 }}>💡 {issue.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {res.interrogationQuestions?.length > 0 && (
            <div>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>🎯 Interrogation Questions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {res.interrogationQuestions.map((q, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ color: C.muted, fontSize: 10, marginBottom: 4 }}>From: {q.source}</div>
                    <div style={{ color: C.text, fontSize: 12 }}>{q.question}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ResumeScan({ resumeText, setResumeText, scanResult, setScanResult, form, memory, updateMemory, setActiveModule, setAuthModal }) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [paste, setPaste] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const [rawFile, setRawFile] = useState(null);
  const [localFile, setLocalFile] = useState(null); // immediate local state for UI

  const handleFile = async (file) => {
    if (!file) return;
    setFileErr('');
    setRawFile(file);
    setLocalFile({ fileName: file.name, type: file.name.endsWith('.pdf') ? 'pdf' : 'text' });
    setResumeText({ type: file.name.endsWith('.pdf') ? 'pdf' : 'text', content: null, fileName: file.name });
    setScanResult(null);
  };

  const confirmPaste = () => {
    if (paste.trim().length < 50) { setFileErr('Resume text is too short.'); return; }
    setRawFile(null);
    setResumeText({ type: 'text', content: paste, fileName: 'Pasted Resume' });
    setScanResult(null);
  };

  const runScan = async () => {
    if (!resumeText) return;
    setScanning(true);
    setScanResult(null);
    setProgress(10);
    setStep('Reading resume...');

    const steps = ['Reading resume...', 'Analyzing bullets...', 'Detecting metrics...', 'Scoring impact...', 'Generating questions...'];
    let s = 0;
    const iv = setInterval(() => {
      s++;
      if (s < steps.length) { setProgress(10 + Math.round((s / steps.length) * 75)); setStep(steps[s]); }
    }, 1200);

    try {
      const prompt = buildScanPrompt(targetRole);
      let raw;
      let base64 = null;

      if (resumeText.type === 'pdf' && rawFile) {
        const arrayBuffer = await rawFile.arrayBuffer();
        base64 = arrayBufferToBase64(arrayBuffer);
        raw = await callLLM([{ role: 'user', content: prompt }], 8192, base64);
      } else {
        raw = await callLLM([{ role: 'user', content: `${prompt}\n\nResume Text:\n${resumeText.content}` }], 8192);
      }

      clearInterval(iv);
      setProgress(100);
      setStep('Done');

      const result = extractJSON(raw);
      if (result.error) throw new Error('Failed to parse AI response');

      setScanResult(result);

      if (updateMemory) {
        updateMemory(
          m => ({
            ...m,
            scanResult: result,
            // Store base64 so ATS Builder can reuse the same PDF without re-upload
            ...(base64 ? { scanPdfBase64: base64, scanFileName: resumeText.fileName } : {}),
            scanHistory: [
              { date: new Date().toISOString(), score: result.credibilityScore, fileName: resumeText.fileName, result },
              ...(m.scanHistory || [])
            ].slice(0, 10)
          }),
          {
            table: 'resume_scans',
            data: {
              credibility_score: result.credibilityScore,
              file_name: resumeText.fileName,
              metrics_found: result.metricsFound,
              summary: result.summary || '',
              issues: result.issues || [],
              questions: result.interrogationQuestions || [],
              created_at: new Date().toISOString()
            }
          }
        );
      }
    } catch (e) {
      clearInterval(iv);
      if (e.status === 401 && setAuthModal) {
        // AI calls need a signed-in user (the server checks who is calling).
        setFileErr('Create a free account or sign in to scan your resume.');
        setAuthModal('register');
      } else {
        setFileErr(e.message || 'Scan failed. Please try again.');
      }
      console.error('[ResumeScan] Scan error:', e);
    } finally {
      setScanning(false);
      setProgress(0);
    }
  };

  const history = memory?.scanHistory || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Previous Scans */}
      {(scanResult || history.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Previous Resume Scans</div>
            <div style={{ flex: 1, height: 1, background: C.border, opacity: 0.5 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map((item, i) => <ScanHistoryCard key={i} item={item} initExpanded={i === 0 && !scanning} />)}
          </div>

          {/* Fix in ATS Builder CTA */}
          {history.length > 0 && setActiveModule && (
            <div style={{ background: `linear-gradient(135deg, ${C.accent}12, ${C.accent}06)`, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ color: C.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                  Ready to fix these issues?
                </div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                  Open ATS Builder with your resume pre-loaded and issues highlighted on each bullet.
                </div>
              </div>
              <button
                onClick={() => setActiveModule('ats')}
                style={{ whiteSpace: 'nowrap', background: C.accent, color: '#000', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
              >
                Fix in ATS Builder →
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Scan */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Deep Scan New Resume</div>
          <div style={{ flex: 1, height: 1, background: C.border, opacity: 0.5 }} />
        </div>

        {fileErr && (
          <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}44`, borderRadius: 10, padding: '12px 16px', color: C.red, fontSize: 13, fontWeight: 600 }}>
            ⚠ {fileErr}
          </div>
        )}

        <input
          value={targetRole}
          onChange={e => setTargetRole(e.target.value)}
          placeholder="Target role (optional) — e.g. Senior Product Manager"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', color: C.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
        />

        {localFile ? (
          <Card style={{ border: `1px solid ${C.accent}22`, background: C.accent + '05', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 24 }}>📄</div>
              <div>
                <div style={{ color: C.text, fontWeight: 700 }}>{localFile.fileName}</div>
                <div style={{ color: C.green, fontSize: 11, fontWeight: 700 }}>✓ Ready for Deep Scan</div>
              </div>
            </div>
            <Btn onClick={() => { setLocalFile(null); setRawFile(null); setResumeText(null); setPaste(''); }} color={C.border} style={{ padding: '6px 12px', fontSize: 11 }}>Remove</Btn>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current.click()}
              style={{ border: `2px dashed ${dragOver ? C.accent : C.border}`, borderRadius: 14, padding: '40px 32px', textAlign: 'center', background: dragOver ? C.accent + '0D' : C.surface, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Drop resume here or click to browse</div>
              <div style={{ color: C.muted, fontSize: 12, marginBottom: 20 }}>PDF · DOCX · TXT</div>
              <div style={{ display: 'inline-flex', background: C.accent, color: '#000', padding: '10px 24px', borderRadius: 20, fontWeight: 800, fontSize: 13 }}>Browse Files</div>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>

            {fileErr && <div style={{ background: C.red + '15', border: `1px solid ${C.red}44`, borderRadius: 8, padding: '12px 16px', color: C.red, fontSize: 13 }}>⚠️ {fileErr}</div>}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ color: C.muted, fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>OR PASTE TEXT</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <div>
              <textarea
                value={paste}
                onChange={e => { setPaste(e.target.value); setFileErr(''); }}
                placeholder="Paste your full resume text here..."
                style={{ width: '100%', minHeight: 140, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, color: C.text, fontSize: 13, padding: 16, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box', display: 'block', outline: 'none' }}
              />
              <Btn onClick={confirmPaste} disabled={paste.trim().length < 50} color={C.accent} dark style={{ marginTop: 12, width: '100%', borderRadius: 10 }}>✓ Use This Resume Text</Btn>
            </div>
          </div>
        )}

        {(localFile || resumeText) && !scanning && (
          <button
            onClick={runScan}
            style={{ width: '100%', background: `linear-gradient(135deg, ${C.accent}, #0096CC)`, color: '#000', border: 'none', borderRadius: 12, padding: 18, fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: `0 8px 25px ${C.accent}44` }}
          >
            🚀 Run Deep Scan
          </button>
        )}

        {scanning && (
          <Card style={{ border: `1px solid ${C.accent}44`, background: C.accent + '05' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1s infinite' }} />
                <span style={{ color: C.accent, fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{step}</span>
              </div>
              <span style={{ color: C.muted, fontSize: 12, fontWeight: 800 }}>{progress}%</span>
            </div>
            <GlowBar score={progress} color={C.accent} />
          </Card>
        )}
      </div>
    </div>
  );
}
