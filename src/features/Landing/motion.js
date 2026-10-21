// The visitor's device can ask for reduced motion. The page respects that, with one exception the owner chose: the logo in the tool diagram keeps turning, slowly.
export const reducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
