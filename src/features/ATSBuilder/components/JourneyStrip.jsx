import React from 'react';
import { stageStates } from '../journey.js';
import { useScrollTabs } from '../../../hooks/useScrollTabs.js';

// The strip of four stages above the tabs of the Resume Builder (design: docs/architecture/plans/DESIGN-guided-journey.md). It says where the user is ("you are
// here") and which stages they have been in during this visit ("visited"). It never says a stage is done: the product does not know that. A click goes to the
// stage (the parent decides how); a click on the stage the user is in does nothing. On a narrow screen the row scrolls and keeps the stage in view.
export default function JourneyStrip({ current, visited, onGo }) {
  const states = stageStates(current, visited);
  const rowRef = useScrollTabs(current);
  return (
    <nav aria-label="Your progress" style={{ margin: '10px 0 2px' }}>
      <ol ref={rowRef} className="scroll-tabs" style={{ display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: '2px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {states.map(s => {
          const here = s.state === 'here'; const visitedMark = s.state === 'visited';
          return (
            <li key={s.id} style={{ flexShrink: 0 }}>
              <button type="button" aria-current={here ? 'step' : undefined}
                aria-label={`${s.position}: ${s.label}${here ? ', you are here' : visitedMark ? ', visited' : ''}`}
                onClick={() => { if (!here && typeof onGo === 'function') onGo(s.id); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 5px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12.5, whiteSpace: 'nowrap',
                  cursor: here ? 'default' : 'pointer', background: here ? 'var(--lp-bg3)' : 'transparent',
                  border: `1px solid ${here ? 'var(--lp-text2)' : 'var(--lp-bdr)'}`, fontWeight: here ? 800 : 600, color: here ? 'var(--lp-text)' : visitedMark ? 'var(--lp-text2)' : 'var(--lp-text3)',
                }}>
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{visitedMark ? '✓' : s.id}</span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
