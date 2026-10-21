// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ZoomShot from './ZoomShot';

afterEach(cleanup);
const show = () => render(<ZoomShot src="/x.png" w={1368} h={1135} alt="The whole voice answer screen after a recording, with the transcript and the Delivery column" />);

describe('where the dialog is drawn', () => {
  it('is the page root, outside any box that has an entrance animation', () => {
    const { container } = render(<div className="nl"><div className="nl-panel"><ZoomShot src="/x.png" w={10} h={10} alt="A whole screen of the product, to be opened bigger" /></div></div>);
    fireEvent.click(screen.getByRole('button', { name: /Enlarge/i }));
    const dlg = screen.getByRole('dialog');
    expect(container.querySelector('.nl').contains(dlg)).toBe(true);
    expect(container.querySelector('.nl-panel').contains(dlg)).toBe(false);
  });
});

describe('a screen that can be opened bigger', () => {
  it('shows the whole screen as a button, and opens it in a dialog that can be closed three ways', () => {
    show();
    expect(screen.queryByRole('dialog')).toBeNull();
    const opener = screen.getByRole('button', { name: /Enlarge: The whole voice answer screen/i });
    fireEvent.click(opener);
    const dlg = screen.getByRole('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.querySelector('img').getAttribute('src')).toBe('/x.png');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('moves the focus into the dialog and gives it back to the button that opened it', () => {
    show();
    const opener = screen.getByRole('button', { name: /Enlarge/i });
    opener.focus(); fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Close/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
  it('can be scrolled with the keyboard: the scrolling area can take focus', () => {
    show();
    fireEvent.click(screen.getByRole('button', { name: /Enlarge/i }));
    const area = screen.getByRole('region', { name: /enlarged screen/i });
    expect(area.getAttribute('tabindex')).toBe('0');
  });
  it('keeps the size on the thumbnail so the page does not jump while it loads', () => {
    show();
    const img = screen.getByRole('button', { name: /Enlarge/i }).querySelector('img');
    expect(img.getAttribute('width')).toBe('1368'); expect(img.getAttribute('height')).toBe('1135');
    expect(img.getAttribute('loading')).toBe('lazy');
  });
});
