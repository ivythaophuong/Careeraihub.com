import React from 'react';
import { C } from '../../styles/theme';
import { Card, Badge } from '../../components/CommonUI';
import { AnimatedScore } from '../../components/OriginalFeatures';
import { GetReadyTabStrip } from '../Landing/LandingPage';
import '../../styles/featurePage.css';

// The score is the credibility score of the latest resume scan, nothing more. Without a real score the
// page says so; it never falls back to a default number, and it shows only what the scan returned.
export const statusFor = (score) => (score >= 85 ? { label: 'Strong', color: C.green } : score >= 65 ? { label: 'Needs polish', color: C.gold } : { label: 'Needs work', color: C.red });

export default function ReadinessScore({ scanResult, memory, setActiveModule, onStudyPlan, embedded }) {
  const latestHistory = memory?.scanHistory?.[0];
  const effectiveResult = scanResult || latestHistory?.result;
  const score = effectiveResult?.credibilityScore;

  if (!effectiveResult || !Number.isFinite(score)) {
    return (
      <div className="fp-wrap" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {!embedded && <GetReadyTabStrip activeModuleId="score" onNavigate={setActiveModule} onStudyPlan={onStudyPlan || (() => {})} />}
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>📊</div>
          <div style={{ color: C.text, fontWeight: 900, fontSize: 18, marginBottom: 8 }}>No readiness score yet</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Scan your resume to get a score.</div>
          <button onClick={() => setActiveModule?.("scan")} style={{ background: C.accent, color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 800, cursor: "pointer" }}>Run a scan</button>
        </div>
      </div>
    );
  }

  const { label: status, color } = statusFor(score);
  const issues = Array.isArray(effectiveResult.issues) ? effectiveResult.issues : null;
  const critical = issues ? issues.filter(i => i?.severity === 'critical').length : 0;
  const scans = memory?.scanHistory?.length || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {!embedded && <GetReadyTabStrip activeModuleId="score" onNavigate={setActiveModule} onStudyPlan={onStudyPlan || (() => {})} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Resume Readiness Score</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>From your latest resume scan. It scores how your resume reads; it does not predict hiring outcomes.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
        <Card style={{ textAlign: "center", padding: 40, border: `1px solid ${color}44`, background: color + "05" }}>
          <div style={{ color: C.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Latest scan score</div>
          <AnimatedScore value={score} color={color} size="large" suffix="/100" />
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <Badge label={status} color={color} size="md" />
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card style={{ border: `1px solid ${C.gold}33`, background: C.gold + "05" }}>
             <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Issues found in the scan</div>
             {issues
               ? <div style={{ color: C.gold, fontWeight: 900, fontSize: 20 }}>{issues.length}{critical > 0 ? ` (${critical} critical)` : ''}</div>
               : <div style={{ color: C.muted, fontSize: 13 }}>No issue details in this scan.</div>}
          </Card>
          <Card style={{ border: `1px solid ${C.purple}33`, background: C.purple + "05" }}>
             <div style={{ color: C.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Scans on record</div>
             <div style={{ color: C.purple, fontWeight: 900, fontSize: 20 }}>{scans}</div>
          </Card>
        </div>
      </div>

      <Card>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 15, marginBottom: 16 }}>Next steps</div>
        {[
          { l: "Scan against a real job description", d: "Paste the posting you are applying to and see how your resume matches it.", color: C.accent },
          { l: "Fix the issues the scan lists", d: "Start with the critical ones, and only add numbers that are true.", color: C.gold },
          { l: "Practise your answers", d: "Run a mock interview to find the answers you cannot yet back with an example.", color: C.purple },
        ].map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 14, marginBottom: 16, background: C.surface, borderRadius: 10, padding: 16, border: `1px solid ${step.color}33` }}>
            <div style={{ color: step.color, fontSize: 20 }}>→</div>
            <div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: 14 }}>{step.l}</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{step.d}</div>
            </div>
          </div>
        ))}
      </Card>
      </div>
    </div>
  );
}
