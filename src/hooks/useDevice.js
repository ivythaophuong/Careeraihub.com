import { useState, useEffect } from 'react';

// Device classes the shell adapts to. Width-based so it also reacts when a
// window is resized or a tablet is rotated.
export const BREAKPOINTS = { tablet: 768, desktop: 1100 };

const classify = (w) => (w < BREAKPOINTS.tablet ? 'mobile' : w < BREAKPOINTS.desktop ? 'tablet' : 'desktop');

const read = () => {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return { device: classify(w), width: w, isTouch: !!touch };
};

export function useDevice() {
  const [state, setState] = useState(read);

  useEffect(() => {
    const update = () => setState(prev => {
      const next = read();
      return prev.device === next.device && prev.isTouch === next.isTouch && prev.width === next.width ? prev : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Expose to CSS: [data-device="mobile"] { ... }
  useEffect(() => {
    document.documentElement.dataset.device = state.device;
    document.documentElement.dataset.touch = state.isTouch ? 'true' : 'false';
  }, [state.device, state.isTouch]);

  return { ...state, isMobile: state.device === 'mobile', isTablet: state.device === 'tablet', isDesktop: state.device === 'desktop' };
}
