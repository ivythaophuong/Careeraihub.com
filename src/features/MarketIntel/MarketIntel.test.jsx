import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MarketIntel from './MarketIntel';

afterEach(cleanup);

describe('Market Intel', () => {
  it('says plainly that it is general guidance and not live data', () => {
    render(<MarketIntel form={{ market: 'Singapore' }} memory={{}} />);
    expect(screen.getByRole('note').textContent).toMatch(/not live market data/i);
  });
  it('still lets the user switch regions', () => {
    render(<MarketIntel form={{ market: 'Singapore' }} memory={{}} />);
    expect(screen.getByText(/Singapore Playbook/)).toBeTruthy();
    fireEvent.click(screen.getByText(/US Tech/));
    expect(screen.getByText(/US Tech Playbook/)).toBeTruthy();
  });

  it('is named and described as a guide, not as market intelligence or data', () => {
    render(<MarketIntel form={{ market: 'Singapore' }} memory={{}} />);
    expect(screen.getByText('Regional Hiring Guide')).toBeTruthy();
    expect(screen.queryByText(/Market Intelligence/i)).toBeNull();
    // apart from the disclaimer itself, nothing on the page talks about live or real-time data
    const rest = document.body.textContent.replace(screen.getByRole('note').textContent, '');
    expect(rest).not.toMatch(/\blive\b|real-?time/i);
  });

  it('puts the disclaimer in the header, before any figure, and labels the figures as typical', () => {
    render(<MarketIntel form={{ market: 'Singapore' }} memory={{}} />);
    const note = screen.getByRole('note');
    const firstTile = screen.getByText(/Interview Rounds \(typical\)/);
    // the note comes before the metric tiles in document order
    expect(note.compareDocumentPosition(firstTile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Decision Speed \(typical\)/)).toBeTruthy();
    expect(screen.queryByText('Top Hiring Signal')).toBeNull();
  });

  it('has no source, timestamp or model call to present (static text only)', () => {
    render(<MarketIntel form={{ market: 'Singapore' }} memory={{}} />);
    expect(document.body.textContent).not.toMatch(/updated|as of|last refreshed|source:/i);
  });
});
