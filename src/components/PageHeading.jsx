import { MODULES } from '../styles/theme';

// One level-1 heading per screen, named after the sidebar item. It is hidden from the eye (the screens draw their own visible titles) but a screen reader and the document outline get it.
const HIDDEN = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

export default function PageHeading({ moduleId }) {
  const label = MODULES.find(m => m.id === moduleId)?.label;
  return label ? <h1 style={HIDDEN}>{label}</h1> : null;
}
