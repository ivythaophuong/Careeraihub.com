// @vitest-environment jsdom
// The policy must describe the providers the app really uses (see supabase/functions/ai/providers.js, docs/DEPLOY_AND_ROTATE_KEYS.md) and must not
// promise what no provider contract in this repo guarantees.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import PrivacyPolicy from './PrivacyPolicy.jsx';

afterEach(cleanup);
const text = () => { const { container } = render(<PrivacyPolicy onBack={() => {}} />); return container.textContent; };

describe('Privacy Policy', () => {
  it('names the AI providers that actually receive resume text', () => {
    const t = text();
    expect(t).toMatch(/OpenAI/);
    expect(t).toMatch(/Groq/);
  });

  it('does not claim a provider we do not use, or an absolute promise about training', () => {
    const t = text();
    expect(t).not.toMatch(/Anthropic/);
    expect(t).not.toMatch(/high-trust/i);
    expect(t).not.toMatch(/do not use your data for training/i);
  });

  it('says what is stored, how long, and how to delete it', () => {
    const t = text();
    expect(t).toMatch(/30 days/);
    expect(t).toMatch(/Clear memory/i);
    expect(t).toMatch(/hello@careeraihub\.com/);
  });

  it('mentions the job-search provider and the technical logs', () => {
    const t = text();
    expect(t).toMatch(/Adzuna/);
    expect(t).toMatch(/log/i);
  });
});
