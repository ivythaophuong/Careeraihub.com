// @vitest-environment jsdom
// A tracked job reaches the modules that use it, once, and results come back to the tracker card.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../lib/ai.jsx', () => ({
  callLLM: vi.fn(),
  extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } },
}));
vi.mock('../HiringManagerSim/HiringManagerSim', () => ({ default: ({ job }) => <div>STUB-HM role={job?.role} company={job?.company}</div> }));
vi.mock('../STARBuilder/STARBuilder', () => ({ default: () => <div>STUB-STAR</div> }));
vi.mock('../WeaknessRadar/WeaknessRadar', () => ({ default: () => <div>STUB-RADAR</div> }));
vi.mock('../MemoryDashboard/MemoryDashboard', () => ({ default: () => <div>STUB-MEMORY</div> }));
import { callLLM } from '../../lib/ai.jsx';
import JDAnalyzer from '../JDAnalyzer/JDAnalyzer';
import CoverLetterGen from '../CoverLetterGen/CoverLetterGen';
import SalaryCoach from '../SalaryCoach/SalaryCoach';
import InterviewCoach from '../InterviewCoach/InterviewCoach';
import Dashboard from '../Dashboard/Dashboard';
import JobSearch from './JobSearch';
import { requestTrackerTab, clearRequestedTab } from './jobHandoff';

const JD = 'We need a product manager to own the payments roadmap, work with engineering, and report on metrics every week. '.repeat(2);
const job = (over = {}) => ({ appId: 42, company: 'Northwind', role: 'Product Manager', jd: JD, ts: Date.now(), ...over });
const text = () => document.body.textContent;

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); clearRequestedTab(); });

describe('JD Analyzer', () => {
  it('opens on the tracked job and clears the hand-over', () => {
    const updateMemory = vi.fn();
    render(<JDAnalyzer memory={{ activeJob: job() }} updateMemory={updateMemory} form={{}} setActiveModule={vi.fn()} />);
    expect(screen.getByLabelText('Job description').value).toBe(JD);
    expect(text()).toContain('Northwind · Product Manager');
    expect(updateMemory).toHaveBeenCalledWith({ activeJob: null });
  });

  it('stays empty when nobody handed it a job', () => {
    render(<JDAnalyzer memory={{}} updateMemory={vi.fn()} form={{}} />);
    expect(screen.getByLabelText('Job description').value).toBe('');
    expect(text()).not.toContain('From your tracker');
  });

  it('saves the fit estimate on the tracker card', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ roleTitle: 'Product Manager', company: 'Northwind', matchScore: 71, keyRequirements: ['Payments'], criticalGaps: ['SQL'], candidateStrengths: ['Roadmaps'], applicationAdvice: 'Lead with roadmaps.' }));
    const updateMemory = vi.fn();
    const resume = { type: 'text', content: 'Product manager with seven years of experience shipping payments features. '.repeat(4), fileName: 'cv' };
    const memory = { activeJob: job(), applications: [{ id: 42, company: 'Northwind', role: 'Product Manager', status: 'Saved' }, { id: 1, company: 'Other', role: 'PM', status: 'Applied' }] };
    render(<JDAnalyzer memory={memory} resumeText={resume} updateMemory={updateMemory} form={{}} />);
    fireEvent.click(screen.getByText(/Analyze This Job/));
    await waitFor(() => expect(updateMemory.mock.calls.some(c => typeof c[0] === 'function')).toBe(true));
    const patch = updateMemory.mock.calls.map(c => c[0]).filter(u => typeof u === 'function')[0](memory);
    expect(patch.applications.find(a => a.id === 42)).toMatchObject({ fitScore: 71 });
    expect(patch.applications.find(a => a.id === 1).fitScore).toBeUndefined();
    expect(patch.jdAnalyses[0].matchScore).toBe(71);
  });

  it('goes back to the tracker tab', () => {
    const setActiveModule = vi.fn();
    render(<JDAnalyzer memory={{ activeJob: job() }} updateMemory={vi.fn()} form={{}} setActiveModule={setActiveModule} />);
    fireEvent.click(screen.getByText('Back to tracker'));
    expect(setActiveModule).toHaveBeenCalledWith('jobs');
    cleanup();
    render(<JobSearch form={{ role: 'PM', market: 'Singapore' }} memory={{ applications: [] }} updateMemory={vi.fn()} />);
    expect(screen.getByText('Your tracker is empty')).toBeTruthy(); // Job Search opened on the Tracker tab
  });
});

describe('Cover Letter', () => {
  it('prefills company, role and description', () => {
    render(<CoverLetterGen memory={{ activeJob: job() }} updateMemory={vi.fn()} form={{ role: 'Other' }} resumeText="x" setActiveModule={vi.fn()} />);
    expect(screen.getByDisplayValue('Northwind')).toBeTruthy();
    expect(screen.getByDisplayValue('Product Manager')).toBeTruthy();
    expect(screen.getByLabelText('Job description').value).toBe(JD);
  });
  it('falls back to the profile role with no job', () => {
    render(<CoverLetterGen memory={{}} updateMemory={vi.fn()} form={{ role: 'Designer' }} resumeText="x" />);
    expect(screen.getByDisplayValue('Designer')).toBeTruthy();
  });
});

describe('Salary Coach', () => {
  it('opens on the negotiation tab with the job named, and adds no figures', () => {
    render(<SalaryCoach memory={{ activeJob: job() }} updateMemory={vi.fn()} form={{ role: 'PM' }} setActiveModule={vi.fn()} />);
    expect(screen.getByLabelText('Situation').value).toBe('I received an offer for the Product Manager role at Northwind. ');
    expect(screen.getByLabelText('Situation').value).not.toMatch(/\d/);
  });
});

describe('Interview Coach', () => {
  it('lands on the live session and passes the job on', () => {
    render(<InterviewCoach memory={{ activeJob: job() }} updateMemory={vi.fn()} setActiveModule={vi.fn()} />);
    expect(text()).toContain('STUB-HM role=Product Manager company=Northwind');
  });
  it('opens on the overview without a job, or with a stale one', () => {
    render(<InterviewCoach memory={{ activeJob: job({ ts: Date.now() - 3_600_000 }) }} updateMemory={vi.fn()} setActiveModule={vi.fn()} />);
    expect(text()).not.toContain('STUB-HM');
  });
});

describe('Dashboard', () => {
  const props = { form: {}, user: null, setActiveModule: vi.fn() };
  it('shows no Job Hunt panel without applications', () => {
    render(<Dashboard memory={{}} {...props} />);
    expect(text()).not.toContain('Job Hunt');
  });
  it('shows counts and the next step, and opens the tracker', () => {
    const setActiveModule = vi.fn();
    const today = new Date(); const d = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    render(<Dashboard memory={{ applications: [{ id: 1, company: 'Northwind', role: 'PM', status: 'Interviewing', date: d(-5), interviewDate: d(2), reachedInterview: true }, { id: 2, company: 'Cedar', role: 'PM', status: 'Applied', date: d(-1) }] }} {...props} setActiveModule={setActiveModule} />);
    expect(text()).toContain('2 applied · 1 heard back · 1 interview · 0 offers');
    expect(text()).toContain('Northwind');
    expect(text()).toContain('Interview in 2 days');
    fireEvent.click(screen.getByText('Open tracker →'));
    expect(setActiveModule).toHaveBeenCalledWith('jobs');
  });
});
