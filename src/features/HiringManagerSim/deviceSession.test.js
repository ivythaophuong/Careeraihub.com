import { describe, it, expect, beforeEach } from 'vitest';
import { saveDeviceSession, loadDeviceSession, clearDeviceSession, clearAllDeviceSessions, deviceSessionKey, DEVICE_SESSION_TTL_MS } from './deviceSession';

const snap = (over = {}) => ({
  personaId: 'seriesb', role: 'PM', idx: 1, answer: 'draft', elapsedMs: 5000,
  questions: [1, 2, 3, 4, 5].map(n => ({ question: `Question number ${n}, tell me more?`, focus: `F${n}`, why: 'w' })),
  results: [{ question: 'q1', focus: 'F1', answer: 'a', score: 70 }],
  ...over,
});

beforeEach(() => sessionStorage.clear());

describe('a session kept on this device', () => {
  it('round-trips a well-formed session', () => {
    expect(saveDeviceSession('u1', snap(), 1000)).toBe(true);
    expect(loadDeviceSession('u1', 2000)).toMatchObject({ personaId: 'seriesb', idx: 1, answer: 'draft' });
  });

  it('is kept per user, never shown to another user', () => {
    saveDeviceSession('u1', snap(), 1000);
    expect(loadDeviceSession('u2', 2000)).toBeNull();
    expect(loadDeviceSession(null, 2000)).toBeNull();
  });

  it('is dropped once the 2 hour receipt window has passed', () => {
    saveDeviceSession('u1', snap(), 1000);
    expect(loadDeviceSession('u1', 1000 + DEVICE_SESSION_TTL_MS + 1)).toBeNull();
    expect(sessionStorage.getItem(deviceSessionKey('u1'))).toBeNull();
  });

  it.each([
    ['an unknown persona', { personaId: 'nope' }],
    ['an index outside the questions', { idx: 9 }],
    ['too few questions', { questions: snap().questions.slice(0, 2) }],
    ['an answer over the limit', { answer: 'x'.repeat(5000) }],
    ['a negative elapsed time', { elapsedMs: -1 }],
  ])('refuses %s and removes it', (_n, over) => {
    saveDeviceSession('u1', snap(over), 1000);
    expect(loadDeviceSession('u1', 2000)).toBeNull();
    expect(sessionStorage.getItem(deviceSessionKey('u1'))).toBeNull();
  });

  it('survives unreadable storage content', () => {
    sessionStorage.setItem(deviceSessionKey('u1'), '{not json');
    expect(loadDeviceSession('u1')).toBeNull();
  });

  it('clears one user, or every user on sign-out', () => {
    saveDeviceSession('u1', snap(), 1000); saveDeviceSession('u2', snap(), 1000);
    clearDeviceSession('u1');
    expect(loadDeviceSession('u1', 2000)).toBeNull();
    expect(loadDeviceSession('u2', 2000)).not.toBeNull();
    clearAllDeviceSessions();
    expect(loadDeviceSession('u2', 2000)).toBeNull();
  });
});
