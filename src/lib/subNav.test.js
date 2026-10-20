import { describe, it, expect } from 'vitest';
import { SUBS_BY_MODULE, subsOf, isSub, defaultSub, tabUrl } from './subNav.js';

describe('subNav', () => {
  it('lists the six parts of the Interview Coach, in order, with their words', () => {
    expect(subsOf('simulate').map(s => s.id)).toEqual(['dashboard', 'study', 'session', 'weakness', 'starbank', 'aimemory']);
    expect(subsOf('simulate').map(s => s.label)).toEqual(['Overview', 'Study Modules', 'Live Session', 'Weakness Radar', 'STAR Bank', 'AI Memory']);
  });
  it('has no parts for a module that has none', () => {
    expect(subsOf('scan')).toEqual([]);
    expect(subsOf(undefined)).toEqual([]);
    expect(SUBS_BY_MODULE.scan).toBeUndefined();
  });
  it('knows which part names belong to which module', () => {
    expect(isSub('simulate', 'session')).toBe(true);
    expect(isSub('simulate', 'nope')).toBe(false);
    expect(isSub('scan', 'session')).toBe(false);
    expect(isSub('simulate', undefined)).toBe(false);
  });
  it('opens a module on its first part, and on none for a module without parts', () => {
    expect(defaultSub('simulate')).toBe('dashboard');
    expect(defaultSub('scan')).toBeNull();
  });
  it('writes the address with the part only when the module has parts, and drops a part it does not know', () => {
    expect(tabUrl('simulate', 'session')).toBe('?tab=simulate&sub=session');
    expect(tabUrl('simulate', 'nope')).toBe('?tab=simulate&sub=dashboard');
    expect(tabUrl('simulate')).toBe('?tab=simulate&sub=dashboard');
    expect(tabUrl('scan', 'session')).toBe('?tab=scan');
  });
});
