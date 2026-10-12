// Where a market value in the profile form can have come from. The app starts every user on Singapore and saves it with the profile, so the
// SAME stored value means two different things: a user who picked Singapore, and a user who never touched the field. A product default is the
// system's decision, a market preference is the user's intent: they must not be mixed up (docs/architecture/plans/DESIGN-market-preference.md).
//
// Until a user's choice is stored together with its source, the only thing that can be told from the value alone is this:
//   - empty                  -> 'none'
//   - anything but the default -> 'user_selected' (the app never sets it, so the user did)
//   - the default itself      -> 'default_or_unknown' (a choice or the default: not known)
export const PRODUCT_DEFAULT_MARKET = 'Singapore';

export function marketSource(value) {
  const market = typeof value === 'string' ? value.trim() : '';
  if (!market) return { source: 'none', market: '' };
  if (market.toLowerCase() === PRODUCT_DEFAULT_MARKET.toLowerCase()) return { source: 'default_or_unknown', market };
  return { source: 'user_selected', market };
}
