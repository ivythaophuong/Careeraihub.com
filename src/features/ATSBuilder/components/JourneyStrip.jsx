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
    <nav aria-label="Your progress" className="jy-strip">
      <ol ref={rowRef} className="jy-list scroll-tabs">
        {states.map(s => {
          const here = s.state === 'here'; const visitedMark = s.state === 'visited';
          return (
            <li key={s.id} className="jy-item">
              <button type="button" aria-current={here ? 'step' : undefined}
                className={`jy-step${here ? ' is-here' : ''}${visitedMark ? ' is-visited' : ''}`}
                title={s.label}
                aria-label={`${s.position}: ${s.label}${here ? ', you are here' : visitedMark ? ', visited' : ''}`}
                onClick={() => { if (!here && typeof onGo === 'function') onGo(s.id); }}>
                <span aria-hidden="true" className="jy-num">{visitedMark ? '✓' : s.id}</span>
                <span className="jy-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
