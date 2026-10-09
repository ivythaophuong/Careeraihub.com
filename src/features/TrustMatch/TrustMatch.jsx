import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sb } from '../../lib/supabase';
import './trustMatch.css';
import { ShareControl, MySharing, useConsents } from './ConsentUI';
import { consentFlowEnabled } from './consent';
import { COPY } from './consentCopy';

const T = {
  bg: '#0B0F1A', bg2: '#0E1420', bg3: '#131B2E', bg4: '#1A2540',
  text: '#F0F4FF', text2: '#8B9DC3', text3: '#4A5A7A',
  teal: '#EC4899', tealDim: 'rgba(236,72,153,.08)', tealB: 'rgba(236,72,153,.25)', tealB2: 'rgba(236,72,153,.5)',
  violet: '#F59E0B', violetDim: 'rgba(245,158,11,.08)', violetB: 'rgba(245,158,11,.3)', violetTxt: '#C470FF',
  emerald: '#00E5A0', emeraldDim: 'rgba(0,229,160,.08)', emeraldB: 'rgba(0,229,160,.28)',
  gold: '#FFD233', red: '#FF4D6A',
  bdr: 'rgba(236,72,153,.1)', bdr2: 'rgba(236,72,153,.18)',
  grad: 'linear-gradient(135deg,#EC4899 0%,#F59E0B 100%)',
};
const FF  = "'Inter', system-ui, sans-serif";
const FFM = "'JetBrains Mono', monospace";

function salaryLabel(j) {
  if (!j.salary_min) return '';
  return `${j.currency || 'USD'} ${(j.salary_min / 1000).toFixed(0)}–${(j.salary_max / 1000).toFixed(0)}k`;
}

