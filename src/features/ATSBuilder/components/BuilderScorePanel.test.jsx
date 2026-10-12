import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import BuilderScorePanel from './BuilderScorePanel.jsx';

const data = (bullets) => ({
  contact: { name: 'Jordan A. Lee', email: 'jordan@example.com', phone: '+1 555 0100' },
  summary: 'Operations analyst.',
  experience: [{ id: 1, company: 'Acme Corp', title: 'Analyst', period: '2020 - 2023', bullets }],
  education: [{ id: 1, institution: 'State University', degree: 'BSc', year: '2016' }],
  skills: ['SQL'],
});

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: /show/i }));

describe('BuilderScorePanel', () => {
  afterEach(cleanup);

  it('is closed by default: the score is in the header and the details are not shown until the user opens it', () => {
    render(<BuilderScorePanel data={data(['Cut time by 30% across 4 teams'])} debounceMs={0} />);
    expect(screen.getByTestId('builder-score').textContent).toBe('100');
    const toggle = screen.getByRole('button', { name: /show/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/computed by code/i)).toBeNull();
    expect(screen.queryByText(/experience bullets/i)).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByText(/computed by code/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /hide/i }));
    expect(screen.queryByText(/computed by code/i)).toBeNull();
  });

  it('says what it checked in words, not as field names', () => {
    render(<BuilderScorePanel data={data(['Cut time by 30% across 4 teams'])} debounceMs={0} />);
    openPanel();
    expect(document.body.textContent).not.toMatch(/contact\.(name|email)|experience or education:|: present|: missing/);
    expect(screen.getByText(/✓ Name/)).toBeTruthy();
    expect(screen.getByText(/✓ Email/)).toBeTruthy();
  });

  it('marks what is missing in words', () => {
    const d = data(['Cut time by 30%']); d.contact.email = '';
    render(<BuilderScorePanel data={d} debounceMs={0} />);
    openPanel();
    expect(screen.getByText(/✗ Email not found/)).toBeTruthy();
  });
  it('shows the code score of what is being edited and says it is computed by code', () => {
    render(<BuilderScorePanel data={data(['Cut time by 30% across 4 teams'])} debounceMs={0} />);
    openPanel();
    expect(screen.getByTestId('builder-score').textContent).toBe('100');
    expect(screen.getByText(/computed by code/i)).toBeTruthy();
  });

  it('updates when the data changes, without any AI call', async () => {
    const { rerender } = render(<BuilderScorePanel data={data(['Cut time by 30% across 4 teams'])} debounceMs={0} />);
    openPanel();
    rerender(<BuilderScorePanel data={data(['Helped the team'])} debounceMs={0} />);
    await waitFor(() => expect(Number(screen.getByTestId('builder-score').textContent)).toBeLessThan(100));
    expect(screen.getByText(/0 of 1 experience bullets/i)).toBeTruthy();
  });

  it('shows no number for an empty draft', () => {
    render(<BuilderScorePanel data={{ contact: {}, experience: [], education: [], skills: [] }} debounceMs={0} />);
    expect(screen.queryByTestId('builder-score')).toBeNull();
    openPanel();
    expect(screen.getByText(/add your details/i)).toBeTruthy();
  });

  it('explains that advice from the AI may not change the number', () => {
    render(<BuilderScorePanel data={data(['Cut time by 30%'])} debounceMs={0} />);
    openPanel();
    expect(screen.getByText(/only these three checks/i)).toBeTruthy();
  });

  it('lists what the code checks found, with a button to the step that fixes it', () => {
    const d = data(['Cut time by 30% across 4 teams']); d.contact.email = '';
    const onGoToStep = vi.fn();
    render(<BuilderScorePanel data={d} debounceMs={0} onGoToStep={onGoToStep} />);
    openPanel();
    expect(screen.getByText('Add an email address')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /edit this step/i }));
    expect(onGoToStep).toHaveBeenCalledWith(1);
  });

  it('shows no to-fix list when every check passes', () => {
    render(<BuilderScorePanel data={data(['Cut time by 30% across 4 teams'])} debounceMs={0} onGoToStep={() => {}} />);
    openPanel();
    expect(screen.queryByText(/found by the code checks/i)).toBeNull();
  });
});
