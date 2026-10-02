import React, { useState, useEffect, useRef } from 'react';
import { Upload, Download, Sparkles } from 'lucide-react';
import { C } from '../../styles/theme';
import { Card, Btn, Spinner } from '../../components/CommonUI';

const PARSE_STEPS = [
  'Reading your resume PDF...',
  'Extracting work experience...',
  'Parsing education & skills...',
  'Identifying projects & certifications...',
  'Structuring your profile...',
];

function ParseSkeleton({ step }) {
  const Sk = ({ w = '100%', h = 14, mb = 0, radius = 6, opacity = 1 }) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: radius, marginBottom: mb, opacity }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 0%, #1E2D4540 50%, transparent 100%)', animation: 'shimmer 1.4s infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, boxShadow: `0 0 10px ${C.accent}`, animation: 'pulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{step}</span>
      </div>

      {/* Contact skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[100, 80, 70, 90, 60, 75].map((w, i) => (
          <div key={i}>
            <Sk w={40} h={9} mb={6} opacity={0.5} />
            <Sk w={`${w}%`} h={13} />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div>
        <Sk w={70} h={9} mb={10} opacity={0.5} />
        <Sk h={13} mb={6} />
        <Sk w="85%" h={13} mb={6} />
        <Sk w="60%" h={13} />
      </div>

      {/* Experience skeleton — 2 jobs */}
      {[3, 2].map((bullets, jobIdx) => (
        <div key={jobIdx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <Sk w="45%" h={14} />
            <Sk w="25%" h={12} opacity={0.5} />
          </div>
          <Sk w="35%" h={10} mb={12} opacity={0.6} />
          {Array(bullets).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.border, marginTop: 5, flexShrink: 0 }} />
              <Sk w={`${70 + i * 8}%`} h={12} />
            </div>
          ))}
        </div>
      ))}

      {/* Skills skeleton */}
      <div>
        <Sk w={50} h={9} mb={10} opacity={0.5} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[55, 70, 45, 80, 60, 50, 75, 40].map((w, i) => (
            <Sk key={i} w={w} h={26} radius={20} />
          ))}
        </div>
      </div>
    </div>
  );
}
import LeftPaneEditor from './components/LeftPaneEditor';
import RightPanePreview from './components/RightPanePreview';
import TemplateSelector from './components/TemplateSelector';
import { extractResume } from '../../lib/resumeParser';
import { callLLM, extractJSON } from '../../lib/ai.jsx';

const EMPTY_RESUME = {
  personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', website: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
};

