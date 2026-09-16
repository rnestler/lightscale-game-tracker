import type { Queryable } from './db.js';

export function computeEloDelta(
  _client: Queryable,
  __budget: (count?: number) => void,
  p1Rating: number,
  p2Rating: number,
  outcome: string
): number {
  const ratingDiff = p1Rating - p2Rating;
  let expected = 500 + Math.trunc((ratingDiff * 5) / 4);
  if (expected > 900) {
    expected = 900;
  } else {
    if (expected < 100) {
      expected = 100;
    }
  }
  let actual = 500;
  if (outcome === 'playerOneWin') {
    actual = 1000;
  } else {
    if (outcome === 'playerTwoWin') {
      actual = 0;
    }
  }
  return Math.trunc((32 * (actual - expected)) / 1000);
}