function initials(name) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Profile edit modal ─────────────────────────────────────────────────────────
function ProfileModal({ user, trustProfile, onSave, onClose }) {
  const [bio,      setBio]      = useState(trustProfile?.bio || '');
  const [headline, setHeadline] = useState(trustProfile?.headline || '');
  const [skills,   setSkills]   = useState((trustProfile?.skills || []).join(', '));
  const [salMin,   setSalMin]   = useState(trustProfile?.salary_min || '');
  const [salMax,   setSalMax]   = useState(trustProfile?.salary_max || '');
  const [pref,     setPref]     = useState(trustProfile?.work_preference || 'hybrid');
  const [visible,  setVisible]  = useState(trustProfile?.is_visible || false);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState('');

  const save = async () => {
    setSaving(true);
    setSaveErr('');
    const data = {
      user_id:         user.id,
      full_name:       user.name || user.email,
      headline,
      bio,
      skills:          skills.split(',').map(s => s.trim()).filter(Boolean),
      salary_min:      salMin ? parseInt(salMin) : null,
      salary_max:      salMax ? parseInt(salMax) : null,
      work_preference: pref,
      is_visible:      visible,
      updated_at:      new Date().toISOString(),
    };
    try {
      await sb.upsert('candidate_trust_profiles', data, user.token);
      onSave({ ...data, trust_score: trustProfile?.trust_score || 0 });
    } catch (e) {
      console.error('Profile save failed:', e.message);
      setSaveErr("Couldn't save your profile. Check your connection and try again.");
    }
    setSaving(false);
  };

  const inp = { background: 'rgba(255,255,255,.05)', border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: '9px 12px', color: T.text, fontSize: 12, outline: 'none', fontFamily: FF, width: '100%', boxSizing: 'border-box' };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
      <div style={{ background: T.bg2, border: `1px solid ${T.tealB}`, borderRadius: 18, padding: '28px 24px', maxWidth: 460, width: '92%', maxHeight: '85vh', overflowY: 'auto', boxShadow: `0 0 80px rgba(236,72,153,.1), 0 32px 80px rgba(0,0,0,.7)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Candidate Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Visibility toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: visible ? T.emeraldDim : 'rgba(255,255,255,.03)', border: `1px solid ${visible ? T.emeraldB : 'rgba(255,255,255,.08)'}`, borderRadius: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: visible ? T.emerald : T.text2 }}>
              {visible ? 'Visible to recruiters' : 'Hidden from recruiters'}
            </div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>
              {visible ? 'Verified employers can discover your profile' : 'Toggle on to enter TrustMatch marketplace'}
            </div>
          </div>
          <button onClick={() => setVisible(v => !v)}
            style={{ width: 44, height: 24, borderRadius: 12, background: visible ? T.emerald : 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: visible ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Headline', headline, setHeadline, 'e.g. Senior AI Engineer · Singapore'], ['Bio', bio, setBio, 'Brief intro for recruiters...', true]].map(([label, val, setter, ph, multi]) => (
            <div key={label}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3, marginBottom: 5 }}>{label}</div>
              {multi
                ? <textarea value={val} onChange={e => setter(e.target.value)} placeholder={ph} rows={3} style={{ ...inp, resize: 'vertical' }} />
                : <input value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={inp} />}
            </div>
          ))}

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3, marginBottom: 5 }}>Skills (comma-separated)</div>
            <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Python, AWS, React, SQL..." style={inp} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Salary Min', salMin, setSalMin, '10000'], ['Salary Max', salMax, setSalMax, '16000']].map(([label, val, setter, ph]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3, marginBottom: 5 }}>{label}</div>
                <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3, marginBottom: 5 }}>Work Preference</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['remote', 'hybrid', 'onsite'].map(p => (
                <button key={p} onClick={() => setPref(p)}
                  style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: `1px solid ${pref === p ? T.tealB2 : T.bdr}`, background: pref === p ? T.tealDim : 'transparent', color: pref === p ? T.teal : T.text3, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: FF, transition: 'all .15s' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {saveErr && <div role="alert" style={{ marginTop: 14, fontSize: 12, color: '#FF5A5A' }}>{saveErr}</div>}
        <button onClick={save} disabled={saving}
          style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 10, background: saving ? 'rgba(236,72,153,.1)' : 'linear-gradient(135deg,rgba(236,72,153,.2),rgba(245,158,11,.2))', border: `1px solid ${T.tealB}`, color: T.teal, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FF, transition: 'all .2s' }}>
          {saving ? 'Saving…' : 'Save Profile →'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrustMatch({ user, memory, updateMemory, syncedAt }) {
  const [jobs,          setJobs]         = useState([]);
  const [jobsLoading,   setJobsLoading]  = useState(true);
  const [trustProfile,  setTrustProfile] = useState(null);
  const [interested,    setInterested]   = useState(new Set());
  const [activeTab,     setActiveTab]    = useState('discover');
  const [chatMatchId,   setChatMatchId]  = useState(null);
  const [modalJob,      setModalJob]     = useState(null);
  const [showProfile,   setShowProfile]  = useState(false);
  const [chatInput,     setChatInput]    = useState('');
  const [chatMsgs,      setChatMsgs]     = useState({});
  const chatBodyRef = useRef(null);
  // Consent flow (docs/architecture/plans/CONSENT-FLOW-DESIGN.md): everything below is inert unless the flag is on.
  const consentOn = consentFlowEnabled();
  const { consents, error: consentError, reload: reloadConsents } = useConsents({ token: user?.token, enabled: consentOn });

  const displayJobs = jobs; // real listings only; never sample jobs
  const matchedJobs = displayJobs.filter(j => interested.has(j.id));
  const chatJob     = displayJobs.find(j => j.id === chatMatchId) || null;
  const unreadCount = 0;
  const employerNames = Object.fromEntries(displayJobs.filter(j => j.employer_id && j.employer_name).map(j => [j.employer_id, j.employer_name]));

  const userName  = user?.name || user?.email?.split('@')[0] || 'Candidate';
  const userInits = initials(userName);
  const trustScore = trustProfile?.trust_score || 0;
  const trustColor = trustScore >= 75 ? T.emerald : trustScore >= 50 ? T.gold : trustScore > 0 ? T.teal : T.text3;
  const trustDashOffset = Math.max(0, 131.9 - (trustScore / 100) * 131.9);

  // Fetch trust profile + job listings on mount
  useEffect(() => {
    if (!user?.token) { setJobsLoading(false); return; }

    const fetchAll = async () => {
      try {
        const [profileRows, jobRows] = await Promise.all([
          sb.select('candidate_trust_profiles', { user_id: `eq.${user.id}` }, user.token),
          sb.select('job_listings', { status: 'eq.open', order: 'created_at.desc', limit: 20 }, user.token),
        ]);
        if (profileRows?.length) setTrustProfile(profileRows[0]);
        let shownJobs = jobRows;
        if (consentOn) {
          // Same open jobs, plus the employer name, so the candidate can see who would receive their profile. Without it the share button is not offered.
          try {
            const named = await sb.rpc('list_open_jobs', { p_limit: 20 }, user.token);
            if (Array.isArray(named) && named.length) shownJobs = named;
          } catch (e) { console.warn('[TrustMatch] list_open_jobs unavailable:', e.message); }
        }
        if (shownJobs?.length) setJobs(shownJobs);
      } catch (e) {
        console.warn('[TrustMatch] fetch error:', e.message);
      }
      setJobsLoading(false);
    };

    fetchAll();
  }, [user, syncedAt]);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatMsgs, chatMatchId]);

  const initMsgs = (job) => {
    setChatMsgs(prev => ({
      ...prev,
      [job.id]: prev[job.id] || [
        { type: 'sys',  text: 'Verified credentials shared from message one' },
        { type: 'left', sender: `${job.employer_name || job.title} · Recruiter`,
          text: `Hi ${userName.split(' ')[0]}, we reviewed your verified profile. Are you open to our ${job.title} role?` },
      ],
    }));
  };

  const toggleInterest = (id) => {
    const job = displayJobs.find(j => j.id === id);
    if (!job) return;
    if (interested.has(id)) {
      setInterested(prev => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      setInterested(prev => new Set([...prev, id]));
      initMsgs(job);
      setTimeout(() => setModalJob(job), 350);
    }
  };

  const openChat = (id) => {
    const job = displayJobs.find(j => j.id === id);
    if (!job) return;
    initMsgs(job);
    setChatMatchId(id);
  };

  const sendMsg = () => {
    if (!chatInput.trim() || !chatMatchId) return;
    setChatMsgs(prev => ({
      ...prev,
      [chatMatchId]: [...(prev[chatMatchId] || []), { type: 'right', sender: userName, text: chatInput.trim() }],
    }));
    setChatInput('');
  };

  // ── Left panel ─────────────────────────────────────────────────────────────
  const renderLeft = () => (
    <div className="tm-left-pane" style={{ width: 260, minWidth: 260, background: T.bg2, borderRight: `1px solid ${T.bdr}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: T.text3 }}>My Profile</span>
        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, background: T.emeraldDim, color: T.emerald, border: `1px solid ${T.emeraldB}`, fontWeight: 700 }}>Candidate</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Profile hero */}
        <div style={{ background: T.bg3, border: `1px solid ${T.tealB}`, borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: T.grad }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', border: `2px solid ${T.tealB}`, boxShadow: '0 0 14px rgba(236,72,153,.2)', flexShrink: 0 }}>{userInits}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: '-.2px' }}>{userName}</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>{trustProfile?.headline || 'Complete your profile →'}</div>
            </div>
          </div>
          <button onClick={() => setShowProfile(true)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: T.tealDim, border: `1px solid ${T.tealB}`, color: T.teal, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FF, transition: 'all .15s' }}>
            {trustProfile?.is_visible ? '✓ Visible · Edit profile' : 'Set up profile & visibility →'}
          </button>
        </div>

        {/* Trust ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: T.bg4, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ position: 'relative', flexShrink: 0, width: 50, height: 50 }}>
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="21" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <circle cx="25" cy="25" r="21" fill="none" stroke={trustColor} strokeWidth="5"
                strokeDasharray="131.9" strokeDashoffset={trustDashOffset} strokeLinecap="round"
                transform="rotate(-90 25 25)" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, fontFamily: FFM, color: '#fff' }}>{trustScore}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3 }}>Practice Score</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FFM, color: trustColor, lineHeight: 1, letterSpacing: -1 }}>{trustScore} / 100</div>
            <div style={{ fontSize: 10, color: T.text2, marginTop: 1 }}>
              {trustScore >= 75 ? 'Strong practice' : trustScore >= 50 ? 'Growing · Keep going' : trustScore > 0 ? 'Getting started' : 'Practise to build your score'}
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        {trustProfile && (
          <div style={{ background: T.bg3, border: `1px solid ${T.bdr}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: T.text3, marginBottom: 8 }}>Score breakdown</div>
            {[['ATS Resume', trustProfile.ats_score, T.teal, 0.40], ['Interview Sim', trustProfile.interview_score, T.violet, 0.35], ['STAR Stories', trustProfile.star_score, T.emerald, 0.25]].map(([label, score, color, weight]) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                  <span style={{ color: T.text2 }}>{label} <span style={{ color: T.text3 }}>({Math.round(weight * 100)}%)</span></span>
                  <span style={{ fontFamily: FFM, color, fontWeight: 700 }}>{score}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: 3, borderRadius: 2, background: color, width: `${score}%`, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {trustProfile?.skills?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {trustProfile.skills.map(s => (
              <span key={s} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: T.tealDim, color: T.teal, border: `1px solid ${T.tealB}`, fontFamily: FFM }}>{s}</span>
            ))}
          </div>
        )}

        {/* Boost card */}
        <div style={{ background: T.violetDim, border: `1px solid ${T.violetB}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.violetTxt, marginBottom: 8 }}>Raise your practice score</div>
          {[
            { label: 'Resume ATS scan',    done: !!(trustProfile?.ats_score),      pts: '+40 pts weight' },
            { label: 'Interview sim',      done: !!(trustProfile?.interview_score), pts: '+35 pts weight' },
            { label: 'STAR story bank',    done: !!(trustProfile?.star_score),      pts: '+25 pts weight' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,.04)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: T.text2 }}>
                {item.done
                  ? <div style={{ width: 13, height: 13, borderRadius: '50%', background: T.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#0B0F1A', flexShrink: 0 }}>✓</div>
                  : <div style={{ width: 13, height: 13, borderRadius: '50%', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', flexShrink: 0 }} />}
                {item.label}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: item.done ? T.text3 : T.emerald }}>{item.done ? 'done' : item.pts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Center panel ────────────────────────────────────────────────────────────
  const renderCenter = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.bdr}`, flexShrink: 0, background: 'rgba(11,15,26,.6)', backdropFilter: 'blur(16px)' }}>
        {[{ id: 'discover', label: 'Discover', badge: null }, { id: 'matches', label: 'Matches', badge: matchedJobs.length || null }, ...(consentOn ? [{ id: 'sharing', label: COPY.tabLabel, badge: null }] : [])].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, padding: '11px 8px', background: 'none', border: 'none', fontSize: 11, fontWeight: 500, color: activeTab === tab.id ? T.teal : T.text3, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: FF, transition: 'color .2s' }}>
            {tab.label}
            {tab.badge !== null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: T.red, fontSize: 9, fontWeight: 700, color: '#fff' }}>{tab.badge}</span>
            )}
            {activeTab === tab.id && <span style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, background: T.teal, borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {/* Discover */}
      {activeTab === 'discover' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobsLoading ? (
            <div style={{ textAlign: 'center', color: T.text3, padding: '40px 20px', fontSize: 12 }}>Loading opportunities…</div>
          ) : displayJobs.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.text3, padding: '40px 20px', fontSize: 12, lineHeight: 1.7 }}>
              No open roles from verified employers yet.<br />Complete your profile and turn on visibility, and you'll be matched when employers post roles.
            </div>
          ) : displayJobs.map((job, i) => {
            const on = interested.has(job.id);
            const logoText = job.employer_logo || (job.employer_name || 'Co').slice(0, 2).toUpperCase();
            const logoBg   = job.employer_bg || '#534AB7';
            return (
              <div key={job.id} className="tm-co-card"
                style={{ background: 'linear-gradient(145deg,rgba(13,20,40,.96),rgba(11,16,26,.98))', border: `1px solid ${on ? 'rgba(0,229,160,.35)' : 'rgba(236,72,153,.12)'}`, borderRadius: 18, padding: 18, position: 'relative', overflow: 'hidden', boxShadow: on ? '0 0 24px rgba(0,229,160,.08)' : 'none', transition: 'border-color .2s, box-shadow .2s', animationDelay: `${i * 0.07}s` }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(236,72,153,.2),transparent)' }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: logoBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{logoText}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-.2px' }}>{job.employer_name || 'Employer'}</span>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,229,160,.08)', color: T.emerald, border: `1px solid ${T.emeraldB}`, fontWeight: 600 }}>✓ verified</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>{job.industry || ''} · {job.size || ''}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{job.title} {salaryLabel(job) ? `· ${salaryLabel(job)}` : ''}</div>
                  </div>
                  {job.fit && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FFM, background: T.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1 }}>{job.fit}%</div>
                      <div style={{ fontSize: 9, color: T.text3, marginTop: 2 }}>fit score</div>
                    </div>
                  )}
                </div>

                {job.description && <div style={{ fontSize: 11, color: T.text2, lineHeight: 1.65, marginBottom: 12 }}>{job.description}</div>}

                {(job.perks || job.skills_required || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
                    {(job.perks || job.skills_required || []).map(p => (
                      <span key={p} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: 'rgba(245,158,11,.08)', color: T.violetTxt, border: '1px solid rgba(245,158,11,.22)' }}>{p}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="tm-btn-interested" onClick={() => toggleInterest(job.id)}
                    style={{ padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${on ? T.emeraldB : 'rgba(245,158,11,.3)'}`, background: on ? 'rgba(0,229,160,.12)' : 'rgba(245,158,11,.1)', color: on ? T.emerald : T.violetTxt, cursor: 'pointer', transition: 'all .2s', fontFamily: FF }}>
                    {on ? '✓ Interested' : "I'm interested →"}
                  </button>
                  <button className="tm-btn-learn" onClick={() => openChat(job.id)}
                    style={{ padding: 10, borderRadius: 8, fontSize: 12, color: T.text3, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', cursor: 'pointer', transition: 'all .2s', fontFamily: FF }}>
                    Open TrustChat
                  </button>
                </div>
                {consentOn && <ShareControl job={job} profile={trustProfile} token={user?.token} consents={consents} onChanged={reloadConsents} />}
              </div>
            );
          })}
        </div>
      )}

      {consentOn && activeTab === 'sharing' && (
        <MySharing consents={consents} employerNames={employerNames} token={user?.token} loadError={consentError} onChanged={reloadConsents} />
      )}

      {/* Matches */}
      {activeTab === 'matches' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {matchedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: T.text3, fontSize: 12, lineHeight: 1.8 }}>
              Express interest in a role to start matching.<br />
              <span style={{ fontSize: 10 }}>Tap "I'm interested" on any role above.</span>
            </div>
          ) : matchedJobs.map((job, i) => (
            <div key={job.id} className="tm-match-item" onClick={() => openChat(job.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(0,229,160,.04)', border: '1px solid rgba(0,229,160,.18)', borderRadius: 12, marginBottom: 8, cursor: 'pointer', transition: 'all .2s', animationDelay: `${i * 0.06}s` }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: job.employer_bg || '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {(job.employer_logo || (job.employer_name || 'Co').slice(0, 2)).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 1 }}>{job.employer_name || 'Employer'}</div>
                <div style={{ fontSize: 10, color: T.text3 }}>{job.title}</div>
                {job.fit && <div style={{ fontSize: 10, fontWeight: 700, fontFamily: FFM, color: T.teal, marginTop: 2 }}>{job.fit}% fit</div>}
              </div>
              <div style={{ fontSize: 10, color: T.emerald, fontWeight: 600, flexShrink: 0 }}>Open TrustChat →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Right panel ─────────────────────────────────────────────────────────────
  const renderRight = () => (
    <div className="tm-right-pane" style={{ width: 300, minWidth: 300, background: T.bg2, borderLeft: `1px solid ${T.bdr}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.bdr}`, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: T.text3 }}>Trust &amp; Activity</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Trust score card */}
        <div style={{ background: T.bg3, border: `1px solid ${T.tealB}`, borderRadius: 12, padding: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: T.grad }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>Practice score</span>
            <span style={{ fontSize: 11, fontFamily: FFM, fontWeight: 700, color: trustColor }}>{trustScore} / 100</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: 6, borderRadius: 3, background: `linear-gradient(90deg,${T.teal},${T.emerald})`, width: `${trustScore}%`, transition: 'width 1.2s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5 }}>
            Based on your own practice (resume scan, interview answers, STAR stories). It does not include verified credentials.
            {trustScore === 0 && ' Your score will appear here after completing any module.'}
          </div>
        </div>

        {/* Your own target range (not market data) */}
        <div style={{ background: 'rgba(255,210,51,.05)', border: '1px solid rgba(255,210,51,.18)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, marginBottom: 10 }}>Your target range</div>
          {trustProfile?.salary_min ? (
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: FFM, color: T.gold, letterSpacing: '-.5px', marginBottom: 4 }}>
              {trustProfile.currency || 'USD'} {(trustProfile.salary_min / 1000).toFixed(0)}–{(trustProfile.salary_max / 1000).toFixed(0)}k
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.text3 }}>Set your target range in your profile to see it here.</div>
          )}
        </div>

        {/* Visibility status */}
        <div style={{ background: trustProfile?.is_visible ? T.emeraldDim : 'rgba(255,255,255,.02)', border: `1px solid ${trustProfile?.is_visible ? T.emeraldB : 'rgba(255,255,255,.06)'}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: trustProfile?.is_visible ? T.emerald : T.text3, marginBottom: 6 }}>
            {trustProfile?.is_visible ? '✓ Visible to verified recruiters' : 'Not visible to recruiters'}
          </div>
          <div style={{ fontSize: 10, color: T.text3, lineHeight: 1.5, marginBottom: 10 }}>
            {trustProfile?.is_visible ? 'Employers with verified accounts can discover your profile.' : 'Toggle visibility in your profile to enter the TrustMatch marketplace.'}
          </div>
          <button onClick={() => setShowProfile(true)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: trustProfile?.is_visible ? 'rgba(0,229,160,.1)' : 'rgba(245,158,11,.1)', border: `1px solid ${trustProfile?.is_visible ? T.emeraldB : T.violetB}`, color: trustProfile?.is_visible ? T.emerald : T.violetTxt, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FF, transition: 'all .15s' }}>
            {trustProfile?.is_visible ? 'Edit profile' : 'Set up visibility →'}
          </button>
        </div>
      </div>

      {/* TrustChat slide-over */}
      {chatJob && (
        <div className="tm-chat-panel" style={{ position: 'absolute', inset: 0, background: T.bg2, zIndex: 40, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.bdr}`, flexShrink: 0 }}>
            <button className="tm-chat-back" onClick={() => setChatMatchId(null)}
              style={{ background: 'none', border: 'none', color: T.text3, fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: '2px 6px', fontFamily: FF, transition: 'color .15s' }}>←</button>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: chatJob.employer_bg || '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(chatJob.employer_logo || (chatJob.employer_name || 'Co').slice(0, 2)).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{chatJob.employer_name || 'Employer'}</div>
              <div style={{ fontSize: 10, color: T.text3 }}>{chatJob.title} · TrustChat active</div>
            </div>
          </div>

          <div ref={chatBodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(chatMsgs[chatMatchId] || []).map((msg, i) => {
              if (msg.type === 'sys') return <div key={i} style={{ textAlign: 'center', fontSize: 10, color: T.text3, padding: '4px 0', fontStyle: 'italic' }}>{msg.text}</div>;
              const isRight = msg.type === 'right';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '9px 13px', fontSize: 12, lineHeight: 1.55, background: isRight ? 'rgba(245,158,11,.15)' : 'rgba(255,255,255,.05)', color: isRight ? '#D4ADFF' : T.text2, borderRadius: isRight ? '12px 12px 2px 12px' : '12px 12px 12px 2px' }}>
                    <div style={{ fontSize: 9, color: T.text3, marginBottom: 3 }}>{msg.sender}</div>
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.bdr}`, display: 'flex', gap: 8, flexShrink: 0 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
              placeholder="Reply to recruiter…"
              style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: '9px 12px', color: T.text, fontSize: 12, outline: 'none', fontFamily: FF }} />
            <button className="tm-send" onClick={sendMsg}
              style={{ padding: '9px 16px', background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, color: T.violetTxt, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FF, flexShrink: 0 }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Match modal ─────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modalJob) return null;
    return (
      <div onClick={e => e.target === e.currentTarget && setModalJob(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
        <div className="tm-modal"
          style={{ background: T.bg2, border: '1px solid rgba(245,158,11,.4)', borderRadius: 18, padding: '34px 28px', maxWidth: 400, width: '92%', textAlign: 'center', boxShadow: '0 0 100px rgba(245,158,11,.2),0 32px 80px rgba(0,0,0,.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 8, background: T.grad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>It's a Match!</div>
          <div style={{ fontSize: 13, color: T.text2, marginBottom: 22, lineHeight: 1.7 }}>
            <strong>{modalJob.employer_name || 'This employer'}</strong> has shortlisted you.<br />
            TrustChat is now open — credentials visible from message one.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 22 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', border: '2px solid rgba(236,72,153,.4)' }}>{userInits}</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(245,158,11,.5)' }} />)}
            </div>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: modalJob.employer_bg || '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', border: '2px solid rgba(245,158,11,.4)' }}>
              {(modalJob.employer_logo || (modalJob.employer_name || 'Co').slice(0, 2)).toUpperCase()}
            </div>
          </div>
          <button className="tm-mm-btn"
            onClick={() => { setModalJob(null); openChat(modalJob.id); setActiveTab('matches'); }}
            style={{ width: '100%', padding: 13, borderRadius: 12, background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.4)', color: T.violetTxt, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FF, transition: 'all .2s' }}>
            Open TrustChat →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="tm-outer" style={{ display: 'flex', height: 'calc(100vh - 116px)', overflow: 'hidden', background: T.bg, fontFamily: FF, fontSize: 14, lineHeight: 1.6, color: T.text }}>
      {renderLeft()}
      {renderCenter()}
      {renderRight()}
      {renderModal()}
      {showProfile && (
        <ProfileModal
          user={user}
          trustProfile={trustProfile}
          onSave={(updated) => { setTrustProfile(prev => ({ ...prev, ...updated })); setShowProfile(false); }}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
