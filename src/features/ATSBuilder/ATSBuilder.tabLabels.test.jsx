// @vitest-environment jsdom
// The four tabs of the Resume Builder are named for what the user does there, and the sentences that point to a tab use the same names (design:
// docs/architecture/plans/DESIGN-guided-journey.md, section 3.3, Job A). The product owner kept "Upload & Parse" and "Builder" as they are and renamed the other two.
// Only the labels change: the tab ids, what each tab does and the other words are untouched.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder from './ATSBuilder';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'innerWidth', { value: 1800, configurable: true, writable: true });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const profile = { name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [], workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Built a dashboard'] }], issues: [] };
const base = (over = {}) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: 'Jane Example\njane@example.com\n', ...over });
const tab = (name) => screen.getByRole('button', { name });

describe('the tabs of the Resume Builder', () => {
  it('keep "Upload & Parse" and "Builder", and the other two say what the user does there', () => {
    render(<ATSBuilder {...base()} />);
    for (const name of ['Upload & Parse', 'Builder', 'Layout & download', 'Saved versions']) expect(tab(name)).toBeTruthy();
  });

  it('no longer use the old names of the two that were renamed', () => {
    render(<ATSBuilder {...base()} />);
    for (const name of ['Templates', 'Version History']) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('still lead to the same screens', () => {
    render(<ATSBuilder {...base()} />);
    expect(tab('Upload & Parse').getAttribute('aria-current')).toBe('page');
    fireEvent.click(tab('Layout & download'));
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
    fireEvent.click(tab('Saved versions'));
    expect(screen.getByText(/No versions saved yet/i)).toBeTruthy();
    fireEvent.click(tab('Builder'));
    expect(screen.getByText(/How do you want to start/i)).toBeTruthy();
  });
});

describe('the sentences that point to a renamed tab use its new name', () => {
  it('the saved versions screen is titled by its tab', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(tab('Saved versions'));
    expect(screen.getByText('Saved versions', { selector: 'div' })).toBeTruthy();
    expect(screen.queryByText(/Version History/)).toBeNull();
  });

  it('with no version yet it says where one is saved, by the name of that tab', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(tab('Saved versions'));
    expect(screen.getByText(/No versions saved yet/).textContent).toMatch(/“Layout & download” tab/);
  });

  it('after saving a version, the layout screen names the tab where it is kept', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(tab('Layout & download'));
    fireEvent.click(screen.getByRole('button', { name: /^Next: download or save/ }));
    fireEvent.click(screen.getByRole('button', { name: /save this version/i }));
    expect(screen.getByRole('status').textContent).toMatch(/Saved as “Version 1” in Saved versions/);
    expect(screen.getByRole('status').textContent).not.toMatch(/Version History/);
  });
});
