// What the AI Career Coach sends to the `ai` Edge Function, built so the request is always one the server accepts.
// The server refuses a request with more than `maxMessages` messages or more than `maxPromptChars` characters in all (supabase/functions/ai/handler.js),
// and it counts characters as UTF-16 units, the same as JavaScript's `.length`. The test coachRequest.test.js fails if these numbers drift from the server's.
//
// The request is: a 2-message block with the profile context (always kept), as much of the newest conversation as fits, and the new message.
// Old turns are dropped from the OLDEST end only, never the profile block or the new message. Nothing is summarised: what is not sent is not sent.
// When turns are left out, the profile block says so and tells the model not to invent what it cannot see, and the caller is told how many were
// left out so the screen can say so too.
export const COACH_LIMITS = Object.freeze({ maxMessages: 20, maxPromptChars: 200_000 });

export const CONTEXT_ACK = 'Understood — I have your full profile context loaded.';

// Added to the profile block only when older messages were left out.
export const OMITTED_NOTE = 'NOTE: this conversation is longer than can be sent, so its earliest messages are not included here. If the user refers to something said earlier that you cannot see, say that you cannot see it and ask them to repeat it. Do not guess or invent it.';

const ROLES = new Set(['user', 'assistant']);
// Only real conversation is sent: a server or provider would reject another role, a non-string, or an empty message.
const isConversation = (m) => !!m && ROLES.has(m.role) && typeof m.content === 'string' && m.content.trim() !== '' && !m.loading && !m.error;

const contextMessage = (systemPrompt, note) =>
  ({ role: 'user', content: `[COACH CONTEXT]\n${systemPrompt}${note ? `\n${OMITTED_NOTE}` : ''}\n[END CONTEXT]\n\nAcknowledge you have this context.` });

// The newest messages that fit in `maxPrior` messages and `charRoom` characters.
function newest(convo, maxPrior, charRoom) {
  const kept = [];
  let room = charRoom;
  for (let i = convo.length - 1; i >= 0; i--) {
    const m = convo[i];
    if (kept.length >= maxPrior || m.content.length > room) break;
    kept.unshift(m);
    room -= m.content.length;
  }
  return kept;
}

// history: [{ role, content, loading?, error? }].
// Returns { messages, dropped, kept }, or { error: 'context_too_long' } when the profile block alone cannot be sent,
// or { error: 'too_long', maxChars } when the new message alone cannot be sent.
export function buildCoachRequest({ systemPrompt, history, content, limits = COACH_LIMITS }) {
  const ack = { role: 'assistant', content: CONTEXT_ACK };
  const next = { role: 'user', content };
  const ctxChars = contextMessage(systemPrompt, false).content.length + ack.content.length;
  if (ctxChars > limits.maxPromptChars) return { error: 'context_too_long' };

  const fixedChars = ctxChars + content.length;
  if (fixedChars > limits.maxPromptChars) return { error: 'too_long', maxChars: limits.maxPromptChars - ctxChars };

  const convo = (history || []).filter(isConversation).map((m) => ({ role: m.role, content: m.content }));
  const maxPrior = limits.maxMessages - 3; // the context pair and the new message are always sent

  let kept = newest(convo, maxPrior, limits.maxPromptChars - fixedChars);
  let note = false;
  // If anything is left out, say so in the profile block. The note takes room, so the window is chosen again with that room reserved
  // (and left out if it cannot fit at all next to a very large new message).
  if (kept.length < convo.length) {
    const noteChars = OMITTED_NOTE.length + 1;
    if (fixedChars + noteChars <= limits.maxPromptChars) {
      kept = newest(convo, maxPrior, limits.maxPromptChars - fixedChars - noteChars);
      note = true;
    }
  }
  let dropped = convo.length - kept.length;
  // After the context reply the next message must come from the user: do not leave an assistant turn dangling at the start of a trimmed window.
  if (dropped > 0) while (kept.length && kept[0].role !== 'user') { kept.shift(); dropped++; }

  return { messages: [contextMessage(systemPrompt, note), ack, ...kept, next], dropped, kept: kept.length };
}
