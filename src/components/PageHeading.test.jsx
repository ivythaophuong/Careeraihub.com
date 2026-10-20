// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PageHeading from './PageHeading';
import { MODULES } from '../styles/theme';

afterEach(cleanup);

describe('PageHeading gives each screen one h1 that names it', () => {
  it('renders one level-1 heading with the module name from MODULES', () => {
    render(<PageHeading moduleId="salary" />);
    const h = screen.getAllByRole('heading', { level: 1 });
    expect(h).toHaveLength(1);
    expect(h[0].textContent).toBe(MODULES.find(m => m.id === 'salary').label);
  });

  it('every module in MODULES gets a non-empty heading', () => {
    for (const m of MODULES) {
      const { container, unmount } = render(<PageHeading moduleId={m.id} />);
      expect(container.querySelector('h1')?.textContent).toBe(m.label);
      unmount();
    }
  });

  it('renders nothing for an id that is not a module (legal pages bring their own)', () => {
    const { container } = render(<PageHeading moduleId="privacy" />);
    expect(container.querySelector('h1')).toBeNull();
  });

  it('is hidden from the eye but not from a screen reader', () => {
    render(<PageHeading moduleId="jobs" />);
    const s = screen.getByRole('heading', { level: 1 }).style;
    expect(s.position).toBe('absolute');
    expect(s.display).not.toBe('none');
    expect(s.visibility).not.toBe('hidden');
  });
});
