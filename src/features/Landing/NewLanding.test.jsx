// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import NewLanding from './NewLanding';

afterEach(cleanup);
const show = (props = {}) => {
  const p = { onStart: vi.fn(), onSignIn: vi.fn(), onModuleSelect: vi.fn(), ...props };
  const r = render(<NewLanding {...p} />);
  return { ...r, ...p };
};

describe('the new landing page', () => {
  it('has one h1 with the three-line promise', () => {
    show();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toMatch(/Know what to improve\.\s+Practice what matters\.\s+Move forward with clarity\./);
    expect(document.body.textContent).toMatch(/Your career operating system/i);
  });

  it('Get Started starts sign-up and Log in opens sign-in', () => {
    const { onStart, onSignIn } = show();
    fireEvent.click(screen.getAllByRole('button', { name: /Get Started/i })[0]);
    expect(onStart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Log in/i })[0]);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('the hero buttons lead to real places on the page', () => {
    show();
    expect(screen.getByRole('link', { name: /Explore Career Tools/i }).getAttribute('href')).toBe('#tools');
    expect(screen.getByRole('link', { name: /See How It Works/i }).getAttribute('href')).toBe('#system');
    for (const id of ['tools', 'system', 'approach', 'faq', 'story', 'partner']) expect(document.getElementById(id)).toBeTruthy();
  });

  it('each tool card opens a tool that exists', () => {
    const { onModuleSelect } = show();
    for (const [name, id] of [['Explore Resume Tools', 'ats'], ['Explore Interview Practice', 'simulate'], ['Explore Skills Gap', 'skillsgap'], ['Explore Career Roadmap', 'roadmap']]) {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(onModuleSelect).toHaveBeenLastCalledWith(id);
    }
  });

  it('Privacy and Terms open those pages', () => {
    const { onModuleSelect } = show();
    const footer = screen.getByRole('contentinfo');
    fireEvent.click(within(footer).getByRole('button', { name: 'Privacy' }));
    fireEvent.click(within(footer).getByRole('button', { name: 'Terms' }));
    expect(onModuleSelect).toHaveBeenCalledWith('privacy');
    expect(onModuleSelect).toHaveBeenCalledWith('terms');
  });

  it('the footer shows the current year and no social icons that go nowhere', () => {
    show();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain(String(new Date().getFullYear()));
    expect(within(footer).queryAllByRole('link').every(a => a.getAttribute('href') && a.getAttribute('href') !== '#')).toBe(true);
    expect(footer.textContent).not.toMatch(/linkedin|twitter|youtube|instagram/i);
  });
});

describe('the situation panels show whole screens', () => {
  const open = (container, i) => { fireEvent.click(container.querySelectorAll('.nl-moment')[i]); return container.querySelector('.nl-panel'); };
  it('with no pink labels, and one short note that the screens are a synthetic account with made-up data', () => {
    const { container } = show();
    for (let i = 0; i < 4; i++) {
      const panel = open(container, i);
      expect(panel.querySelector('.nl-chip'), `panel ${i}`).toBeNull();
      expect(panel.querySelector('.nl-panel-note').textContent).toMatch(/synthetic account and made-up data/i);
    }
  });
  it('the applying panel shows the ATS Scanner result as a moving example, with bars coloured by their source', () => {
    const { container } = show();
    const panel = open(container, 0);
    expect(panel.querySelector('.nl-zoom')).toBeNull();
    const demo = panel.querySelector('[data-testid="scan-demo"]');
    expect(demo).toBeTruthy();
    expect([...demo.querySelectorAll('[data-testid="scan-bar"]')].map(b => b.getAttribute('data-source'))).toEqual(['code', 'ai', 'ai']);
  });
  it('the interview panel opens with a moving recording, then the whole screen after recording and the whole feedback screen', () => {
    const { container } = show();
    const panel = open(container, 1);
    const figs = [...panel.querySelectorAll('.nl-shot')];
    expect(figs).toHaveLength(3);
    expect(figs[0].querySelector('.nl-rec')).toBeTruthy();
    expect(figs[1].querySelector('.nl-zoom img').getAttribute('alt')).toMatch(/after a recording/i);
    expect(figs[2].querySelector('.nl-zoom img').getAttribute('alt')).toMatch(/feedback/i);
    expect(panel.textContent).not.toMatch(/Colour follows your voice/);
    expect(panel.textContent).not.toMatch(/While you speak, each stretch is coloured/);
    expect(panel.textContent).toMatch(/Voice practice is rolling out/);
  });
  it('the offer and the next-step panels show the whole Salary Prep and the whole Dashboard screens', () => {
    const { container } = show();
    expect(open(container, 2).querySelector('.nl-zoom img').getAttribute('alt')).toMatch(/Salary Prep/);
    expect(open(container, 3).querySelector('.nl-zoom img').getAttribute('alt')).toMatch(/Dashboard/);
  });
});

