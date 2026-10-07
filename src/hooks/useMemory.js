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
  const memoryRef = useRef({}); // Synchronous mirror of memory — avoids React batching race on setState updater
  const userRef = useRef(user);
  userRef.current = user;
  const queueRef = useRef(Promise.resolve());
  const timerRef = useRef(null);
  const syncLockedRef = useRef(true); // Atomic lock to prevent race conditions during initial load
  const pendingWhileLockedRef = useRef(false); // A change was made during boot; save it once boot finishes
  const relationalFailedRef = useRef(false); // A relational insert failed since the last fully successful save
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
        // A failed load of the main backup row (`user_memory`) is fatal: carrying on with empty data
        // would let the next save overwrite the user's real memory. If that row loaded, saving is safe,
        // so every other table is best-effort and may fail (including a 401/403 for that one table):
        // its list just stays empty. (Treating a 401/403 on ANY table as fatal locked real accounts out
        // with "We couldn't load your saved data"; an expired session also fails `user_memory`, so the
        // safety case is already covered by the critical row.)
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

        // A change made during boot was not saved. Save the CURRENT merged state (never an older
        // snapshot, which would overwrite the stored memory that was just loaded).
        if (pendingWhileLockedRef.current) {
          pendingWhileLockedRef.current = false;
          await writeBackup();
        }

        setIsRestoring(false);
        console.log("[useMemory] Refactor Boot Complete. Memory state live.");
      } catch (e) {
        console.error("[useMemory] Refactor Global Error:", e.message);
        // Stay locked (no saves) and let the UI offer a retry. isRestoring is left as it is: the
        // restore did not finish, so it must not be reported as done.
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
  // - The returned promise resolves once the relational row (if any) has been written, so a caller
  //   that awaits it can then re-read database-computed values.
  const updateMemory = (updater, relational = null) => {
    const prev = memoryRef.current;
    const patch = typeof updater === 'function' ? updater(prev) : updater;
    const next = { ...prev, ...(patch || {}) };
    memoryRef.current = next;
    setMemory(next);

    const u = userRef.current;
    if (!u) return Promise.resolve();
    if (syncLockedRef.current) {
      console.warn("[Sync] Persistence Blocked: Boot in progress. Change will be saved once it finishes.");
      pendingWhileLockedRef.current = true;
      return Promise.resolve();
    }

    let done = Promise.resolve();
    if (relational && relational.table && relational.data) {
      done = enqueue(async () => {
        try {
          await sb.insert(relational.table, { ...relational.data, user_id: u.id }, u.token);
        } catch (e) {
          // The JSON backup below still carries this change, but tell the user the row was not saved.
          console.error(`[Sync] Relational insert failed (${relational.table}):`, e.message);
          relationalFailedRef.current = true;
          setSyncError({ message: e.message || 'Save failed', at: Date.now() });
        }
      });
    }

    scheduleBackup();
    return done;
  };

  const enqueue = (task) => {
    queueRef.current = queueRef.current.then(task, task);
    return queueRef.current;
  };

  const writeBackup = () => {
    const u = userRef.current;
    if (!u || syncLockedRef.current) return Promise.resolve();
    return enqueue(async () => {
      setIsSyncing(true);
      try {
        await sb.upsert("user_memory", {
          user_id: u.id,
          data: toBackup(memoryRef.current),
          updated_at: new Date().toISOString(),
        }, u.token);
        if (relationalFailedRef.current) {
          // The backup saved but a row did not: keep the error visible until a fully good save.
          relationalFailedRef.current = false;
        } else {
          setSyncError(null);
          setSyncedAt(Date.now());
        }
      } catch (e) {
        console.error("[Sync] Memory backup failed:", e.message);
        setSyncError({ message: e.message || 'Save failed', at: Date.now() });
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

  return { memory, updateMemory, flushMemory: flush, isSyncing, syncError, syncedAt };
}
