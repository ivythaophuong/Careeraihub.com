// @vitest-environment jsdom
// The template screen: the user's own resume shown large in the layout they are looking at, a list to switch layout, and two steps that say what to do next:
// 1 pick a layout, 2 download or save.
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';

vi.mock('../exportActions.js', async () => {
  const real = await vi.importActual('../exportActions.js');
  return { ...real, exportPdf: vi.fn(async () => true), exportDocx: vi.fn(async () => true) };
});
import { exportPdf, exportDocx } from '../exportActions.js';
import TemplateGallery from './TemplateGallery.jsx';
import { TEMPLATES } from '../resumeTemplates.jsx';

const observers = [];
class FakeRO { constructor(cb) { this.cb = cb; this.el = null; this.live = true; observers.push(this); } observe(el) { this.el = el; } unobserve() {} disconnect() { this.live = false; } }
const fireWidth = (w) => act(() => { for (const o of observers) if (o.live && o.el) o.cb([{ contentRect: { width: w } }]); });

beforeEach(() => { observers.length = 0; vi.stubGlobal('ResizeObserver', FakeRO); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const data = () => ({
  contact: { name: 'Jordan Lee', email: 'jordan.lee@example.com', phone: '', linkedin: '', location: 'Singapore' },
  summary: 'Analyst who builds weekly reports.',
  experience: [{ id: 1, company: 'Acme', title: 'Analyst', period: '2021 - 2023', bullets: ['Built a dashboard for 6 managers'] }],
  education: [], skills: ['SQL'], awards: [], extras: [],
});

// The page that holds the chosen template, as ATSBuilder does.
function Holder(props) {
  const [id, setId] = useState(props.selectedId ?? TEMPLATES[0].id);
  return <TemplateGallery data={props.data ?? data()} templates={TEMPLATES} selectedId={id} onSelect={(x) => { setId(x); props.onSelect?.(x); }} onBack={props.onBack} sample={props.sample}
    onSaveVersion={props.onSaveVersion} versionsCount={props.versionsCount ?? 0} onOpenHistory={props.onOpenHistory} />;
}
const setup = (props = {}) => ({ ...render(<Holder {...props} />), props });
const preview = () => screen.getByRole('region', { name: /preview of your resume/i });
const layoutBtn = (t) => screen.getByRole('button', { name: new RegExp(t.label) });
const next = () => fireEvent.click(screen.getByRole('button', { name: /next: download or save/i }));

describe('the layouts', () => {
  it('has a heading, and one button for each layout, named', () => {
    setup();
    expect(screen.getByRole('heading', { name: /choose a template/i })).toBeTruthy();
    for (const t of TEMPLATES) expect(layoutBtn(t)).toBeTruthy();
  });

  it('marks the layout in use in words and as a pressed button', () => {
    setup({ selectedId: TEMPLATES[2].id });
    expect(layoutBtn(TEMPLATES[2]).getAttribute('aria-pressed')).toBe('true');
    expect(within(layoutBtn(TEMPLATES[2])).getByText(/selected/i)).toBeTruthy();
    expect(layoutBtn(TEMPLATES[0]).getAttribute('aria-pressed')).toBe('false');
    expect(within(layoutBtn(TEMPLATES[0])).queryByText(/selected/i)).toBeNull();
  });

  it('the small previews are not read out and not in the tab order: the button is the control', () => {
    const { container } = setup();
    for (const el of container.querySelectorAll('[data-template-preview]')) expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('the large preview', () => {
  it('shows the user\'s own resume, large, in the layout in use, and names the layout', () => {
    setup({ selectedId: TEMPLATES[1].id });
    const pane = preview();
    expect(within(pane).getByText(/Jordan Lee/)).toBeTruthy();
    expect(pane.querySelector(`[data-template="${TEMPLATES[1].id}"]`)).toBeTruthy();
    expect(within(pane).getByText(new RegExp(TEMPLATES[1].label))).toBeTruthy();
  });

  it('changes to the layout the user clicks, at once, and tells the page', () => {
    const { props } = setup({ onSelect: vi.fn() });
    fireEvent.click(layoutBtn(TEMPLATES[3]));
    expect(preview().querySelector(`[data-template="${TEMPLATES[3].id}"]`)).toBeTruthy();
    expect(preview().querySelector(`[data-template="${TEMPLATES[0].id}"]`)).toBeNull();
    expect(props.onSelect).toHaveBeenCalledWith(TEMPLATES[3].id);
  });

  it('is scaled to the width of its column, so it is as large as the room allows (never smaller than 0.3, never larger than 1)', () => {
    setup();
    const scale = () => Number(/scale\(([-\d.e]+)\)/.exec(preview().querySelector('[data-template]').style.transform)[1]);
    fireWidth(700);
    expect(scale()).toBeCloseTo((700 - 32) / 794, 3);
    fireWidth(1400);
    expect(scale()).toBe(1);
    fireWidth(0);
    expect(scale()).toBeGreaterThan(0.2);
  });

  it('does not change the user\'s data', () => {
    const d = data(); const copy = JSON.stringify(d);
    setup({ data: d });
    fireEvent.click(layoutBtn(TEMPLATES[4]));
    expect(JSON.stringify(d)).toBe(copy);
  });
});

describe('the two steps', () => {
  it('start by saying where the user is and what to do: Step 1 of 2, pick a layout, with one main button to go on', () => {
    setup();
    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy();
    expect(screen.getByText(/pick a layout/i)).toBeTruthy();
    const main = screen.getByRole('button', { name: /next: download or save/i });
    expect(main.getAttribute('data-primary')).toBe('true');
    expect(document.querySelectorAll('[data-primary="true"]')).toHaveLength(1);
  });

  it('Next shows Step 2 of 2 with the actions: Download PDF as the main one, Word, and Save this version', () => {
    setup();
    next();
    expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /download pdf/i }).getAttribute('data-primary')).toBe('true');
    expect(screen.getByRole('button', { name: /download word/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save this version/i })).toBeTruthy();
    expect(document.querySelectorAll('[data-primary="true"]')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /next: download or save/i })).toBeNull();
  });

  it('keeps the large preview on screen in step 2, so the user sees what is downloaded', () => {
    setup({ selectedId: TEMPLATES[2].id });
    next();
    expect(preview().querySelector(`[data-template="${TEMPLATES[2].id}"]`)).toBeTruthy();
  });

  it('Download PDF prints the large preview in the layout in use, and Word uses the data', async () => {
    setup({ selectedId: TEMPLATES[1].id });
    next();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /download pdf/i })); });
    expect(exportPdf).toHaveBeenCalledTimes(1);
    const arg = exportPdf.mock.calls[0][0];
    expect(arg.el.getAttribute('data-template')).toBe(TEMPLATES[1].id);
    expect(arg.templateLabel).toBe(TEMPLATES[1].label);
    expect(arg.data).toEqual(data());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /download word/i })); });
    expect(exportDocx).toHaveBeenCalledWith(data());
  });

  it('Save this version saves a copy with the layout and a label, says so, and offers to see the versions', () => {
    const onSaveVersion = vi.fn(); const onOpenHistory = vi.fn();
    setup({ selectedId: TEMPLATES[4].id, onSaveVersion, onOpenHistory, versionsCount: 2 });
    next();
    fireEvent.click(screen.getByRole('button', { name: /save this version/i }));
    const v = onSaveVersion.mock.calls[0][0];
    expect(v).toMatchObject({ template: TEMPLATES[4].id, templateLabel: TEMPLATES[4].label, label: 'Version 3' });
    expect(v.data).toEqual(data());
    expect(screen.getByText(/in Saved versions/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /see your versions/i }));
    expect(onOpenHistory).toHaveBeenCalled();
  });

  it('a label the user types is the one saved', () => {
    const onSaveVersion = vi.fn();
    setup({ onSaveVersion });
    next();
    fireEvent.change(screen.getByRole('textbox', { name: /version label/i }), { target: { value: '  For Acme  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save this version/i }));
    expect(onSaveVersion.mock.calls[0][0].label).toBe('For Acme');
  });

  it('Back to layouts returns to step 1 and keeps the layout', () => {
    setup({ selectedId: TEMPLATES[3].id });
    next();
    fireEvent.click(screen.getByRole('button', { name: /back to layouts/i }));
    expect(screen.getByText(/Step 1 of 2/)).toBeTruthy();
    expect(layoutBtn(TEMPLATES[3]).getAttribute('aria-pressed')).toBe('true');
  });

  it('Back to Builder is there in both steps', () => {
    const onBack = vi.fn();
    setup({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to builder/i }));
    next();
    fireEvent.click(screen.getByRole('button', { name: /back to builder/i }));
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});

describe('when there is no resume yet', () => {
  it('says the previews are a sample, and does not offer to download or save a sample', () => {
    setup({ sample: true });
    expect(screen.getByText(/sample resume/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /next: download or save/i })).toBeNull();
    expect(screen.getByText(/upload or write your resume/i)).toBeTruthy();
  });

  it('says nothing about a sample when the resume is the user\'s', () => {
    setup();
    expect(screen.queryByText(/sample resume/i)).toBeNull();
  });

  it('does not say where the page is, because on a phone it is below the list and not on the right', () => {
    setup();
    expect(screen.queryByText(/on the right/i)).toBeNull();
    expect(screen.getByText(/The large page is your own resume/i)).toBeTruthy();
  });
});