describe('the white sections', () => {
  it('the approach section and the footer are the white ones', () => {
    const { container } = show();
    expect(container.querySelector('#approach').classList.contains('nl-paper')).toBe(true);
    expect(container.querySelector('footer').classList.contains('nl-paper-foot')).toBe(true);
  });
});

describe('the emphasis in the headings and the lines under them', () => {
  it('only the main title has a phrase in the accent colour: every section title is one colour', () => {
    const { container } = show();
    expect(container.querySelectorAll('h1 em.nl-grad-text')).toHaveLength(1);
    for (const h of container.querySelectorAll('h2')) expect(h.querySelector('em, .nl-grad-text'), h.textContent).toBeNull();
  });
  it('the line under a title puts its key words in bold, in the same colour as the line, so it can be read at a glance', () => {
    const { container } = show();
    const strong = (sel) => [...container.querySelectorAll(`${sel} strong`)].map(x => x.textContent);
    expect(strong('#tools .nl-copy > p')).toEqual(['prepare', 'practise', 'decide']);
    expect(strong('#system .nl-light-lead')).toEqual(['build your confidence']);
    expect(strong('#coach .nl-coach-copy > p:not(.nl-coach-note)')).toEqual(['next move', 'interviews', 'salary', 'applications']);
    expect(strong('#approach .nl-approach-intro > p')).toEqual(['check yourself']);
  });
});

describe('what the page says the coach knows', () => {
  it('is the same everywhere: a short summary, never "your stories" or "what you did" in full', () => {
    const { container } = show();
    const all = [];
    for (const b of container.querySelectorAll('.nl-moment')) { fireEvent.click(b); all.push(container.querySelector('.nl-panel').textContent); }
    all.push(container.querySelector('#coach').textContent);
    const t = all.join(' ').replace(/\s+/g, ' ');
    expect(t).not.toMatch(/knows your profile, your sessions and your stories/i);
    expect(t).not.toMatch(/reads what you did in the other tools/i);
    expect(t).toMatch(/starts from a short summary of what you did in the other tools/i);
  });
});

describe('the AI Career Coach section', () => {
  const norm = (t) => t.replace(/\s+/g, ' ');
  it('comes after the situations and before the approach, as a simple chat with the real example questions', () => {
    const { container, onModuleSelect } = show();
    const sec = container.querySelector('#coach');
    expect(sec.previousElementSibling.id).toBe('system');
    expect(sec.nextElementSibling.id).toBe('approach');
    expect(within(sec).getByRole('heading', { level: 2 }).textContent).toBe('Ask your AI Career Coach');
    expect(norm(sec.textContent).split(' ').length).toBeLessThan(75);
    // The first example questions of src/features/AICoach/AICoach.jsx (QUICK_PROMPTS).
    expect([...sec.querySelectorAll('.nl-coach-q button')].map(b => b.textContent)).toEqual([
      'What should I focus on this week?', 'How do I answer the biggest weakness question?', 'How do I negotiate salary before I have an offer?',
    ]);
    expect(sec.querySelector('.nl-coach-typing')).toBeTruthy(); // the coach is "typing": the page shows no invented answer
    fireEvent.click(within(sec).getByRole('button', { name: /How do I negotiate salary/ }));
    expect(onModuleSelect).toHaveBeenLastCalledWith('aichat');
    fireEvent.click(within(sec).getByRole('button', { name: /Ask your career coach anything/i }));
    expect(onModuleSelect).toHaveBeenLastCalledWith('aichat');
  });
  it('is honest in one line about what the coach sees: a short summary, not the CV or the answers', () => {
    const { container } = show();
    const t = norm(container.querySelector('#coach').textContent);
    expect(t).toMatch(/target role, level, market and a short summary of your activity/i);
    expect(t).toMatch(/does not read your CV/i);
    expect(t).not.toMatch(/reads your (CV|resume)|knows everything|your whole (career|history)/i);
  });
});

