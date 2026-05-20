export interface SkinsPayoutEvent {
  holeNumber: number;
  winnerId: string;
  skinsWon: number; // 1 normally, more if carried over ties
}

export interface SkinsState {
  playerTotals: Record<string, number>; // playerId → skins won
  payoutEvents: SkinsPayoutEvent[];
}

/**
 * Compute skins results from raw scores.
 * If splitTies is false (default), tied holes carry their skin to the next hole.
 */
export function recomputeSkins(
  scores: { player_id: string; hole_number: number; strokes: number }[],
  playerIds: string[],
  totalHoles: number,
  splitTies = false,
): SkinsState {
  const playerTotals: Record<string, number> = {};
  playerIds.forEach(id => { playerTotals[id] = 0; });

  const payoutEvents: SkinsPayoutEvent[] = [];
  let carryover = 0;

  for (let hole = 1; hole <= totalHoles; hole++) {
    const holeScores = scores.filter(
      s => s.hole_number === hole && s.strokes > 0,
    );

    if (holeScores.length === 0) continue;

    const minStrokes = Math.min(...holeScores.map(s => s.strokes));
    const winners = holeScores.filter(s => s.strokes === minStrokes);

    if (winners.length === 1) {
      const winnerId = winners[0].player_id;
      const skinsWon = 1 + carryover;
      playerTotals[winnerId] = (playerTotals[winnerId] ?? 0) + skinsWon;
      payoutEvents.push({ holeNumber: hole, winnerId, skinsWon });
      carryover = 0;
    } else if (splitTies && winners.length > 1) {
      // Split: each tied winner gets a fraction (represented as decimal)
      const split = (1 + carryover) / winners.length;
      winners.forEach(w => {
        playerTotals[w.player_id] = (playerTotals[w.player_id] ?? 0) + split;
        payoutEvents.push({ holeNumber: hole, winnerId: w.player_id, skinsWon: split });
      });
      carryover = 0;
    } else {
      // Tie: carry skin to next hole
      carryover++;
    }
  }

  return { playerTotals, payoutEvents };
}

/**
 * Convert skins payout events into net dollar amounts per player.
 * Returns a map of playerId → net (positive = wins money, negative = owes).
 */
export function computeSkinsSettlement(
  payoutEvents: SkinsPayoutEvent[],
  playerIds: string[],
  betPerHole: number,
): Record<string, number> {
  const totalSkinsPlayed = payoutEvents.reduce((sum, e) => sum + e.skinsWon, 0);
  const pot = totalSkinsPlayed * betPerHole * playerIds.length;

  const winnings: Record<string, number> = {};
  playerIds.forEach(id => { winnings[id] = 0; });

  payoutEvents.forEach(e => {
    winnings[e.winnerId] = (winnings[e.winnerId] ?? 0) + e.skinsWon * betPerHole * playerIds.length;
  });

  // Normalize to net (winners receive net of their buy-in, losers pay)
  const buyIn = totalSkinsPlayed * betPerHole;
  const net: Record<string, number> = {};
  playerIds.forEach(id => {
    net[id] = round2((winnings[id] ?? 0) - buyIn);
  });

  return net;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
