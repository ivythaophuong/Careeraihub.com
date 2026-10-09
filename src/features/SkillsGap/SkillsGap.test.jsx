// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

afterEach(cleanup);

const callLLM = vi.fn();
vi.mock('../../lib/ai', () => ({ callLLM: (...a) => callLLM(...a), extractJSON: (s) => JSON.parse(s) }));
vi.mock('../Landing/LandingPage', () => ({ GetReadyTabStrip: () => null }));

import SkillsGap from './SkillsGap';

const props = (memory) => ({ resumeText: 'Jane Doe\nSoftware Engineer', form: { role: 'Engineer', market: 'Singapore' }, memory, updateMemory: vi.fn(), showToast: vi.fn(), setActiveModule: vi.fn() });

// A result saved before the fix: it carries numbers the model invented.
const staleResult = {
  summary: 'You have a solid base.', matchRate: 61, projectedMatchRate: 88, activeRoles: 312,
  skills: [{ name: 'Kubernetes', yourLevel: 'basic', marketDemand: 93, status: 'gap' }],
  recommendations: [],
  marketStats: { currency: 'SGD', avgSalaryMin: 7000, avgSalaryMax: 11000, rolesQualifiedNow: 120, rolesAfterFix: 340 },
};

describe('SkillsGap shows no invented market numbers', () => {
  it('ignores the numbers in a result saved earlier', () => {
    const { container } = render(<SkillsGap {...props({ skillsGap: { result: staleResult } })} />);
    const text = container.textContent;
    expect(text).toContain('Kubernetes');
    for (const bad of ['312', '88%', '61%', '93%', '7–11K', '+220', '120', '340']) expect(text).not.toContain(bad);
    expect(text).toMatch(/Market intelligence is temporarily unavailable/);
  });

  it('does not ask the model for market numbers', async () => {
    callLLM.mockResolvedValue(JSON.stringify({ summary: 's', skills: [], recommendations: [] }));
    render(<SkillsGap {...props({})} />);
    fireEvent.click(screen.getByRole('button', { name: /Analyze my gaps/ }));
    await waitFor(() => expect(callLLM).toHaveBeenCalled());
    const prompt = callLLM.mock.calls[0][0][0].content;
    for (const key of ['activeRoles', 'avgSalaryMin', 'marketDemand', 'projectedMatchRate', 'rolesQualifiedNow']) {
      expect(prompt).not.toContain(key);
    }
  });
});
