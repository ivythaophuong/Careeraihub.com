import { useEffect, useRef } from 'react';

// For a row of tabs that can be wider than the screen (a phone). Put the returned ref on the row and mark the chosen tab with aria-current="page".
//  - The chosen tab is brought into view when it changes: only the row is scrolled (scrollLeft), never the page, and only if the tab is not already
//    fully in view.
//  - The row says whether there is more to scroll to (data-more="true" | "false"), so the style sheet can show a fade at its edge.
export function useScrollTabs(activeKey) {
  const ref = useRef(null);

  const update = () => {
    const el = ref.current;
    if (el) el.setAttribute('data-more', el.scrollWidth - el.clientWidth - el.scrollLeft > 2 ? 'true' : 'false');
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    return () => { el.removeEventListener('scroll', update); if (ro) ro.disconnect(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    const tab = el?.querySelector('[aria-current="page"]');
    if (el && tab) {
      const row = el.getBoundingClientRect();
      const t = tab.getBoundingClientRect();
      if (t.left < row.left || t.right > row.right) el.scrollLeft = t.left - row.left + el.scrollLeft - (el.clientWidth - t.width) / 2;
    }
    update();
  }, [activeKey]);   // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