describe('the confidence message', () => {
  const norm = (t) => t.replace(/\s+/g, ' ');
  it('is in the hero and in the line above the situations, and does not have a section of its own', () => {
    const { container } = show();
    expect(norm(container.querySelector('.nl-lead').textContent)).toMatch(/confidence/i);
    expect(norm(container.querySelector('#system .nl-light-lead').textContent)).toMatch(/build your confidence for the next step/i);
    expect(container.querySelector('#confidence')).toBeNull();
  });
  it('says plainly that no result is promised, and the story says the same', () => {
    const { container } = show();
    expect(norm(container.querySelector('#approach').textContent)).toMatch(/We cannot promise a result\. We can help you walk in prepared\./);
    expect(norm(container.querySelector('#story').textContent)).toMatch(/confiden/i);
    expect(norm(container.textContent)).not.toMatch(/we guarantee|guaranteed|will get you|you will be hired|ensure you/i); // the page does say it does not guarantee a result
  });
});

describe('the approach section opens with what a visitor can check', () => {
  it('says it plainly, and claims no certificate, audit or approval', () => {
    const { container } = show();
    const t = container.querySelector('#approach .nl-approach-intro').textContent.replace(/\s+/g, ' ');
    expect(t).toMatch(/Anyone can say they use AI responsibly\. Here is what you can check yourself/);
    expect(container.querySelector('#approach').textContent).not.toMatch(/certified|accredited|audited|authorized|compliant|ISO/i);
  });
});

describe('the approach section', () => {
  const norm = (t) => t.replace(/\s+/g, ' ');
  it('shows who does what as three connected steps of its own design, not a screenshot', () => {
    const { container } = show();
    const sec = container.querySelector('#approach');
    expect(sec.querySelector('img')).toBeNull();
    const steps = [...sec.querySelectorAll('.nl-flow-step')];
    expect(steps.map(st => st.querySelector('.nl-flow-tag').textContent)).toEqual(['Deterministic', 'AI', 'You']);
    expect(norm(steps[0].textContent)).toMatch(/The same input, the same result/);
    expect(norm(steps[1].textContent)).toMatch(/Explains and suggests/);
    expect(norm(steps[1].textContent)).toMatch(/never sets your score/i);
    expect(norm(steps[2].textContent)).toMatch(/Decide what to do/);
    expect(norm(steps[2].textContent)).toMatch(/Always/);
    expect(sec.querySelectorAll('.nl-flow-arrow')).toHaveLength(2);
  });
  it('does not claim a knowledge base the product cannot show', () => {
    const { container } = show();
    expect(norm(container.textContent)).not.toMatch(/knowledge base/i);
  });
  it('no image is used twice on the page', () => {
    const { container } = show();
    const srcs = [...container.querySelectorAll('img')].map(i => i.getAttribute('src'));
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});

describe('the motion switch', () => {
  it('pauses and resumes everything that moves, and says which state it is in', () => {
    const pause = vi.fn(); const resume = vi.fn();
    SVGElement.prototype.pauseAnimations = pause; SVGElement.prototype.unpauseAnimations = resume;
    const { container } = show();
    const root = container.querySelector('.nl');
    const btn = screen.getByRole('button', { name: /Pause motion/i });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(root.getAttribute('data-motion')).toBe('on');
    fireEvent.click(btn);
    expect(root.getAttribute('data-motion')).toBe('paused');
    expect(screen.getByRole('button', { name: /Play motion/i }).getAttribute('aria-pressed')).toBe('true');
    expect(pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Play motion/i }));
    expect(root.getAttribute('data-motion')).toBe('on');
    expect(resume).toHaveBeenCalled();
    delete SVGElement.prototype.pauseAnimations; delete SVGElement.prototype.unpauseAnimations;
  });
  it('sits next to the tool diagram, where most of the motion is', () => {
    const { container } = show();
    expect(container.querySelector('.nl-orb-wrap .nl-motion-btn')).toBeTruthy();
  });
});

describe('the heading outline', () => {
  it('has one h1 and never skips a level, so a screen reader can move through the page by headings', () => {
    const { container } = show();
    const levels = [...container.querySelectorAll('h1, h2, h3, h4')].map(h => Number(h.tagName[1]));
    expect(levels.filter(l => l === 1)).toHaveLength(1);
    levels.reduce((prev, l) => { expect(l - prev).toBeLessThanOrEqual(1); return l; }, 0);
  });
  it('gives every section its own h2, and the coach is one of them', () => {
    const { container } = show();
    for (const id of ['tools', 'system', 'coach', 'approach', 'faq', 'story', 'partner']) expect(container.querySelector(`#${id} h2`)).toBeTruthy();
  });
});

