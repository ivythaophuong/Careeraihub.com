import React, { useState } from 'react';
import { C } from '../../styles/theme';
import { Card, Btn, Badge, Spinner, PreviewBanner } from '../../components/CommonUI';

export default function CoverLetterGen({ resumeText, form, memory, updateMemory }) {
  const [jd, setJd] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const tones = [
    { id: "professional", label: "Professional", icon: "👔" },
    { id: "confident", label: "Confident", icon: "🔥" },
    { id: "storytelling", label: "Storytelling", icon: "📖" },
    { id: "concise", label: "Ultra-Concise", icon: "⚡" },
  ];

  const generate = () => {
    if (!jd.trim()) {
      showToast("Please paste the target Job Description first", "error");
      return;
    }
    setLoading(true); setResult(null);
    setTimeout(() => {
      setResult({
        subject: `Application for ${form.role} - ${user?.name || "Candidate"}`,
        coverLetter: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${form.role} position. With over 5 years of experience in ${form.industry}, I have developed a deep expertise in ${form.role} frameworks, especially React and modular system design. In my previous role, I successfully led a checkout migration that resulted in a 15% conversion lift and 100% uptime...`,
        sellingPoints: ["5+ years experience", "Proven track record in checkout migrations", "Strong technical leadership background"]
      });
      setLoading(false);
    }, 4000);
  };

  const user = { name: "User" }; // Mock for now

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PreviewBanner />
      <div>
        <div style={{ color: C.text, fontWeight: 900, fontSize: 24 }}>Cover Letter Generator</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>AI writes a tailored letter from your real resume + JD. No generic templates.</div>
        {!resumeText && <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, marginTop: 8, padding: "8px 12px", background: C.gold + "11", borderRadius: 8, border: `1px solid ${C.gold}33` }}>⚠️ Upload your resume first for a fully personalized letter.</div>}
      </div>

      <Card>
        <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Select Tone</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
           {tones.map(t => (
             <button key={t.id} onClick={() => setTone(t.id)} style={{ background: tone === t.id ? C.orange + "22" : "transparent", border: `1px solid ${tone === t.id ? C.orange : C.border}`, color: tone === t.id ? C.orange : C.muted, borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{t.icon} {t.label}</button>
           ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.muted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Job Description (Optional)</div>
          <textarea 
            value={jd} onChange={e => setJd(e.target.value)} 
            placeholder="Paste job description for a fully tailored letter..."
            style={{ width: "100%", minHeight: 100, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 14, fontSize: 13, outline: "none", lineHeight: 1.7 }}
          />
        </div>
        <Btn onClick={generate} disabled={loading} color={C.orange} dark style={{ width: "100%", padding: 16 }}>✉️ Generate Cover Letter</Btn>
      </Card>

      {loading && <Card><Spinner label="Crafting your personalized letter..." /></Card>}

      {result && (
        <>
          <Card style={{ border: `1px solid ${C.orange}44`, background: C.orange + "05" }}>
            <div style={{ color: C.orange, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Email Subject</div>
            <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{result.subject}</div>
          </Card>
          
          <Card style={{ border: `1px solid ${C.accent}44` }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ color: C.accent, fontWeight: 900, fontSize: 14 }}>✉️ Your Cover Letter</div>
                <button onClick={() => {}} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Copy Text</button>
             </div>
             <div style={{ color: C.text, fontSize: 13, lineHeight: 2.0, background: C.surface, padding: 24, borderRadius: 10, whiteSpace: "pre-line", borderLeft: `4px solid ${C.orange}` }}>
               {result.coverLetter}
             </div>
          </Card>

          <Card>
             <div style={{ color: C.green, fontWeight: 900, fontSize: 12, marginBottom: 10 }}>💪 Key Selling Points Included</div>
             {result.sellingPoints.map((p, i) => (
               <div key={i} style={{ color: C.text, fontSize: 12, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${C.green}` }}>{p}</div>
             ))}
          </Card>
        </>
      )}
    </div>
  );
}
