// @vitest-environment jsdom
// The page a signed-out visitor sees at the main address is the new landing page. The old one stays reachable at /?landing=old so it can be compared or brought back without a deploy.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';


import App from './App';

const openAt = (suffix) => { window.history.replaceState(null, '', `/${suffix}`); return render(<App />); };
beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.scrollTo = vi.fn();
  localStorage.clear(); sessionStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

const newLanding = () => screen.findByRole('heading', { level: 1, name: /Know what to improve\./ });

describe('the landing page at the main address', () => {
  it('is the new landing page', async () => {
    openAt('');
    await newLanding();
    expect(document.body.textContent).toMatch(/Questions, answered\./);
  });
  it('still shows the new page at the old preview link, so links already shared keep working', async () => {
    openAt('?preview=landing');
    await newLanding();
  });
  it('shows the old page only when asked for with ?landing=old', async () => {
    openAt('?landing=old');
    await waitFor(() => expect(document.body.textContent).toMatch(/TRUSTMATCH VERIFIED/i));
    expect(document.body.textContent).not.toMatch(/Questions, answered\./);
    expect(screen.queryByRole('heading', { level: 1, name: /Know what to improve\./ })).toBeNull();
  });
});
