import { useState, useEffect, useRef } from 'react';
import { sb } from '../lib/supabase';

// ── Production-Grade Relational Memory Hook ──────────────────────────────────
export function useMemory(user, isRestoring, setIsRestoring, setRestoreError) {
  const [memory, setMemory] = useState({});
  const memoryRef = useRef({}); // Synchronous mirror of memory — avoids React batching race on setState updater
  const syncLockedRef = useRef(true); // Atomic lock to prevent race conditions during initial load
  const pendingRef = useRef(null); // Queued write blocked by lock — flushed after boot
  const [isSyncing, setIsSyncing] = useState(false);
  // Set (as a fresh object each time) when a save fails, so the UI can tell the user instead of
  // leaving the failure in the console. Cleared by the next fully successful save.
  const [syncError, setSyncError] = useState(null);
  // Changes after every fully successful save, so screens that read database-computed values
  // (the practice score is recalculated by a database trigger) can re-read them.
  const [syncedAt, setSyncedAt] = useState(0);

  // 1. COMPOSITE FETCH: Load from all relational tables with isolation
  useEffect(() => {
    async function loadAll() {
      if (!user || !isRestoring) return;
      console.log("[useMemory] Refactor Boot Initializing:", { email: user.email, id: user.id });
      
      try {
        // `critical` tables must load: if the stored memory can't be read we must NOT unlock writing,
        // or the next save would overwrite the user's saved data with an empty object.
        const fetch = async (table, query = {}, { critical = false } = {}) => {
           try {
             const res = await sb.select(table, { user_id: `eq.${user.id}`, ...query }, user.token);
             return res || [];
           } catch (e) {
             if (critical) throw e;
             console.warn(`[useMemory] Partial Fetch Error for ${table}:`, e.message);
             return [];
           }
        };

        // Isolated, fault-tolerant parallel fetches
        const [
          dbMem, scans, apps, stars, covers, jds, sessions, practice, insights
        ] = await Promise.all([
          fetch("user_memory", {}, { critical: true }),
          fetch("resume_scans", { order: "created_at.desc", limit: 20 }),
          fetch("applications", { order: "created_at.desc", limit: 50 }),
          fetch("star_stories", { order: "created_at.desc", limit: 30 }),
          fetch("cover_letters", { order: "created_at.desc", limit: 20 }),
          fetch("jd_analyses", { order: "created_at.desc", limit: 20 }),
          fetch("mock_sessions", { order: "created_at.desc", limit: 20 }),
          fetch("negotiation_practice", { order: "created_at.desc", limit: 20 }),
          fetch("insights", { order: "created_at.desc", limit: 10 })
        ]);

        console.log(`[useMemory] Data Arrival: Scans(${scans.length}), Apps(${apps.length}), Stars(${stars.length})`);

        // 2. CONSTRUCT COMPOSITE STATE (Backward Compatible & Normalized)
        const base = dbMem?.[0]?.data || {}; 
        const normalize = (rows, mapper) => (rows || []).map(r => {
          const obj = { ...r, date: r.created_at };
          Object.keys(mapper).forEach(key => {
            if (r[key] !== undefined) obj[mapper[key]] = r[key];
          });
          return obj;
        });

        const compositeMap = {
          ...base,
          scanHistory: (scans && scans.length > 0) 
            ? normalize(scans, { credibility_score: 'score', file_name: 'fileName', metrics_found: 'metricsFound' }).map(s => ({
                ...s,
                // RE-ASSEMBLE: Stitch relational columns back into a unified result object for UI compatibility
                result: s.result || {
                  credibilityScore: s.score,
                  metricsFound: s.metricsFound,
                  summary: s.summary,
                  issues: s.issues || [],
                  interrogationQuestions: s.questions || []
                }
              }))
            : (base.scanHistory || []),
          applications: (apps && apps.length > 0) ? normalize(apps, { updated_at: 'updatedAt' }) : (base.applications || []),
          starBank: (stars && stars.length > 0) ? normalize(stars, { one_liner: 'oneLiner' }) : (base.starBank || []),
          coverLetters: (covers && covers.length > 0) ? normalize(covers, { follow_up: 'followUpEmail', role_title: 'roleTitle' }) : (base.coverLetters || []),
          jdAnalyses: (jds && jds.length > 0) ? normalize(jds, { role_title: 'roleTitle', match_score: 'matchScore' }) : (base.jdAnalyses || []),
          mockSessions: (sessions && sessions.length > 0) ? normalize(sessions, { questions_count: 'questionsCount', avg_score: 'avgScore' }) : (base.mockSessions || []),
          negotiationPractice: practice?.length ? practice.length : (base.negotiationPractice || 0),
          insights: insights?.length ? insights : (base.insights || []),
        };
        // Merge with any in-flight state set while locked (e.g. onboarding resume upload before boot finished)
        const merged = {
          ...compositeMap,
          resumeText: compositeMap.resumeText || memoryRef.current.resumeText,
        };
        memoryRef.current = merged;
        setMemory(merged);
        syncLockedRef.current = false; // Release lock for UI edits

        // Flush any write that was queued while boot was in progress
        if (pendingRef.current) {
          const pending = pendingRef.current;
          pendingRef.current = null;
          try {
            await sb.upsert("user_memory", { user_id: user.id, data: pending, updated_at: new Date().toISOString() }, user.token);
            console.log("[Sync] Pending writes flushed after boot.");
          } catch (e) {
            console.error("[Sync] Pending flush error:", e.message);
          }
        }

        setIsRestoring(false);
        console.log("[useMemory] Refactor Boot Complete. Memory state live.");
      } catch (e) {
        console.error("[useMemory] Refactor Global Error:", e.message);
        setRestoreError(true);
      }
    }
    loadAll();
  }, [user, isRestoring]);

  // 3. TARGETED UPDATE: Specific persistence logic
  const updateMemory = async (updater, relational = null) => {
    // Compute nextState synchronously from memoryRef — avoids undefined from React's async batching.
    // Updates MERGE into the current memory. Many callers return only the keys they own
    // (e.g. `m => ({ starBank: [...] })`), and replacing the whole state with that would silently
    // wipe unrelated memory such as the resume text, scan result and saved PDF.
    const patch = typeof updater === 'function' ? updater(memoryRef.current) : updater;
    const nextState = { ...memoryRef.current, ...(patch || {}) };
    memoryRef.current = nextState; // Update ref immediately so subsequent calls stack correctly
    setMemory(nextState);

    if (user && !syncLockedRef.current) {
      setIsSyncing(true);
      try {
        if (relational && relational.table && relational.data) {
          console.log(`[Sync] Relational Push: ${relational.table}`);
          await sb.insert(relational.table, { ...relational.data, user_id: user.id }, user.token);
        }

        await sb.upsert("user_memory", { user_id: user.id, data: nextState, updated_at: new Date().toISOString() }, user.token);
        console.log("[Sync] Memory Object Updated Successfully");
        setSyncError(null);
        setSyncedAt(Date.now());
      } catch (e) {
        console.error("[Sync] CRITICAL PERSISTENCE ERROR:", e.message);
        setSyncError({ message: e.message || 'Save failed', at: Date.now() });
        try {
           await sb.upsert("user_memory", { user_id: user.id, data: nextState }, user.token);
        } catch (inner) { console.error("[Sync] Total Persistence Blackout:", inner.message); }
      } finally {
        setIsSyncing(false);
      }
    } else if (syncLockedRef.current) {
      console.warn("[Sync] Persistence Blocked: Boot in progress. Write queued.");
      pendingRef.current = nextState; // Will be flushed when loadAll() completes
    }
  };

  return { memory, updateMemory, isSyncing, syncError, syncedAt };
}
