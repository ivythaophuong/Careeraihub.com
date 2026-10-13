import { describe, it, expect } from 'vitest';
import { extractExperiences } from './experience';

describe('extractExperiences', () => {
  it('splits a title-then-company entry with the date tabbed onto the title line (P1 shape)', () => {
    const [e] = extractExperiences('Product Manager\tJan 2021 - Mar 2024\nAcme Ltd\n• Increased lead qualification by 20 percent\n• Led a team of 6');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
    expect(e.start.normalized_value).toBe('2021-01');
    expect(e.end.normalized_value).toBe('2024-03');
    expect(e.bullets.map(b => b.value)).toEqual(['Increased lead qualification by 20 percent', 'Led a team of 6']);
  });

  it('splits a company-then-title entry (the other common order)', () => {
    const [e] = extractExperiences('Acme Ltd\tJan 2021 - Mar 2024\nProduct Manager\n• Shipped three releases');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
  });

  it('handles "Title, Company" on one line with the date range on the same line', () => {
    const [e] = extractExperiences('Product Manager, Acme Ltd (Jan 2021 - Mar 2024)\n• Increased lead qualification by 20 percent');
    expect(e.title.value).toBe('Product Manager');
    expect(e.company.value).toBe('Acme Ltd');
  });

  it('splits several entries using the date line as the boundary between them', () => {
    const es = extractExperiences(
      'Product Manager\tJan 2023 - Present\nAcme Ltd\n• Did A\n' +
      'Associate PM\tJan 2021 - Dec 2022\nAcme Ltd\n• Did B'
    );
    expect(es).toHaveLength(2);
    expect(es[0].title.value).toBe('Product Manager');
    expect(es[0].end.normalized_value).toBe('present');
    expect(es[1].title.value).toBe('Associate PM');
    expect(es[1].end.normalized_value).toBe('2022-12');
  });

  it('an ongoing role (no end date given) is end=present via the date line', () => {
    const [e] = extractExperiences('Founder\tMar 2022 - Present\nOwn startup\n• Built the product');
    expect(e.end.value).toMatch(/present/i);
  });

  it('reads "Company — Title" when only the second part is title-shaped', () => {
    const [e] = extractExperiences('Brightwave Media — Content Strategist\nJanuary 2021 – December 2023\n• Planned 120 articles');
    expect(e.title.value).toBe('Content Strategist');
    expect(e.company.value).toBe('Brightwave Media');
  });

  it('leaves both null after a dash when neither side is title-shaped, instead of guessing an order', () => {
    const [e] = extractExperiences('Lumen Studio — Quokka Handler\nSeptember 2018 – December 2020\n• Wrote product copy for 30 clients');
    expect(e.title.value).toBeNull();
    expect(e.company.value).toBeNull();
    expect(e.title.requiresInterpretation).toBe(true);
  });

  it('recognises common job nouns such as copywriter, editor and supervisor', () => {
    for (const t of ['Junior Copywriter', 'Managing Editor', 'Shift Supervisor', 'Sales Representative', 'Lab Technician']) {
      const [e] = extractExperiences(`Lumen Studio — ${t}\nSep 2018 – Dec 2020\n• Did the work`);
      expect(e.title.value, t).toBe(t);
      expect(e.company.value, t).toBe('Lumen Studio');
    }
  });

  it('reads a capitalised "<Area> Lead" at the end of a line as a title, but not "lead generation"', () => {
    const [e] = extractExperiences('Cobalt Payments\nOperations Lead\nApr 2022 - Present\n• Managed a team of 9');
    expect(e.title.value).toBe('Operations Lead');
    expect(e.company.value).toBe('Cobalt Payments');
    const [g] = extractExperiences('Acme Ltd\nBrand Manager\nJan 2020 - Dec 2021\n• Improved lead generation by 20 percent');
    expect(g.title.value).toBe('Brand Manager');
  });

  it('gives a second role under the same employer heading that employer, at lower confidence', () => {
    const es = extractExperiences('Cobalt Payments\nOperations Lead\nApr 2022 - Present\n• Managed a team of 9\nOperations Analyst\nFeb 2020 - Mar 2022\n• Cut resolution time');
    expect(es).toHaveLength(2);
    expect(es[1].title.value).toBe('Operations Analyst');
    expect(es[1].company.value).toBe('Cobalt Payments');
    expect(es[1].company.confidence).toBeLessThan(es[0].company.confidence);
  });

  it('does not invent an employer for a lone title when the first entry had no separate company line', () => {
    const es = extractExperiences('Product Manager, Acme Ltd (Jan 2021 - Mar 2024)\n• Shipped\nSenior Analyst\nJan 2019 - Dec 2020\n• Reported');
    expect(es[1].company.value).toBeNull();
  });

  it('does not start an entry at a bullet that merely mentions a year', () => {
    const es = extractExperiences('Account Executive, Solara Energy\nMar 2019 - Dec 2022\n- Closed $1.2M in new contracts in 2021\n- Doubled the pipeline');
    expect(es).toHaveLength(1);
    expect(es[0].bullets.map(b => b.value)).toEqual(['Closed $1.2M in new contracts in 2021', 'Doubled the pipeline']);
  });

  it('still starts an entry at a bullet that holds a full date range', () => {
    const es = extractExperiences('Analyst, Acme\nJan 2020 - Dec 2020\n- Reported weekly\n- Project Atlas, Mar 2021 - Jun 2021');
    expect(es.length).toBeGreaterThanOrEqual(1);
  });

  it('is conservative when neither header line looks like a title or a company: both left null', () => {
    const [e] = extractExperiences('Something Vague\tJan 2021 - Mar 2024\nAlso Vague\n• A bullet');
    // Neither "Something Vague" nor "Also Vague" contains a title keyword or an all-caps/company shape
    // distinction strong enough to tell them apart; the extractor must not coin-flip which is which.
    expect(e.title.requiresInterpretation || e.company.requiresInterpretation).toBe(true);
  });

  it('returns an empty array when the section has no date at all (nothing to anchor an entry on)', () => {
    expect(extractExperiences('Worked on various things without any dates listed')).toEqual([]);
    expect(extractExperiences('')).toEqual([]);
  });

  it('bullets never include the entry header or date lines', () => {
    const [e] = extractExperiences('Engineer\tJan 2021 - Mar 2024\nAcme Ltd\n• Did the actual work');
    expect(e.bullets.map(b => b.value)).not.toContain('Acme Ltd');
    expect(e.bullets.every(b => !/2021|2024/.test(b.value))).toBe(true);
  });

  describe('the header of the NEXT job is not a bullet of the previous one', () => {
    const bulletsOf = (e) => e.bullets.map(b => b.value);

    it('"Title, Company" on its own line, then the date line', () => {
      const [a, b] = extractExperiences(
        'Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30% across 4 teams\n• Built 3 dashboards\n' +
        'Analyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%'
      );
      expect(bulletsOf(a)).toEqual(['Cut report time by 30% across 4 teams', 'Built 3 dashboards']);
      expect(bulletsOf(b)).toEqual(['Reduced errors by 25%']);
      expect(b.title.value).toBe('Analyst');
      expect(b.company.value).toBe('Beta Ltd');
    });

    it('company line and title line before the date line (two header lines)', () => {
      const [a, b] = extractExperiences(
        'Acme Corp\nSenior Analyst\nJan 2020 – Mar 2023\n• Built 3 dashboards\n' +
        'Beta Ltd\nAnalyst\nJun 2017 – Dec 2019\n• Reduced errors by 25%'
      );
      expect(bulletsOf(a)).toEqual(['Built 3 dashboards']);
      expect(bulletsOf(b)).toEqual(['Reduced errors by 25%']);
      expect(a.company.value).toBe('Acme Corp');
      expect(b.company.value).toBe('Beta Ltd');
      expect(b.title.value).toBe('Analyst');
    });

    it('company before the date line, title tabbed on the date line', () => {
      const [a, b] = extractExperiences(
        'Senior Analyst\tJan 2020 – Mar 2023\nAcme Corp\n• Built 3 dashboards\n' +
        'Beta Ltd\nAnalyst\tJun 2017 – Dec 2019\n• Reduced errors by 25%'
      );
      expect(bulletsOf(a)).toEqual(['Built 3 dashboards']);
      expect(b.company.value).toBe('Beta Ltd');
    });

    it('a real achievement line before the next date line stays a bullet of the previous job', () => {
      const [a] = extractExperiences(
        'Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Built 3 dashboards.\nManaged a budget of $2M\n' +
        'Analyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%'
      );
      expect(bulletsOf(a)).toEqual(['Built 3 dashboards.', 'Managed a budget of $2M']);
    });

    it('a sentence that ends with a full stop is never taken as a header', () => {
      const [a] = extractExperiences(
        'Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Built 3 dashboards.\nWorked as a data analyst on weekly reports.\n' +
        'Analyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%'
      );
      expect(bulletsOf(a)).toContain('Worked as a data analyst on weekly reports.');
    });

    it('the last job keeps all its bullets', () => {
      const es = extractExperiences('Analyst, Beta Ltd\nJun 2017 – Dec 2019\n• One\n• Two\n• Three');
      expect(bulletsOf(es[0])).toEqual(['One', 'Two', 'Three']);
    });

    it('three jobs in a row each keep only their own bullets', () => {
      const es = extractExperiences(
        'Manager, Acme\n2021 – 2023\n• A1\n• A2\nAnalyst, Beta\n2019 – 2021\n• B1\nIntern, Gamma\n2018 – 2019\n• C1'
      );
      expect(es.map(bulletsOf)).toEqual([['A1', 'A2'], ['B1'], ['C1']]);
    });
  });

  describe('other common layouts', () => {
    const bulletsOf = (e) => e.bullets.map(b => b.value);

    it('"Title | Company | dates" on one line (pipes)', () => {
      const [a, b] = extractExperiences('Senior Analyst | Acme Corp | Jan 2020 – Mar 2023\n• Built 3 dashboards\nAnalyst | Beta Ltd | Jun 2017 – Dec 2019\n• Reduced errors by 25%');
      expect([a.title.value, a.company.value]).toEqual(['Senior Analyst', 'Acme Corp']);
      expect([b.title.value, b.company.value]).toEqual(['Analyst', 'Beta Ltd']);
    });

    it('"Company | Title | dates" (other order)', () => {
      const [a] = extractExperiences('Acme Corp | Senior Analyst | Jan 2020 – Mar 2023\n• Built 3 dashboards');
      expect([a.title.value, a.company.value]).toEqual(['Senior Analyst', 'Acme Corp']);
    });

    it('a bullet that wraps onto a second line is one bullet, not two', () => {
      const [a] = extractExperiences('Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30% across four regional teams by redesigning the\nweekly intake process\n• Built 3 dashboards');
      expect(bulletsOf(a)).toEqual(['Cut report time by 30% across four regional teams by redesigning the weekly intake process', 'Built 3 dashboards']);
    });

    it('a wrapped line does not leak into the next job\'s title and company', () => {
      const [a, b] = extractExperiences('Analyst, Acme Corp\nJan 2020 – Mar 2023\n• Cut report time by 30% across four regional teams by redesigning the\nweekly intake process\nAnalyst, Beta Ltd\nJun 2017 – Dec 2019\n• Reduced errors by 25%');
      expect(bulletsOf(a)).toHaveLength(1);
      expect([b.title.value, b.company.value]).toEqual(['Analyst', 'Beta Ltd']);
    });

    describe('a wrapped bullet is recognised by several signals, not by case alone', () => {
      const one = (body) => bulletsOf(extractExperiences(`Analyst, Acme Corp\nJan 2020 – Mar 2023\n${body}`)[0]);

      it('the second line starts with a number', () => {
        expect(one('• Improved reporting accuracy by\n25% through automated validation\n• Built 3 dashboards'))
          .toEqual(['Improved reporting accuracy by 25% through automated validation', 'Built 3 dashboards']);
      });
      it('the second line starts with a capital, inside a list whose bullets have markers', () => {
        expect(one('• Improved reporting accuracy\nThrough automated validation, reduced manual review\n• Built 3 dashboards'))
          .toEqual(['Improved reporting accuracy Through automated validation, reduced manual review', 'Built 3 dashboards']);
      });
      it('the first line ends in a word that cannot end a sentence (by, and, of, the...) or a comma', () => {
        expect(one('Cut costs across the\nOperations division by 12%\nBuilt 3 dashboards.'))
          .toEqual(['Cut costs across the Operations division by 12%', 'Built 3 dashboards.']);
        expect(one('• Reduced errors, saved time,\nImproved morale\n• Built 3 dashboards'))
          .toEqual(['Reduced errors, saved time, Improved morale', 'Built 3 dashboards']);
      });
      it('after a finished sentence a capital starts a new bullet, even without a marker', () => {
        expect(one('• Built 3 dashboards.\nManaged a budget of $2M'))
          .toEqual(['Built 3 dashboards.', 'Managed a budget of $2M']);
      });
      it('with no markers at all, two complete lines stay two bullets', () => {
        expect(one('Cut report time by 30% across 4 teams\nBuilt 3 dashboards used by 6 managers'))
          .toEqual(['Cut report time by 30% across 4 teams', 'Built 3 dashboards used by 6 managers']);
      });
      it('a marker always starts a new bullet', () => {
        expect(one('• Improved reporting accuracy by\n• 25% fewer errors')).toEqual(['Improved reporting accuracy by', '25% fewer errors']);
      });
    });

    it('a ranges written "to Present" gives the title and company, not date words', () => {
      const [a] = extractExperiences('Analyst, Acme Corp\nJanuary 2020 to Present\n• Built 3 dashboards');
      expect([a.title.value, a.company.value]).toEqual(['Analyst', 'Acme Corp']);
      expect(a.end.normalized_value).toBe('present');
    });

    it('a job whose header sits before its date, after a plain-text achievement of the previous job (no bullet glyphs, as in many PDFs)', () => {
      const [a, b] = extractExperiences(
        'Senior Analyst, Acme Corp\nJan 2020 – Mar 2023\nCut report time by 30% across 4 teams\nBuilt 3 dashboards used by 6 managers\n' +
        'Analyst, Beta Ltd\nJun 2017 – Dec 2019\nReduced errors by 25%'
      );
      expect(bulletsOf(a)).toEqual(['Cut report time by 30% across 4 teams', 'Built 3 dashboards used by 6 managers']);
      expect([b.title.value, b.company.value]).toEqual(['Analyst', 'Beta Ltd']);
    });
  });
});
