// Whether the page may move. The visitor's device can ask for reduced motion; the page respects that, and offers one button to play the motion anyway for a visitor who wants to see it.
let forced = false;
export const setMotionForced = (v) => { forced = !!v; };
export const systemWantsReducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
// What the pieces of the page read when they mount: true means "stand still".
export const reducedMotion = () => !forced && systemWantsReducedMotion();
