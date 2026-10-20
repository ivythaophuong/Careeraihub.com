import { C } from '../../styles/theme';

// The practice screen uses one accent colour, flat buttons and plain borders. The shared Btn (a gradient from the persona colour to blue) is left alone for the rest of the app.
export const primaryBtn = (disabled) => ({
  background: disabled ? C.border : C.accent, color: disabled ? C.muted : '#0b1020', border: 'none', borderRadius: 10, padding: '11px 26px', fontSize: 13, fontWeight: 800,
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
});
export const quietBtn = (disabled) => ({
  background: 'transparent', color: disabled ? C.muted : C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, fontFamily: 'inherit',
});
