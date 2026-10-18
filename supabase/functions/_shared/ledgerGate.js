// One place that wraps a provider call with the usage ledger, shared by the three functions that spend AI money: ai, score-interview, score-star.
// Off unless AI_LEDGER=on. Fail-open (owner decision D-7): if the ledger cannot be reached or answers badly, the call goes through and the failure is logged.
// Only a hash, counts and ids reach the ledger; never a prompt, a CV, a story or an answer.
import { ledgerEnabled, makeLedger, estimateTokens, payloadHash } from './ledger.js';

export class LedgerLimit extends Error {
  constructor(reason) { super('usage limit reached'); this.name = 'LedgerLimit'; this.reason = reason || null; }
}

export const LIMIT_MESSAGE = 'You have reached the AI usage limit for now. Please try again later.';

// call(meter) makes the provider call and returns its result; a ProviderError (or anything else) it throws is settled honestly and rethrown.
//   usable answer ............................. completed, with the provider's reported usage
//   answered, but cut off / blocked / empty ... completed with no usage: the reservation stands as the cost (tokens were spent)
//   answered with an error status ............. failed (nothing was billed)
//   no status (timeout, network, unexpected) .. unknown: the slot is freed, the reserved tokens stay counted
export async function callWithLedger({ env, fetchImpl = fetch, ledger: dep = null, userId, feature, messages, maxTokens, pdfBase64 = null, meter, call }) {
  const ledger = ledgerEnabled(env) ? (dep || makeLedger({ env, fetchImpl })) : null;
  if (!ledger) return call(meter);

  let gate;
  try {
    gate = await ledger.reserve({ userId, key: meter.correlationId, hash: await payloadHash(messages, maxTokens, !!pdfBase64), feature,
      estTokens: estimateTokens({ messages, maxTokens, pdfBase64 }) });
  } catch { gate = { outcome: 'gate_error' }; }
  if (!gate || gate.outcome === 'gate_error') { console.error('[ai] ledger gate_error: the request goes through'); gate = { outcome: 'gate_error' }; }
  if (gate.outcome === 'limit_reached') throw new LedgerLimit(gate.reason);
  meter.gateMode = gate.gateMode ?? null;
  const holdsRow = !!(gate.requestId && (gate.outcome === 'reserved' || gate.outcome === 'existing'));

  let lastSuccess = null;
  const baseRecord = meter.record;
  meter.record = (ev) => { if (ev?.outcome === 'success') lastSuccess = ev; baseRecord?.(ev); };
  try {
    const result = await call(meter);
    if (holdsRow) {
      await ledger.settle({ id: gate.requestId, state: 'completed',
        usage: lastSuccess ? { input: lastSuccess.input_tokens, output: lastSuccess.output_tokens, thinking: lastSuccess.thinking_tokens, total: lastSuccess.total_tokens } : null,
        provider: lastSuccess?.provider ?? null, model: lastSuccess?.model ?? null }).catch(() => {});
    }
    return result;
  } catch (e) {
    if (holdsRow) {
      const answered = e?.name === 'ProviderError' && ['truncated', 'blocked', 'empty'].includes(e.kind);
      const errorStatus = e?.name === 'ProviderError' && Number.isFinite(e.status) && e.status > 0;
      if (answered) await ledger.settle({ id: gate.requestId, state: 'completed' }).catch(() => {});
      else if (errorStatus) await ledger.settle({ id: gate.requestId, state: 'failed' }).catch(() => {});
      else await ledger.markUnknown(gate.requestId).catch(() => {});
    }
    throw e;
  }
}
