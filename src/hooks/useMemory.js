import { useState, useEffect, useRef } from 'react';
import { sb } from '../lib/supabase';

// Fields that must not be written to the JSON backup: large binaries and
// browser-session-only handles (a blob: URL is meaningless after a reload).
const SESSION_ONLY_KEYS = ['scanPdfBase64', 'originalFileUrl'];
export const BACKUP_DEBOUNCE_MS = 1000;
export const toBackup = (state) => {
  const out = { ...state };
  SESSION_ONLY_KEYS.forEach(k => { delete out[k]; });
  return out;
};

// ── Production-Grade Relational Memory Hook ──────────────────────────────────
export function useMemory(user, isRestoring, setIsRestoring, setRestoreError) {
  const [memory, setMemory] = useState({});
  const memoryRef = useRef({});
  const userRef = useRef(user);
  userRef.current = user;
  const queueRef = useRef(Promise.resolve());
  const timerRef = useRef(null);
  const syncLockedRef = useRef(true); // Atomic lock to prevent race conditions during initial load
  const [isSyncing, setIsSyncing] = useState(false);

  // 1. COMPOSITE FETCH: Load from all relational tables with isolation
  useEffect(() => {
    async function loadAll() {
      if (!user || !isRestoring) return;
      console.log("[useMemory] Refactor Boot Initializing:", { email: user.email, id: user.id });
      
      try {
        const fetch = async (table, query = {}) => {
           try {
             const res = await sb.select(table, { user_id: `eq.${user.id}`, ...query }, user.token);
             return res || [];
           } catch (e) {
             console.warn(`[useMemory] Partial Fetch Error for ${table}:`, e.message);
             return [];
           }
        };

        // Isolated, fault-tolerant parallel fetches
        const [
          dbMem, scans, apps, stars, covers, jds, sessions, practice, insights
        ] = await Promise.all([
          fetch("user_memory"),
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
        memoryRef.current = compositeMap;
        setMemory(compositeMap);
        syncLockedRef.current = false; // Release lock for UI edits
        setIsRestoring(false);
        console.log("[useMemory] Refactor Boot Complete. Memory state live.");
      } catch (e) {
        console.error("[useMemory] Refactor Global Error:", e.message);
        setRestoreError(true);
      }
    }
    loadAll();
  }, [user, isRestoring]);

  // 3. TARGETED UPDATE: merge into current state, then persist in order.
  //
  // - State is mirrored in a ref so the next state is computed synchronously
  //   (React runs setState updaters lazily, so reading it back is unreliable).
  // - Updates MERGE into the previous state. Callers may return just the keys
  //   they own; they can no longer wipe unrelated memory.
  // - Relational inserts run immediately; the JSON backup is debounced so rapid
  //   edits (e.g. typing in the ATS builder) produce one write, not one per keystroke.
  // - All writes run through one promise chain so they never overlap or reorder.
  const updateMemory = (updater, relational = null) => {
    const prev = memoryRef.current;
    const patch = typeof updater === 'function' ? updater(prev) : updater;
    const next = { ...prev, ...(patch || {}) };
    memoryRef.current = next;
    setMemory(next);

    const u = userRef.current;
    if (!u) return Promise.resolve();
    if (syncLockedRef.current) {
      console.warn("[Sync] Persistence Blocked: Boot in progress.");
      return Promise.resolve();
    }

    if (relational && relational.table && relational.data) {
      enqueue(async () => {
        try {
          await sb.insert(relational.table, { ...relational.data, user_id: u.id }, u.token);
        } catch (e) {
          // The JSON backup below still carries this change.
          console.error(`[Sync] Relational insert failed (${relational.table}):`, e.message);
        }
      });
    }

    scheduleBackup();
    return Promise.resolve();
  };

  const enqueue = (task) => {
    queueRef.current = queueRef.current.then(task, task);
    return queueRef.current;
  };

  const writeBackup = () => {
    const u = userRef.current;
    if (!u) return Promise.resolve();
    return enqueue(async () => {
      setIsSyncing(true);
      try {
        await sb.upsert("user_memory", {
          user_id: u.id,
          data: toBackup(memoryRef.current),
          updated_at: new Date().toISOString(),
        }, u.token);
      } catch (e) {
        console.error("[Sync] Memory backup failed:", e.message);
      } finally {
        setIsSyncing(false);
      }
    });
  };

  const scheduleBackup = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; writeBackup(); }, BACKUP_DEBOUNCE_MS);
  };

  // Save any pending change right away (tab hidden / unmount) instead of losing it.
  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      return writeBackup();
    }
    return queueRef.current;
  };

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, []);

  return { memory, updateMemory, flushMemory: flush, isSyncing };
}
