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
});
