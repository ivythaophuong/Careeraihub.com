// @vitest-environment jsdom
// The strip of four stages above the tabs of the Resume Builder (design: docs/architecture/plans/DESIGN-guided-journey.md). It says where the user is and which
// stages they have been in; it never says a stage is done.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import JourneyStrip from './JourneyStrip.jsx';

afterEach(cleanup);
const setup = (over = {}) => { const props = { current: 2, visited: [1, 2], onGo: vi.fn(), ...over }; return { ...render(<JourneyStrip {...props} />), props }; };

describe('JourneyStrip', () => {
  it('is a labelled list of the four stages, in order, with their plain names', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: /your progress/i });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    ['Add your resume', 'See what to improve', 'Improve', 'Choose a layout and download'].forEach((label, i) => expect(items[i].textContent).toContain(label));
  });

  it('says to a screen reader which step each is of four, where the user is and which were visited', () => {
    setup({ current: 3, visited: [1, 2, 3] });
    const name = (n) => screen.getAllByRole('button')[n - 1].getAttribute('aria-label');
    expect(name(1)).toBe('Step 1 of 4: Add your resume, visited');
    expect(name(3)).toBe('Step 3 of 4: Improve, you are here');
    expect(name(4)).toBe('Step 4 of 4: Choose a layout and download');
  });

  it('marks the stage the user is in with aria-current="step", and no other', () => {
    setup({ current: 4, visited: [1, 4] });
    const here = screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'step');
    expect(here).toHaveLength(1);
    expect(here[0].getAttribute('aria-label')).toMatch(/^Step 4 of 4/);
  });

  it('a visited stage has a mark that is not only a colour, and that a screen reader does not read twice', () => {
    setup({ current: 3, visited: [1, 2, 3] });
    const first = screen.getAllByRole('button')[0];
    expect(first.querySelector('[aria-hidden="true"]').textContent).toBe('✓');
    expect(screen.getAllByRole('button')[3].querySelector('[aria-hidden="true"]').textContent).toBe('4');
  });

  it('a click on another stage goes there; a click on the stage the user is in does nothing', () => {
    const { props } = setup({ current: 2 });
    fireEvent.click(screen.getAllByRole('button')[3]);
    expect(props.onGo).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(props.onGo).toHaveBeenCalledTimes(1);
  });

  it('never says a stage is done or complete', () => {
    setup({ current: 4, visited: [1, 2, 3, 4] });
    expect(document.body.textContent).not.toMatch(/\bdone\b|complete|finished/i);
    for (const b of screen.getAllByRole('button')) expect(b.getAttribute('aria-label')).not.toMatch(/\bdone\b|complete|finished/i);
  });

  it('is a row that can scroll on a narrow screen and keeps the stage the user is in in view', () => {
    setup();
    expect(screen.getByRole('list').className).toMatch(/scroll-tabs/);
  });

  it('with bad props it shows the four stages with none marked, and does not throw', () => {
    setup({ current: undefined, visited: null, onGo: undefined });
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getAllByRole('button').some(b => b.getAttribute('aria-current'))).toBe(false);
    fireEvent.click(screen.getAllByRole('button')[0]);
  });

  it('marks the stage the user is in and the visited ones with classes the stylesheet draws, and each stage keeps its name as a tooltip', () => {
    setup({ current: 3, visited: [1, 2, 3] });
    const b = screen.getAllByRole('button');
    expect(b[2].className).toMatch(/\bis-here\b/);
    expect(b[0].className).toMatch(/\bis-visited\b/);
    expect(b[3].className).not.toMatch(/is-here|is-visited/);
    b.forEach((el, i) => expect(el.getAttribute('title')).toBe(['Add your resume', 'See what to improve', 'Improve', 'Choose a layout and download'][i]));
  });

  it('keeps every stage name in the page text, so hiding it on a narrow screen (CSS) never removes it from a screen reader', () => {
    setup({ current: 1, visited: [1] });
    ['Add your resume', 'See what to improve', 'Improve', 'Choose a layout and download'].forEach((l) => expect(screen.getByText(l)).toBeTruthy());
  });
});
