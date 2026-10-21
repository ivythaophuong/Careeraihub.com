import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A whole screen of the product, shown complete as a thumbnail. It opens bigger in a dialog (Escape, the close button or a click outside closes it) so the small text can be read.
export default function ZoomShot({ src, w, h, alt }) {
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  const closer = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closer.current?.focus();
      const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) { wasOpen.current = false; opener.current?.focus(); }
    return undefined;
  }, [open]);

  return (
    <>
      <button type="button" className="nl-zoom" ref={opener} onClick={() => setOpen(true)} aria-label={`Enlarge: ${alt}`}>
        <img src={src} width={w} height={h} alt={alt} loading="lazy" decoding="async" />
        <span className="nl-zoom-hint" aria-hidden="true">Click to enlarge</span>
      </button>
      {open && createPortal(
        <div className="nl-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="nl-lightbox-close" ref={closer} onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-label="Close">&times;</button>
          <div className="nl-lightbox-scroll" role="region" aria-label="The enlarged screen. Use the arrow keys to scroll." tabIndex={0} onClick={(e) => e.stopPropagation()}>
            <img src={src} width={w} height={h} alt={alt} />
          </div>
        </div>,
        // Into the page root, not into the panel: the panel has an entrance animation, and a fixed box inside an animated box is fixed to that box, not to the window.
        opener.current?.closest('.nl') || document.body,
      )}
    </>
  );
}
