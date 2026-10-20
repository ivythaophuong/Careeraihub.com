// @vitest-environment jsdom
// The parts of a feature sit inside it in the sidebar: Interview Coach opens onto its six parts and each one opens directly.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import AppSidebar from './AppSidebar';

const setup = (props = {}) => {
  const p = { activeModule: 'simulate', activeSub: 'dashboard', onNavigate: vi.fn(), user: { name: 'Ann Lee', email: 'ann@x.com' }, onLogout: vi.fn(), collapsed: false, onToggle: vi.fn(), ...props };
  render(<AppSidebar {...p} />);
  return p;
};
afterEach(cleanup);
const nav = () => within(screen.getByRole('navigation', { name: 'Main' }));
const SUBS = ['Overview', 'Study Modules', 'Live Session', 'Weakness Radar', 'STAR Bank', 'AI Memory'];

describe('sub-items in the sidebar', () => {
  it('shows the six parts under Interview Coach while it is the open feature', () => {
    setup();
    const group = nav().getByRole('group', { name: /Interview Coach sections/i });
    expect(within(group).getAllByRole('button').map(b => b.textContent.trim())).toEqual(SUBS);
  });
  it('marks the part you are in, and only that one as the current page', () => {
    setup({ activeSub: 'session' });
    const group = within(nav().getByRole('group', { name: /Interview Coach sections/i }));
    expect(group.getByRole('button', { name: 'Live Session' }).getAttribute('aria-current')).toBe('page');
    expect(group.getByRole('button', { name: 'Overview' }).getAttribute('aria-current')).toBeNull();
    expect(nav().getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'page')).toHaveLength(1);
  });
  it('opens a part directly: the module and the part are passed together', () => {
    const p = setup();
    fireEvent.click(nav().getByRole('button', { name: 'Weakness Radar' }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'weakness');
  });
  it('clicking the feature from another feature opens it on its first part', () => {
    const p = setup({ activeModule: 'scan', activeSub: null });
    fireEvent.click(nav().getByRole('button', { name: /^Interview Coach/ }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'dashboard');
  });
  it('shows no parts for the other features, and none for Interview Coach when another feature is open', () => {
    setup({ activeModule: 'scan', activeSub: null });
    expect(nav().queryByRole('group', { name: /sections/i })).toBeNull();
    expect(nav().queryByRole('button', { name: 'Live Session' })).toBeNull();
  });
  it('hides the parts when the sidebar is collapsed to icons, and the feature still opens', () => {
    const p = setup({ collapsed: true });
    expect(nav().queryByRole('group', { name: /sections/i })).toBeNull();
    fireEvent.click(nav().getByRole('button', { name: 'Interview Coach' }));
    expect(p.onNavigate).toHaveBeenCalledWith('simulate', 'dashboard');
  });
  it('keeps the parent marked as the open feature while a part is open', () => {
    const { container } = render(<AppSidebar activeModule="simulate" activeSub="starbank" onNavigate={() => {}} user={{ name: 'A' }} onLogout={() => {}} collapsed={false} onToggle={() => {}} />);
    expect(container.querySelector('.app-sidebar-item.active')?.textContent).toMatch(/Interview Coach/);
  });
  it('other features still navigate with just their name', () => {
    const p = setup({ activeModule: 'simulate' });
    fireEvent.click(nav().getByRole('button', { name: /Salary Prep/ }));
    expect(p.onNavigate).toHaveBeenCalledWith('salary', undefined);
  });
});

describe('the sub-items open and close like a real accordion', () => {
  const parent = () => nav().getByRole('button', { name: /^Interview Coach/ });
  it('the feature is a disclosure: it says whether its parts are shown, and points at them', () => {
    setup();
    expect(parent().getAttribute('aria-expanded')).toBe('true');
    const group = nav().getByRole('group', { name: /Interview Coach sections/i });
    expect(parent().getAttribute('aria-controls')).toBe(group.id);
  });
  it('shows an arrow that turns when it opens and closes', () => {
    setup();
    expect(parent().querySelector('[data-testid="sub-chevron"]')).toBeTruthy();
    expect(parent().querySelector('[data-testid="sub-chevron"]').getAttribute('data-open')).toBe('true');
    fireEvent.click(parent());
    expect(parent().querySelector('[data-testid="sub-chevron"]').getAttribute('data-open')).toBe('false');
  });
  it('clicking the open feature closes its parts without leaving the page, and clicking again opens them', () => {
    const p = setup({ activeSub: 'session' });
    fireEvent.click(parent());
    expect(p.onNavigate).not.toHaveBeenCalled();
    expect(parent().getAttribute('aria-expanded')).toBe('false');
    expect(nav().queryByRole('group', { name: /sections/i })).toBeNull();
    fireEvent.click(parent());
    expect(parent().getAttribute('aria-expanded')).toBe('true');
    expect(nav().getByRole('button', { name: 'Live Session' })).toBeTruthy();
    expect(p.onNavigate).not.toHaveBeenCalled();
  });
  it('closed, it still marks the open feature as the current page', () => {
    setup({ activeSub: 'session' });
    fireEvent.click(parent());
    expect(parent().getAttribute('aria-current')).toBe('page');
  });
  it('is opened again when the person comes back to the feature from another one', () => {
    const p = { activeModule: 'simulate', activeSub: 'dashboard', onNavigate: vi.fn(), user: { name: 'A' }, onLogout: vi.fn(), collapsed: false, onToggle: vi.fn() };
    const { rerender } = render(<AppSidebar {...p} />);
    fireEvent.click(parent()); // closed
    rerender(<AppSidebar {...p} activeModule="scan" activeSub={null} />);
    rerender(<AppSidebar {...p} activeModule="simulate" activeSub="dashboard" />);
    expect(parent().getAttribute('aria-expanded')).toBe('true');
  });
  it('works from the keyboard: it is a button, so Enter and Space act like a click', () => {
    setup();
    expect(parent().tagName).toBe('BUTTON');
  });
  it('a feature without parts is a plain link-like button: no arrow and no aria-expanded', () => {
    setup({ activeModule: 'scan', activeSub: null });
    const salary = nav().getByRole('button', { name: /Salary Prep/ });
    expect(salary.getAttribute('aria-expanded')).toBeNull();
    expect(salary.querySelector('[data-testid="sub-chevron"]')).toBeNull();
  });
});

