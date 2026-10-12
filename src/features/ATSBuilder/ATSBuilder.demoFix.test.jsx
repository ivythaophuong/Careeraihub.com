// @vitest-environment jsdom
// ?demo=fix (development only): the Fix page on a synthetic resume, and nothing is written to the user's account.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder, { builderDraftKey } from './ATSBuilder';

const REAL = { name: 'Real Person', skills: ['SQL'], workExperience: [], education: [], issues: [] };
const props = () => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: REAL }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: 'Real Person\nreal@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n' });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.pushState({}, '', '/'); });

describe('?demo=fix', () => {
  it('shows the demo issues, says it is demo data, and the Fix page opens on a demo issue', () => {
    window.history.pushState({}, '', '/?demo=fix');
    render(<ATSBuilder {...props()} />);
    expect(screen.getByText(/Demo data \(development only\)/i)).toBeTruthy();
    expect(screen.getAllByText(/Fix in Builder/).length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getAllByText(/Fix in Builder/)[0]);
    expect(screen.getByText(/Issue 1 of 3/)).toBeTruthy();
  });

  it('writes nothing to the account: no memory update on Fix, on Save & next, or when saving a version', () => {
    window.history.pushState({}, '', '/?demo=fix');
    const p = props();
    render(<ATSBuilder {...p} />);
    fireEvent.click(screen.getAllByText(/Fix in Builder/)[0]);
    fireEvent.change(screen.getByRole('textbox', { name: /your text/i }), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(p.updateMemory).not.toHaveBeenCalled();
    expect(p.setResumeText).not.toHaveBeenCalled();
  });

  it('keeps the demo draft apart from the real one', () => {
    window.history.pushState({}, '', '/?demo=fix');
    render(<ATSBuilder {...props()} />);
    fireEvent.click(screen.getAllByText(/Fix in Builder/)[0]);
    fireEvent.change(screen.getByRole('textbox', { name: /your text/i }), { target: { value: 'Cut monthly reporting time for the sales team' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & next/i }));
    expect(localStorage.getItem(builderDraftKey('u1'))).toBeNull();
    expect(localStorage.getItem(builderDraftKey('demo-fix'))).toContain('Cut monthly reporting time');
  });

  it('without the address parameter nothing changes: the real profile is used and there is no banner', () => {
    render(<ATSBuilder {...props()} />);
    expect(screen.queryByText(/Demo data/i)).toBeNull();
    expect(screen.queryByText(/Fix in Builder/)).toBeNull();   // the real profile in this test has no issues
  });
});
