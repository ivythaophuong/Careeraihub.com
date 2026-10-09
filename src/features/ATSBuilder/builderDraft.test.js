import { describe, it, expect, beforeEach } from 'vitest';
import { builderDraftKey, clearBuilderDraft } from './ATSBuilder';

beforeEach(() => localStorage.clear());

describe('builder draft is per user (a stale draft showed another resume)', () => {
  it('uses a different key for each signed-in user and for guests', () => {
    expect(builderDraftKey('u1')).not.toBe(builderDraftKey('u2'));
    expect(builderDraftKey('u1')).not.toBe(builderDraftKey(undefined));
    expect(builderDraftKey('u1')).not.toBe('careerai_builder_draft'); // never the old shared key
  });
  it('clearing one user\'s draft leaves another user\'s alone', () => {
    localStorage.setItem(builderDraftKey('u1'), '{"a":1}');
    localStorage.setItem(builderDraftKey('u2'), '{"b":2}');
    clearBuilderDraft('u1');
    expect(localStorage.getItem(builderDraftKey('u1'))).toBeNull();
    expect(localStorage.getItem(builderDraftKey('u2'))).toBe('{"b":2}');
  });
});
