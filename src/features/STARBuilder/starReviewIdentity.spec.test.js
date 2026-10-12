// Specification for docs/architecture/plans/DESIGN-star-review-identity.md (D-S1), written BEFORE any code or SQL. Nothing is implemented, so every case is
// a todo. They become real tests when the design is approved and implementation starts; none of them is a promise about a rule that is not chosen yet
// (the rule for what counts, W1 or W4, is still an open decision).
import { describe, it } from 'vitest';

describe('D-S1: one story, one counted result (todo until the design is approved)', () => {
  it.todo('a second review of the same story (same story id) does not change the result that counts');
  it.todo('a light edit followed by a new review does not change the result that counts');
  it.todo('"New story" gets a new story id; "Revise this story" keeps the id');
  it.todo('deleting a low story and adding a new one does not raise what counts by routing around the rule');
  it.todo('the review log is append-only: review number 1 cannot be overwritten');
  it.todo('the server, not the client, decides which review is the counted one; a client cannot choose');
  it.todo('save accepts only a receipt the server issued for that story id');
  it.todo('an old row (no story id, no log) still shows as "Earlier AI estimate" and stays out of new aggregates');
  it.todo('a missing component is never turned into 0 and weights are not redistributed (ADR-013 Q-C)');
  it.todo('two near-identical stories get a soft warning only; similarity never decides what counts');
  it.todo('practice reviews stay unlimited apart from the existing rate limit, and every shown practice score is labelled an AI estimate');
});
