// @vitest-environment jsdom
// The strip of four stages above the tabs of the Resume Builder: it follows where the user is, and a click on a stage goes there.
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

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const profile = { name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [], workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team'] }],
  issues: [{ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null }] };
const base = (over = {}) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD, ...over });
const stage = (n) => screen.getAllByRole('button').find(b => (b.getAttribute('aria-label') || '').startsWith(`Step ${n} of 4`));
const label = (n) => stage(n).getAttribute('aria-label');

describe('the journey strip in the Resume Builder', () => {
  it('is there once, above the tabs, with the four stages', () => {
    render(<ATSBuilder {...base()} />);
    expect(screen.getAllByRole('navigation', { name: /your progress/i })).toHaveLength(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('with no resume loaded, the user is at stage 1; with one loaded, at stage 2', () => {
    render(<ATSBuilder {...base({ memory: {} })} />);
    expect(label(1)).toMatch(/you are here/);
    cleanup();
    render(<ATSBuilder {...base()} />);
    expect(label(2)).toMatch(/you are here/);
    expect(label(1)).not.toMatch(/you are here/);
  });

  it('the stage follows the tabs, and the ones the user has been in are marked visited', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(label(4)).toMatch(/you are here/);
    expect(label(2)).toMatch(/visited/);
    fireEvent.click(screen.getByRole('button', { name: 'Builder' }));
    expect(label(3)).toMatch(/you are here/);
    expect(label(4)).toMatch(/visited/);
  });

  it('a click on a stage goes to its screen: 4 the layouts, 3 the Builder, 2 and 1 the resume tab', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(stage(4));
    expect(screen.getByText(/Choose a template/i)).toBeTruthy();
    fireEvent.click(stage(3));
    expect(screen.getByText(/How do you want to start/i)).toBeTruthy();
    fireEvent.click(stage(2));
    expect(screen.getByRole('button', { name: 'Upload & Parse' }).getAttribute('aria-current')).toBe('page');
    expect(label(2)).toMatch(/you are here/);
  });

  it('opening the Fix page puts the user at stage 3', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    expect(screen.getByText(/Issue 1 of 1/)).toBeTruthy();
    expect(label(3)).toMatch(/you are here/);
  });

  it('never says a stage is done or complete', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    for (const n of [1, 2, 3, 4]) expect(label(n)).not.toMatch(/\bdone\b|complete|finished/i);
  });
});
