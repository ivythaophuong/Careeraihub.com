// What the AI Career Coach sends to the `ai` Edge Function, built so the request is always one the server accepts.
// The server refuses a request with more than `maxMessages` messages or more than `maxPromptChars` characters in all (supabase/functions/ai/handler.js);
// the test coachRequest.test.js fails if these two numbers drift from the server's.
//
// The request is: a 2-message block with the profile context (always kept), as much of the newest conversation as fits, and the new message.
// Old turns are dropped from the OLDEST end only, never the profile block or the new message, and the caller is told how many were left out
// so the screen can say so. Nothing is summarised: what is not sent is simply not sent.
export const COACH_LIMITS = Object.freeze({ maxMessages: 20, maxPromptChars: 200_000 });

export const CONTEXT_ACK = 'Understood — I have your full profile context loaded.';

// history: [{ role, content, loading?, error? }]. Placeholders and error bubbles are not conversation and are never sent.
// Returns { messages, dropped, kept } or { error: 'too_long', maxChars } when the new message alone cannot be sent.
export function buildCoachRequest({ systemPrompt, history, content, limits = COACH_LIMITS }) {
  const ctx = { role: 'user', content: `[COACH CONTEXT]\n${systemPrompt}\n[END CONTEXT]\n\nAcknowledge you have this context.` };
  const ack = { role: 'assistant', content: CONTEXT_ACK };
  const next = { role: 'user', content };

  const fixedChars = ctx.content.length + ack.content.length + content.length;
  if (fixedChars > limits.maxPromptChars) {
    return { error: 'too_long', maxChars: Math.max(0, limits.maxPromptChars - ctx.content.length - ack.content.length) };
  }

  const convo = (history || []).filter((m) => !m.loading && !m.error).map((m) => ({ role: m.role, content: m.content }));
  const maxPrior = limits.maxMessages - 3; // the context pair and the new message are always sent
  let charRoom = limits.maxPromptChars - fixedChars;
  const kept = [];
  for (let i = convo.length - 1; i >= 0; i--) {
    const m = convo[i];
    if (kept.length >= maxPrior || m.content.length > charRoom) break;
    kept.unshift(m);
    charRoom -= m.content.length;
  }
  let dropped = convo.length - kept.length;
  // After the context reply the next message must come from the user: do not leave an assistant turn dangling at the start of a trimmed window.
  if (dropped > 0) while (kept.length && kept[0].role !== 'user') { kept.shift(); dropped++; }

  return { messages: [ctx, ack, ...kept, next], dropped, kept: kept.length };
}
