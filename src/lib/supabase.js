import { getValidSession } from "./session";

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://ruibdsvrcctxgxctaxwe.supabase.co";
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1aWJkc3ZyY2N0eGd4Y3RheHdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzg3MjksImV4cCI6MjA4OTA1NDcyOX0.TB2jdImKiHx6oP0aNNXObShT_eHk0wvtN_As5tkbcmE";

// Errors from the API carry the HTTP status so callers can tell an expired
// session (401/403) from a transient failure.
const httpError = (message, status) => Object.assign(new Error(message), { status });

// The `token` passed to the database helpers below comes from React state and is set at login, so it
// goes stale after about an hour. Use the stored session's token instead, refreshing it when it is
// about to expire, and fall back to the passed token only when there is no stored session.
async function freshToken(passed) {
  try {
    const session = await getValidSession();
    if (session?.access_token) return session.access_token;
  } catch { /* fall back to the token we were given */ }
  return passed;
}

// Senior Refactored Supabase Client
export const sb = {
  _h: () => ({ "Content-Type": "application/json", "apikey": SUPABASE_ANON }),
  _au: () => ({ "Content-Type": "application/json", "apikey": SUPABASE_ANON }),

  // ── Auth ───────────────────────────────────────────────────────────────────
  async _parseAuth(r) {
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch {
      console.error('[auth] non-JSON response:', r.status, text.slice(0, 200));
      return { data: null, error: { message: `Auth request failed (${r.status}). Check console for details.` } };
    }
    if (r.status >= 400 || d.error) return { data: null, error: d.error || { message: d.msg || `Request failed (${r.status})` } };
    return { data: d, error: null };
  },

  async signUp(email, password, name, extraMeta = {}) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST", headers: sb._au(),
        body: JSON.stringify({ email, password, data: { full_name: name, ...extraMeta } })
      });
      return sb._parseAuth(r);
    } catch (e) {
      return { data: null, error: { message: 'Network error — check your connection.' } };
    }
  },

  async signIn(email, password) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: sb._au(),
        body: JSON.stringify({ email, password })
      });
      return sb._parseAuth(r);
    } catch (e) {
      return { data: null, error: { message: 'Network error — check your connection.' } };
    }
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: { ...sb._au(), "Authorization": `Bearer ${token}` }
    });
  },

  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { ...sb._au(), "Authorization": `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.status >= 400) throw httpError("Session expired. Please log in again.", r.status);
    return d;
  },

  async refreshToken(refreshToken) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: sb._au(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    const d = await r.json();
    if (r.status >= 400) throw httpError("Session recovery failed.", r.status);
    return d;
  },

  // ── Relational Database Helpers ─────────────────────────────────────────────
  async upsert(table, data, token) {
    token = await freshToken(token);
    // Standardized Upsert with on_conflict support for relational scaling
    const hasUserId = !!data.user_id;
    const url = hasUserId ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=user_id` : `${SUPABASE_URL}/rest/v1/${table}`;
    
    const r = await fetch(url, {
      method: "POST",
      headers: { 
        ...sb._h(), 
        "Authorization": `Bearer ${token}`, 
        "Prefer": "resolution=merge-duplicates,return=representation" 
      },
      body: JSON.stringify(data)
    });
    
    if (r.status >= 400) {
      const d = await r.json();
      throw httpError(d.message || `Database save failed: ${r.status}`, r.status);
    }
    const resText = await r.text();
    if (r.status === 204 || !resText) return null;
    try { return JSON.parse(resText); } catch { return resText; }
  },

  async select(table, filters, token) {
    token = await freshToken(token);
    const params = new URLSearchParams(filters || {});
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { ...sb._h(), "Authorization": `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.status >= 400) throw httpError(d.message || "Database fetch failed.", r.status);
    return d;
  },

  async insert(table, data, token) {
    token = await freshToken(token);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...sb._h(), "Authorization": `Bearer ${token}`, "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    if (r.status >= 400) {
      const d = await r.json();
      throw httpError(d.message || "Database insert failed.", r.status);
    }
    return r.json();
  },

  // PATCH rows matching `filters` (PostgREST filter syntax, for example { id: 'eq.123' }) with `data`.
  // Refuses to run without a filter: an unfiltered PATCH would try to change every row the caller can see.
  async update(table, filters, data, token) {
    if (!filters || Object.keys(filters).length === 0) throw httpError("update needs at least one filter.", 400);
    token = await freshToken(token);
    const params = new URLSearchParams(filters);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "PATCH",
      headers: { ...sb._h(), "Authorization": `Bearer ${token}`, "Prefer": "return=representation" },
      body: JSON.stringify(data)
    });
    const text = await r.text();
    let d = null;
    try { d = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    if (r.status >= 400) throw httpError(d?.message || "Database update failed.", r.status);
    return d;
  },

  // Call a database function (POST /rest/v1/rpc/<name>) with a JSON object of named arguments.
  async rpc(name, args, token) {
    token = await freshToken(token);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...sb._h(), "Authorization": `Bearer ${token}` },
      body: JSON.stringify(args || {})
    });
    const text = await r.text();
    let d = null;
    try { d = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    if (r.status >= 400) throw httpError(d?.message || "Database function call failed.", r.status);
    return d;
  },

  async delete(table, filters, token) {
    token = await freshToken(token);
    const params = new URLSearchParams(filters || {});
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "DELETE",
      headers: { ...sb._h(), "Authorization": `Bearer ${token}` }
    });
    if (r.status >= 400) {
      const d = await r.json();
      throw httpError(d.message || "Database delete failed.", r.status);
    }
  }
};
