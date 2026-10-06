// Salary Prep never assumes the candidate's level: a row is marked "You" only when the candidate chose a level.

export const LEVEL_ROWS = ['Junior', 'Mid', 'Senior', 'Principal', 'VP / Head'];

// Onboarding levels -> row in LEVEL_ROWS. Intern has no row, so it is never marked.
const LEVEL_TO_ROW = { Junior: 0, Mid: 1, Senior: 2, 'Lead / Staff': 3, 'Director+': 4 };

export const userLevelIndex = (level) => (level && level in LEVEL_TO_ROW ? LEVEL_TO_ROW[level] : -1);

export const MARKET_CACHE_VERSION = 2;

// A cached market view is reusable only if it was made by this version for the same role, level and market.
export function isCacheCurrent(cache, { role, level, market }) {
  return !!cache && cache.v === MARKET_CACHE_VERSION
    && cache.forRole === role && cache.forLevel === level && cache.forMarket === market;
}
