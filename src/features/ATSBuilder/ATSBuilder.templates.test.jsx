// @vitest-environment jsdom
// Choosing a template is its own screen (the Layout & download tab); the Builder only names the template in use and links to it.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('../../lib/ai', () => ({ callLLM: vi.fn() }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));
import ATSBuilder, { builderDraftKey } from './ATSBuilder';
import { TEMPLATES } from './resumeTemplates.jsx';

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

const GOOD = 'Jane Example\njane@example.com\n\nExperience\nManager\tJan 2021 - Mar 2024\nAcme\n• Grew revenue by 20%\n• Cut costs by $40,000\n\nEducation\nBSc Business 2018\n\nSkills\nSQL, Excel\n';
const issue = (over) => ({ severity: 'high', title: 'No metrics in bullets', description: 'Add numbers.', before: 'Handled monthly reporting', after: 'Cut monthly reporting time by 30%', builderStep: 2, module: null, ...over });
const profile = (issues = [issue()]) => ({
  name: 'Jane Example', email: 'jane@example.com', skills: ['SQL'], education: [],
  workExperience: [{ title: 'Analyst', company: 'Acme', period: '2021 - 2023', bullets: ['Handled monthly reporting for the sales team', 'Built a dashboard for 6 managers'] }],
  issues,
});
const base = (over = {}) => ({ user: { id: 'u1', token: 't' }, memory: { parseProfile: profile() }, updateMemory: vi.fn(), form: {}, setActiveModule: vi.fn(), setResumeText: vi.fn(), resumeText: GOOD, ...over });
const openGallery = () => fireEvent.click(screen.getByRole('button', { name: /^Layout & download$/ }));
const openBuilder = () => { (() => { fireEvent.click(screen.getByRole('button', { name: 'Builder' })); fireEvent.click(screen.getByText(/Load from memory/)); })(); };

describe('the Layout & download tab', () => {
  it('is a tab of its own and opens the gallery with the user\'s own resume in every template', () => {
    render(<ATSBuilder {...base()} />);
    openGallery();
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
    // the large preview, and a small one for each layout in the list
    expect(screen.getAllByText(/Jane Example/)).toHaveLength(TEMPLATES.length + 1);
    expect(screen.getByRole('region', { name: /preview of your resume/i }).textContent).toMatch(/Jane Example/);
  });

  it('shows the saved draft, not the profile it started from', () => {
    localStorage.setItem(builderDraftKey('u1'), JSON.stringify({
      contact: { name: 'Draft Name', email: 'd@example.com', phone: '', linkedin: '', location: '' }, summary: '', experience: [{ id: 1, company: 'Acme', title: 'A', period: '2020', bullets: ['x'] }], education: [], skills: [], awards: [], extras: [],
    }));
    render(<ATSBuilder {...base()} />);
    openGallery();
    expect(screen.getAllByText(/Draft Name/)).toHaveLength(TEMPLATES.length + 1);
  });

  it('says so when there is no resume yet and the previews are a sample', () => {
    render(<ATSBuilder {...base({ memory: {} })} />);
    openGallery();
    expect(screen.getByText(/sample resume/i)).toBeTruthy();
  });
});

describe('the Builder and the template', () => {
  it('no longer carries the row of template buttons; it names the template and links to the gallery', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    for (const t of TEMPLATES.slice(1)) expect(screen.queryByRole('button', { name: new RegExp(`^${t.label}$`) })).toBeNull();
    expect(screen.getByText(new RegExp(`Template: ${TEMPLATES[0].label}`))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /change template/i }));
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
  });

  it('the template chosen in the gallery is the one the Builder uses, and Back to Builder returns to it', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    fireEvent.click(screen.getByRole('button', { name: /change template/i }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TEMPLATES[4].label) }));
    fireEvent.click(screen.getByRole('button', { name: /back to builder/i }));
    expect(screen.getByText(new RegExp(`Template: ${TEMPLATES[4].label}`))).toBeTruthy();
  });

  it('still offers the downloads', () => {
    render(<ATSBuilder {...base()} />);
    openBuilder();
    expect(screen.getAllByRole('button', { name: /download pdf/i }).length).toBeGreaterThan(0);
  });
});

describe('the end of the Fix page', () => {
  it('offers the next step, choose a layout, which opens the gallery', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    fireEvent.click(screen.getByRole('button', { name: /Leave it for now/i }));
    fireEvent.click(screen.getByRole('button', { name: /next: choose a layout/i }));
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
  });

  it('after the gallery, Back to Builder shows the Builder and does not reopen the Fix page', () => {
    render(<ATSBuilder {...base()} />);
    fireEvent.click(screen.getByText(/Fix in Builder/));
    fireEvent.click(screen.getByRole('button', { name: /Leave it for now/i }));
    fireEvent.click(screen.getByRole('button', { name: /next: choose a layout/i }));
    fireEvent.click(screen.getByRole('button', { name: /back to builder/i }));
    expect(screen.getByText(/Step \d of 6/)).toBeTruthy();
    expect(screen.queryByText(/Issue \d of \d/)).toBeNull();
  });
});

describe('after choosing a layout: download or save', () => {
  const toStepTwo = (p) => {
    render(<ATSBuilder {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /^Layout & download$/ }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TEMPLATES[2].label) }));
    fireEvent.click(screen.getByRole('button', { name: /next: download or save/i }));
  };

  it('the large preview follows the layout the user clicked, and step 2 offers the actions', () => {
    toStepTwo(base());
    expect(screen.getByRole('region', { name: /preview of your resume/i }).querySelector(`[data-template="${TEMPLATES[2].id}"]`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save this version/i })).toBeTruthy();
  });

  it('Save this version adds a version to the user\'s history with that layout, and See your versions opens the history tab', () => {
    const p = base();
    toStepTwo(p);
    fireEvent.click(screen.getByRole('button', { name: /save this version/i }));
    expect(p.updateMemory).toHaveBeenCalledTimes(1);
    const next = p.updateMemory.mock.calls[0][0]({ resumeVersions: [] });
    expect(next.resumeVersions).toHaveLength(1);
    expect(next.resumeVersions[0]).toMatchObject({ template: TEMPLATES[2].id, templateLabel: TEMPLATES[2].label, label: 'Version 1' });
    fireEvent.click(screen.getByRole('button', { name: /see your versions/i }));
    expect(screen.getByRole('button', { name: /^Saved versions$/ }).textContent).toMatch(/Saved versions/);
    expect(screen.queryByRole('heading', { name: /choose a template/i })).toBeNull();
  });

  it('with no resume yet, the screen says it is a sample and offers no download or save', () => {
    render(<ATSBuilder {...base({ memory: {} })} />);
    fireEvent.click(screen.getByRole('button', { name: /^Layout & download$/ }));
    expect(screen.getByText(/upload or write your resume/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /next: download or save/i })).toBeNull();
  });
});
