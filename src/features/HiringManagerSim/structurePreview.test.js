import { describe, it, expect, afterEach, vi } from 'vitest';
import { structurePanelEnabledFor, previewStructure } from './structurePreview';

afterEach(() => vi.unstubAllEnvs());

describe('structurePanelEnabledFor: owner preview only, off by default', () => {
  it('is off when nothing is configured', () => {
    expect(structurePanelEnabledFor('u1')).toBe(false);
  });
  it('is on only for the listed user ids', () => {
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', 'u1, u2 ,');
    expect(structurePanelEnabledFor('u1')).toBe(true);
    expect(structurePanelEnabledFor('u2')).toBe(true);
    expect(structurePanelEnabledFor('u3')).toBe(false);
  });
  it('is off for a guest, an empty id and an empty list', () => {
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', 'u1');
    expect(structurePanelEnabledFor(undefined)).toBe(false);
    expect(structurePanelEnabledFor('')).toBe(false);
    vi.stubEnv('VITE_STRUCTURE_PANEL_USERS', ' , ');
    expect(structurePanelEnabledFor('u1')).toBe(false);
  });
});

describe('previewStructure', () => {
  const Q = 'Tell me about a time you led a project under pressure.';
  it('scores with both languages on for this preview only, and returns the rules result as it is', () => {
    const r = previewStructure({ question: Q, answer: 'I led a migration of our checkout flow, split the work into three phases and shipped it in six weeks, cutting payment errors by 30 percent.' });
    expect(r.status).toBe('scored');
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.evidence.length).toBeGreaterThan(3);
  });
  it('says insufficient_data for a very short answer, with no number', () => {
    const r = previewStructure({ question: Q, answer: 'Yes I did.' });
    expect(r.status).toBe('insufficient_data'); expect(r.score).toBeNull();
  });
  it('says unsupported_language for a writing system it does not support, with no number', () => {
    const r = previewStructure({ question: Q, answer: 'これはテストです。私はプロジェクトを率いて、期限内に完了しました。ありがとうございました。' });
    expect(r.status).toBe('unsupported_language'); expect(r.score).toBeNull();
  });
  it('never throws: a broken input is a processing_error', () => {
    const r = previewStructure(null);
    expect(['processing_error', 'insufficient_data']).toContain(r.status);
    expect(r.score).toBeNull();
  });
});
