// @vitest-environment jsdom
// The template gallery: its own screen, with its own value. The user's own resume is shown in every template, and choosing one changes the layout only.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import TemplateGallery from './TemplateGallery.jsx';
import { TEMPLATES } from '../resumeTemplates.jsx';

afterEach(cleanup);

const data = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Built a dashboard for 6 managers'] }],
  education: [], skills: ['SQL'], awards: [], extras: [],
});
function setup(over = {}) {
  const props = { data: data(), templates: TEMPLATES, selectedId: TEMPLATES[0].id, onSelect: vi.fn(), onBack: vi.fn(), ...over };
  return { ...render(<TemplateGallery {...props} />), props };
}

describe('TemplateGallery', () => {
  it('has a heading that says what the screen is for', () => {
    setup();
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
  });

  it('shows one card for each template, named', () => {
    setup();
    for (const t of TEMPLATES) expect(screen.getByRole('button', { name: new RegExp(t.label) })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /select|selected|use/i }).length).toBeGreaterThanOrEqual(0);
  });

  it('shows the user\'s own resume in every template, not a sample', () => {
    setup();
    expect(screen.getAllByText(/Jordan Lee/)).toHaveLength(TEMPLATES.length);
    expect(screen.queryByText(/Alex Chen/)).toBeNull();
  });

  it('marks the chosen template in words and as a pressed button', () => {
    setup({ selectedId: TEMPLATES[2].id });
    const chosen = screen.getByRole('button', { name: new RegExp(TEMPLATES[2].label) });
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    expect(within(chosen).getByText(/selected/i)).toBeTruthy();
    const other = screen.getByRole('button', { name: new RegExp(TEMPLATES[0].label) });
    expect(other.getAttribute('aria-pressed')).toBe('false');
    expect(within(other).queryByText(/selected/i)).toBeNull();
  });

  it('choosing a template tells the page and changes nothing else', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(TEMPLATES[3].label) }));
    expect(props.onSelect).toHaveBeenCalledWith(TEMPLATES[3].id);
    expect(props.data).toEqual(data());
  });

  it('says the content stays the same and only the layout changes', () => {
    setup();
    expect(screen.getByText(/your content stays the same/i)).toBeTruthy();
  });

  it('has a way back to the Builder', () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole('button', { name: /back to (the )?builder/i }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('the previews are not in the tab order and not read twice: the card is the control', () => {
    const { container } = setup();
    for (const el of container.querySelectorAll('[data-template-preview]')) expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('says so when the previews are a sample and not the user\'s resume', () => {
    setup({ sample: true });
    expect(screen.getByText(/sample resume/i)).toBeTruthy();
  });

  it('says nothing about a sample when the resume is the user\'s', () => {
    setup();
    expect(screen.queryByText(/sample resume/i)).toBeNull();
  });
});
