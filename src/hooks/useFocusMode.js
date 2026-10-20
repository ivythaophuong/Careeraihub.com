import { useState, useRef, useCallback, useEffect } from 'react';

// Focus mode for a screen that wants the rest of the page quiet while the person works (the mock interview). When focus starts the app collapses its sidebar,
// and puts it back when focus ends, unless the person already had it collapsed, or opened it themselves during focus. The collapsed sidebar still navigates,
// so nobody is trapped in focus.
export function useFocusMode(collapsed, setCollapsed) {
  const [focus, setFocus] = useState(false);
  const collapsedRef = useRef(collapsed);
  const byFocus = useRef(false); // true while the collapsed sidebar is our doing
  collapsedRef.current = collapsed;

  useEffect(() => { if (byFocus.current && !collapsed) byFocus.current = false; }, [collapsed]); // the person opened it: it is theirs now

  const onFocusChange = useCallback((on) => {
    setFocus(!!on);
    if (on) {
      if (!collapsedRef.current && !byFocus.current) { byFocus.current = true; setCollapsed(true); }
    } else if (byFocus.current) {
      byFocus.current = false;
      setCollapsed(false);
    }
  }, [setCollapsed]);

  return { focus, onFocusChange };
}