describe('the hero board', () => {
  it('is the interactive Resume Builder example, not a picture', () => {
    const { container } = show();
    expect(container.querySelector('.nl-hero-shot [data-testid="resume-demo"]')).toBeTruthy();
    expect(container.querySelector('.nl-hero-shot img')).toBeNull();
    expect(container.querySelector('.nl-hero-shot .nl-demo-foot').textContent).toMatch(/sample CV/i);
  });
  it('the sign-up button inside the example starts sign-up', async () => {
    const { onStart } = show();
    fireEvent.click(screen.getByRole('button', { name: /Next: improve it/i }));
    fireEvent.click(screen.getByRole('button', { name: /Fix it now/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create a free account/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('the challenge section', () => {
  it('says it in three short lines, with the one idea in bold: one CV and one memory behind every tool', () => {
    const { container } = show();
    const sec = container.querySelector('.nl-challenge');
    expect(within(sec).getByRole('heading', { level: 2 }).textContent).toBe('Your career is connected. Your tools are not.');
    const lines = sec.querySelectorAll('.nl-copy .nl-point');
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l.textContent.split(/\s+/).length).toBeLessThanOrEqual(22);
    expect([...sec.querySelectorAll('.nl-copy strong')].pop().textContent).toMatch(/one CV and one memory behind every tool/i);
    expect(sec.textContent).not.toMatch(/fragmented|communicating your experience/);
  });
  it('draws the connection: the real CareerAiHub orbit logo turns in the middle, and on each line a dot runs in from the tool while another runs out from the logo, so the two meet', () => {
    const { container } = show();
    const orb = container.querySelector('.nl-orb');
    expect(orb.getAttribute('role')).toBe('img');
    const core = orb.querySelector('.nl-orb-core');
    expect(core.querySelector('svg ellipse')).toBeTruthy();          // the orbit rings of the brand mark (src/components/OrbitMark.jsx)
    expect(core.querySelector('svg animateMotion')).toBeTruthy();    // its satellites move
    expect(orb.querySelectorAll('.nl-orb-lines path.nl-line')).toHaveLength(8);
    expect(orb.querySelectorAll('.nl-orb-lines path.nl-flow-line')).toHaveLength(8);        // a soft light that keeps flowing along each line
    expect(orb.querySelectorAll('.nl-orb-lines .nl-pulse[data-dir="in"]')).toHaveLength(24);   // three dots in each direction on every line, spread out, so the light never stops
    expect(orb.querySelectorAll('.nl-orb-lines .nl-pulse[data-dir="out"]')).toHaveLength(24);
    for (const dot of orb.querySelectorAll('.nl-orb-lines .nl-pulse')) { // a dot waits for its turn out of sight, not in the corner of the drawing
      expect(dot.getAttribute('visibility')).toBe('hidden');
      expect(dot.querySelector('set[attributeName="visibility"]')).toBeTruthy();
    }
    // The tools and badges of the app's own sidebar (src/components/AppSidebar.jsx). Verify Creds (in development) and TrustMatch (planned) are left out and the page says more are on the way.
    expect([...orb.querySelectorAll('.nl-orb-card')].map(c => `${c.querySelector('.nl-orb-name').textContent} ${c.querySelector('.nl-orb-badge').textContent}`)).toEqual([
      'Resume Builder Live', 'ATS Scanner Live', 'Cover Letter AI New', 'Interview Coach Live', 'Salary Prep Live', 'Skills Gap New', 'Career Roadmap New', 'AI Career Coach New',
    ]);
    expect(container.querySelector('.nl-orb-caption').textContent).toMatch(/Every tool starts from the same CV and memory/);
    expect(container.querySelector('.nl-orb-caption').textContent).toMatch(/More tools are in development/);
  });
});

describe('the small-screen menu', () => {
  it('opens, lists the sections, and closes with the button, a link, or Escape', () => {
    show();
    const btn = () => screen.getByRole('button', { name: /(Open|Close) menu/i });
    expect(btn().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn());
    expect(btn().getAttribute('aria-expanded')).toBe('true');
    const menu = document.getElementById('nl-menu');
    expect(within(menu).getAllByRole('link').map(a => a.textContent)).toEqual(['Tools', 'Our Approach', 'Our Story', 'Partnership']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('nl-menu')).toBeNull();
    fireEvent.click(btn());
    fireEvent.click(within(document.getElementById('nl-menu')).getByRole('link', { name: 'Tools' }));
    expect(document.getElementById('nl-menu')).toBeNull();
  });
});

describe('the situation chooser', () => {
  it('asks "Where are you right now?" with four situations and answers with what you get', () => {
    show();
    const group = screen.getByRole('group', { name: /Where are you right now/i });
    const moments = within(group).getAllByRole('button');
    expect(moments).toHaveLength(4);
    expect(moments[0].getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { level: 3, name: /applications you have checked/i })).toBeTruthy();
    fireEvent.click(moments[2]);
    expect(moments[2].getAttribute('aria-pressed')).toBe('true');
    expect(moments[0].getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('heading', { level: 3, name: /what you will say before you sit down/i })).toBeTruthy();
  });

  it('the interview situation shows the recording, the speaking insights and the delivery feedback, and says voice is rolling out', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /I have an interview coming/i }));
    const parts = screen.getAllByRole('img').filter(i => /voice|spoken|recording/i.test(i.getAttribute('aria-label') || i.getAttribute('alt') || ''));
    expect(parts.length).toBe(3); // the moving recording, the screen after recording, the feedback screen
    expect(document.body.textContent).toMatch(/Voice practice is rolling out/);
  });

  it('every image has a description, and the page says what each screen is', () => {
    show();
    expect(document.body.textContent).toMatch(/synthetic account and made-up data|personal details blurred/i);
    for (const b of screen.getByRole('group', { name: /Where are you right now/i }).querySelectorAll('button')) {
      fireEvent.click(b);
      for (const img of document.querySelectorAll('img')) expect((img.getAttribute('alt') || '').length).toBeGreaterThan(20);
      expect(document.querySelector('.nl-panel .nl-panel-note').textContent).toMatch(/synthetic account and made-up data/i);
    }
  });
});

describe('the questions and answers', () => {
  it('replace the list of what we do not do, as native, keyboard-friendly disclosures', () => {
    show();
    expect(screen.queryByRole('heading', { name: /What we do not do/i })).toBeNull();
    const items = document.querySelectorAll('details.nl-qa');
    expect(items.length).toBeGreaterThanOrEqual(6);
    for (const d of items) expect(d.querySelector('summary')?.textContent.trim().endsWith('?')).toBe(true);
  });

  it('answer honestly about price, the check, AI, prediction, data, voice and employers', () => {
    show();
    const text = document.getElementById('faq').textContent;
    expect(text).toMatch(/Is CareerAiHub free\?.*while we build.*no paid plan has been announced/i);
    expect(text).toMatch(/same CV gives the same result/i);
    expect(text).toMatch(/not the score any recruiting system gives you/i);
    expect(text).toMatch(/does not change the result of the check/i);
    expect(text).toMatch(/does not predict or guarantee a result/i);
    expect(text).toMatch(/we do not keep them/i);
    expect(text).toMatch(/not available to everyone yet/i);
    expect(text).toMatch(/Employer matching is planned and credential checks are in development/i);
  });
});

describe('the new landing page makes no claim the product cannot back', () => {
  // The text with a space between elements, so figures that sit side by side (0 and 7 of 9) are not read as one number.
  const text = () => { const r = show(); const w = document.createTreeWalker(r.container, NodeFilter.SHOW_TEXT); const parts = []; while (w.nextNode()) parts.push(w.currentNode.nodeValue); cleanup(); return parts.join(' '); };
  it('has no prices, ratings, user counts, partner logos, percentages or "verified" claims', () => {
    const t = text();
    for (const re of [/\$\s?\d/, /\bSGD\s?\d/, /free trial|cancel anytime|money-back|refund/i, /\d[\d,]*\+/, /★|stars?\b/i, /verified/i, /testimonial|trusted by|used by/i, /\b\d+%/, /blockchain|Singpass|OpenCerts|Credly/i]) {
      expect(t.match(re)?.[0] ?? null).toBeNull();
    }
  });
  it('uses only the numbers on an allow-list (the owner approves additions)', () => {
    const t = text();
    const found = [...new Set(t.match(/\d+/g) || [])];
    // Counts of steps and questions, the footer year, and the figures of the sample CV in the interactive example, which the owner supplied and approved on 2026-10-21.
    // The ATS Scanner example adds 82, 85 and 90 (the owner's screenshot of 2026-10-22) and 60 (an example figure for the keyword bar).
    const DEMO = ['0', '4', '7', '9', '75', '78', '83', '100', '488', '60', '82', '85', '90'];
    const ALLOWED = ['1', '2', '3', '5', ...DEMO, String(new Date().getFullYear())];
    expect(found.filter(n => !ALLOWED.includes(n))).toEqual([]);
  });
  it('does not show a founder photo or a founder name until the owner supplies them', () => {
    const r = show();
    expect(r.container.querySelector('.nl-founder')).toBeNull();
    expect(r.container.textContent).not.toMatch(/Ivy Nguyen|Founded by/);
  });
});
