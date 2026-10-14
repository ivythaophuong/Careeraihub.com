// @vitest-environment jsdom
// Resume Scan shows the same claim warnings as the Builder: a suggested fix that adds a duty, a higher role, a tool or a result the resume never said
// says so on the card, and its button asks the user to confirm. A faithful fix keeps the plain button. Invented resume, invented model answers.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

afterEach(cleanup);

const callLLM = vi.fn();
vi.mock('../../lib/ai.jsx', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => { try { return JSON.parse(s); } catch { return { error: true }; } } }));
vi.mock('html2pdf.js', () => ({ default: vi.fn() }));

import ResumeScan from './ResumeScan';

const RESUME = 'Dana Whitfield\ndana@example.com | +1 555 0100\n\nExperience\nSales Associate, Harbor Mart\nJan 2021 - Present\n- Supported daily operations and customer service\n- Worked at the register\n\nSkills\nCustomer service';
const answer = (issues) => JSON.stringify({ matchScore: 61, roleTitle: 'Store Supervisor', company: 'Acme', bars: [], jdKeywords: ['scheduling'], aiInsight: 'x', issues });
const scan = async (issues) => {
  callLLM.mockResolvedValue(answer(issues));
  render(<ResumeScan resumeText={{ type: 'text', content: RESUME, fileName: 'cv.docx' }} setResumeText={vi.fn()} form={{}} memory={{}} updateMemory={vi.fn()} setActiveModule={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/), { target: { value: 'We need a store supervisor who plans schedules and trains the team.' } });
  fireEvent.click(screen.getAllByRole('button').find(b => /scan|analy|match/i.test(b.textContent) && !b.disabled));
  await waitFor(() => expect(screen.getAllByRole('button').some(b => /^apply fix|fill in & apply/i.test(b.textContent))).toBe(true));
};
const issue = (over) => ({ severity: 'warning', type: 'Weak Ownership', original: 'Supported daily operations and customer service', fix: 'Supported daily operations and customer service', ...over });
const applyButtons = () => screen.getAllByRole('button').filter(b => /^apply fix|fill in & apply/i.test(b.textContent)).map(b => b.textContent);

describe('Resume Scan: suggested fixes that add something the resume did not say', () => {
  it('a faithful fix keeps the plain "Apply fix →" and shows no claim warning', async () => {
    await scan([issue({ fix: 'Supported daily store operations and customer service' })]);
    expect(applyButtons()).toEqual(['Apply fix →']);
    expect(document.body.textContent).not.toMatch(/Keep it only if/);
  });
  it('an invented duty: the reason is on the card and the button asks for confirmation', async () => {
    await scan([issue({ fix: 'Trained new colleagues and handled escalated complaints' })]);
    expect(document.body.textContent).toMatch(/does not mention/);
    expect(applyButtons()).toEqual(['Apply fix — I confirm this is true →']);
  });
  it('a higher role asks for confirmation', async () => {
    await scan([issue({ fix: 'Led daily operations and customer service' })]);
    expect(document.body.textContent).toMatch(/Keep it only if/);
    expect(applyButtons()).toEqual(['Apply fix — I confirm this is true →']);
  });
  it('nothing is changed in the resume before the click', async () => {
    await scan([issue({ fix: 'Trained new colleagues and handled escalated complaints' })]);
    expect(document.body.textContent).not.toMatch(/Trained new colleagues and handled escalated complaints\s*✓ Applied/);
    expect(screen.queryByText(/✓ Applied/)).toBeNull();
  });
  it('a fix with a blank still goes through "Fill in & apply", and shows its claim warning as well', async () => {
    await scan([issue({ fix: 'Trained new colleagues and handled [X] escalated complaints' })]);
    expect(applyButtons()).toEqual(['Fill in & apply →']);
    expect(document.body.textContent).toMatch(/does not mention/);
  });
});

describe('Resume Scan: filling in a blank, the Save button follows what the user wrote', () => {
  const open = async () => {
    await scan([issue({ fix: 'Trained new colleagues and handled [X] escalated complaints' })]);
    fireEvent.click(screen.getByRole('button', { name: /fill in & apply/i }));
    return screen.getByDisplayValue(/Trained new colleagues and handled \[X\]/);
  };
  const saveLabel = () => screen.getAllByRole('button').map(b => b.textContent).find(t => /save|fill the blanks/i.test(t));
  it('waits while a blank is left', async () => {
    await open();
    expect(saveLabel()).toBe('Fill the blanks to save');
  });
  it('with the blank filled but the duty still in the text, Save asks for confirmation', async () => {
    const box = await open();
    fireEvent.change(box, { target: { value: 'Trained new colleagues and handled 12 escalated complaints' } });
    expect(saveLabel()).toBe('Save — I confirm this is true ✓');
  });
  it('when the user rewrites it to something the resume supports, Save is the plain button', async () => {
    const box = await open();
    fireEvent.change(box, { target: { value: 'Supported daily store operations and customer service' } });
    expect(saveLabel()).toBe('Save ✓');
  });
});