const ALL_SECTIONS = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'];
const SECTION_LABELS = { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', certifications: 'Certifications' };

function matchIssue(bullet, scanIssues) {
  if (!bullet || !scanIssues?.length) return null;
  const bl = bullet.toLowerCase();
  let best = null, bestScore = 0;
  for (const issue of scanIssues) {
    if (!issue.original) continue;
    const words = issue.original.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const matches = words.filter(w => bl.includes(w)).length;
    const score = matches / Math.max(words.length, 1);
    if (score > 0.2 && score > bestScore) { best = issue; bestScore = score; }
  }
  return best;
}

const ATSBuilder = ({ user, memory, updateMemory }) => {
  const [data, setData] = useState(memory.resumeData || EMPTY_RESUME);
  const [activeView, setActiveView] = useState('edit');
  const [activeTemplateId, setActiveTemplateId] = useState(memory.activeTemplateId || 'harshibar');
  const [originalFileUrl, setOriginalFileUrl] = useState(memory.originalFileUrl || null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStep, setParseStep] = useState(0);
  const [parseError, setParseError] = useState(null);
  const [visibleSections, setVisibleSections] = useState(
    memory.visibleSections || Object.fromEntries(ALL_SECTIONS.map(s => [s, true]))
  );

  // suggestions: { 'exp-0-2': { text, editText, issue, status: 'loading'|'ready'|'accepted'|'skipped', isEditing } }
  const [suggestions, setSuggestions] = useState(memory.suggestions || {});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsGenerated = useRef(Object.keys(memory.suggestions || {}).length > 0);

  // Auto-parse from scan PDF if arriving from Resume Scan
  useEffect(() => {
    const hasNoData = !memory.resumeData?.personalInfo?.fullName;
    if (hasNoData && memory.scanPdfBase64 && !isParsing) autoParseFromScan();
  }, []);

  // Generate all AI suggestions once data + scan issues are ready
  useEffect(() => {
    const hasScanIssues = memory.scanResult?.issues?.length > 0;
    const hasExperience = data.experience?.length > 0;
    console.log('[ATSBuilder] suggestion effect:', { hasScanIssues, hasExperience, isParsing, generated: suggestionsGenerated.current, expCount: data.experience?.length, bulletCounts: data.experience?.map(j => j.description?.length) });
    if (hasScanIssues && hasExperience && !suggestionsGenerated.current && !isParsing) {
      suggestionsGenerated.current = true;
      generateAllSuggestions(data, memory.scanResult.issues);
    }
  }, [data, isParsing]);

  const autoParseFromScan = async () => {
    setIsParsing(true);
    setParseStep(0);
    setParseError(null);
    const stepInterval = setInterval(() => setParseStep(s => Math.min(s + 1, PARSE_STEPS.length - 1)), 1800);
    try {
      const EXTRACT_PROMPT = `Extract the resume data from the provided document and return ONLY raw JSON (no markdown, no explanation, start with {):
{"personalInfo":{"fullName":"","email":"","phone":"","location":"","linkedin":"","website":""},"summary":"","experience":[{"company":"","position":"","startDate":"","endDate":"","description":[]}],"education":[{"school":"","degree":"","year":"","gpa":""}],"skills":[{"category":"Skills","items":[]}],"projects":[{"name":"","techStack":[],"description":[],"link":""}],"certifications":[{"name":"","issuer":"","date":""}]}
Rules: group skills by category, description fields are arrays of strings, empty string or array if no data, do not invent data.`;
      const raw = await callLLM([{ role: 'user', content: EXTRACT_PROMPT }], 8192, memory.scanPdfBase64);
      const parsed = extractJSON(raw);
      if (!parsed.error) setData({ ...EMPTY_RESUME, ...parsed });
    } catch (err) {
      setParseError('Auto-parse failed. Please import your resume manually.');
    } finally {
      clearInterval(stepInterval);
      setIsParsing(false);
    }
  };

  const generateAllSuggestions = async (resumeData, scanIssues) => {
    setSuggestionsLoading(true);
    const initial = {};
    const calls = [];
    console.log('[ATSBuilder] generateAllSuggestions — experience:', resumeData.experience?.length, 'issues:', scanIssues?.length);

    const issueContext = scanIssues.map(i => `- ${i.type}: "${i.original}" → ${i.fix}`).join('\n');

    (resumeData.experience || []).forEach((job, expIdx) => {
      (job.description || []).forEach((bullet, bIdx) => {
        if (!bullet?.trim()) return;
        const matchedIssue = matchIssue(bullet, scanIssues);
        const key = `exp-${expIdx}-${bIdx}`;
        initial[key] = { text: null, editText: '', issue: matchedIssue, status: 'loading', isEditing: false };
        const prompt = matchedIssue
          ? `Rewrite this resume bullet to be more impactful and ATS-friendly.\n\nOriginal: "${bullet}"\n\nSpecific fix needed: ${matchedIssue.fix}\n\nReturn ONLY the rewritten bullet, no explanation, no quotes, no markdown.`
          : `Improve this resume bullet to be more impactful and ATS-friendly. Add metrics, strong action verbs, and specificity where possible.\n\nOriginal: "${bullet}"\n\nContext — issues found in this resume:\n${issueContext}\n\nReturn ONLY the rewritten bullet. If the bullet is already strong, return it unchanged.`;
        calls.push(
          callLLM([{ role: 'user', content: prompt }], 500)
            .then(text => ({ key, text: text.trim() }))
            .catch(() => ({ key, text: null }))
        );
      });
    });

    setSuggestions(initial);
    const results = await Promise.all(calls);
    setSuggestions(prev => {
      const next = { ...prev };
      results.forEach(({ key, text }) => {
        if (next[key]) next[key] = { ...next[key], text, editText: text || '', status: text ? 'ready' : 'skipped' };
      });
      return next;
    });
    setSuggestionsLoading(false);
  };

  const acceptSuggestion = (key, text) => {
    const [, expIdxStr, bIdxStr] = key.split('-');
    const expIdx = parseInt(expIdxStr), bIdx = parseInt(bIdxStr);
    setData(prev => {
      const exp = prev.experience.map((job, i) => {
        if (i !== expIdx) return job;
        const desc = [...job.description];
        desc[bIdx] = text;
        return { ...job, description: desc };
      });
      return { ...prev, experience: exp };
    });
    setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], status: 'accepted', isEditing: false } }));
  };

  const skipSuggestion = (key) =>
    setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], status: 'skipped', isEditing: false } }));

  const editSuggestion = (key, editing) =>
    setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], isEditing: editing } }));

  const updateEditText = (key, text) =>
    setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], editText: text } }));

  const regenerateSuggestion = async (key, bullet) => {
    const issue = suggestions[key]?.issue;
    setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], status: 'loading', isEditing: false } }));
    try {
      const prompt = issue
        ? `Rewrite this resume bullet differently — more specific, quantified, and impactful.\n\nOriginal: "${bullet}"\n\nRequirement: ${issue.fix}\n\nReturn ONLY the rewritten bullet, no explanation, no quotes.`
        : `Rewrite this resume bullet differently — more specific, quantified, and impactful. Use a strong action verb, add a metric if possible.\n\nOriginal: "${bullet}"\n\nReturn ONLY the rewritten bullet, no explanation, no quotes.`;
      const text = await callLLM([{ role: 'user', content: prompt }], 500);
      setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], text: text.trim(), editText: text.trim(), status: 'ready' } }));
    } catch {
      setSuggestions(prev => ({ ...prev, [key]: { ...prev[key], status: 'ready' } }));
    }
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    updateMemory(m => ({ ...m, resumeData: data, activeTemplateId, originalFileUrl, visibleSections, suggestions }));
  }, [data, activeTemplateId, originalFileUrl, visibleSections, suggestions]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOriginalFileUrl(URL.createObjectURL(file));
    setIsParsing(true);
    setParseError(null);
    suggestionsGenerated.current = false;
    setSuggestions({});
    updateMemory(m => ({ ...m, suggestions: {} }));
    try {
      const structured = await extractResume(file);
      setData({ ...EMPTY_RESUME, ...structured });
    } catch (err) {
      setParseError(err.message || 'Failed to parse resume.');
    } finally {
      setIsParsing(false);
    }
  };

  const scanIssues = memory.scanResult?.issues || [];
  const totalIssues = scanIssues.length;
  const criticalCount = scanIssues.filter(i => i.severity === 'critical').length;
  const resolvedCount = Object.values(suggestions).filter(s => s.status === 'accepted').length;
  const pendingCount = Object.values(suggestions).filter(s => s.status === 'ready' || s.status === 'loading').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 64px - var(--bottom-nav-h, 0px))', background: C.bg, overflow: 'hidden' }}>

      {showTemplateSelector && (
        <TemplateSelector activeId={activeTemplateId} data={data}
          onSelect={(id) => { setActiveTemplateId(id); setShowTemplateSelector(false); }}
          onClose={() => setShowTemplateSelector(false)} />
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: `1px solid ${C.border}`, background: C.surface, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '7px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11 }}>
            <Upload size={12} /> Import different resume
            <input type="file" style={{ display: 'none' }} accept=".pdf,.docx" onChange={handleFileUpload} />
          </label>
          <button onClick={() => setShowTemplateSelector(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', border: `1px solid ${C.border}`, color: C.text, padding: '7px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
            <Sparkles size={12} color={C.accent} /> Template
          </button>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ALL_SECTIONS.map(s => (
              <button key={s} onClick={() => setVisibleSections(prev => ({ ...prev, [s]: !prev[s] }))}
                style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `1px solid ${visibleSections[s] ? C.accent : C.border}`, background: visibleSections[s] ? `${C.accent}18` : 'transparent', color: visibleSections[s] ? C.accent : C.muted, transition: 'all 0.15s' }}>
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
          {isParsing && <span style={{ color: C.accent, fontSize: 11, fontWeight: 700 }}>⚡ Parsing resume...</span>}
          {parseError && <span style={{ color: C.red, fontSize: 11, fontWeight: 700 }}>⚠ {parseError}</span>}
          {totalIssues > 0 && !isParsing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {suggestionsLoading
                ? <span style={{ color: C.accent, fontSize: 11, fontWeight: 700 }}>⚡ Generating AI fixes...</span>
                : <span style={{ color: C.gold, fontSize: 11, fontWeight: 700 }}>
                    {resolvedCount}/{Object.keys(suggestions).length} fixed
                    {criticalCount > 0 && <span style={{ color: C.red, marginLeft: 6 }}>· {criticalCount} critical</span>}
                  </span>
              }
            </div>
          )}
        </div>
        <Btn onClick={() => window.print()} color={C.text}>
          <Download size={13} /> <span>Export PDF</span>
        </Btn>
      </div>

      {/* Suggestions generating banner */}
      {suggestionsLoading && (
        <div style={{ background: `${C.accent}12`, borderBottom: `1px solid ${C.accent}30`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, animation: 'pulse 1.2s ease-in-out infinite' }} />
          <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>Generating AI rewrites for your bullets — suggestions will appear inline as they load</span>
        </div>
      )}

      {/* Workspace */}
      <div style={{ display: 'flex', flex: 1, flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative' }}>
        {isMobile && (
          <div style={{ position: 'fixed', bottom: 'calc(var(--bottom-nav-h, 0px) + 16px)', left: '50%', transform: 'translateX(-50%)', display: 'flex', background: C.surface, border: `1px solid ${C.border}`, padding: 4, borderRadius: 50, zIndex: 1000, boxShadow: `0 10px 30px rgba(0,0,0,0.5)` }}>
            <button onClick={() => setActiveView('edit')} style={{ background: activeView === 'edit' ? C.accent : 'transparent', color: activeView === 'edit' ? '#000' : C.muted, border: 'none', padding: '8px 24px', borderRadius: 24, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Edit</button>
            <button onClick={() => setActiveView('preview')} style={{ background: activeView === 'preview' ? C.accent : 'transparent', color: activeView === 'preview' ? '#000' : C.muted, border: 'none', padding: '8px 24px', borderRadius: 24, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Preview</button>
          </div>
        )}

        {(activeView === 'edit' || !isMobile) && (
          <div style={{ flex: 1, overflowY: 'auto', borderRight: isMobile ? 'none' : `1px solid ${C.border}`, background: C.bg }}>
            {isParsing ? <ParseSkeleton step={PARSE_STEPS[parseStep]} /> : <LeftPaneEditor
              data={data} setData={setData}
              visibleSections={visibleSections}
              scanIssues={scanIssues}
              suggestions={suggestions}
              onAccept={acceptSuggestion}
              onSkip={skipSuggestion}
              onEdit={editSuggestion}
              onUpdateEditText={updateEditText}
              onRegenerate={regenerateSuggestion}
            />}
          </div>
        )}

        {(activeView === 'preview' || !isMobile) && (
          <div style={{ flex: 1, overflowY: 'auto', background: C.surface + '88', padding: 24 }}>
            <div style={{ maxWidth: 850, margin: '0 auto', transform: isMobile ? 'scale(0.8)' : 'none', transformOrigin: 'top' }}>
              <RightPanePreview data={data} templateId={activeTemplateId} originalFileUrl={originalFileUrl} visibleSections={visibleSections} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ATSBuilder;
