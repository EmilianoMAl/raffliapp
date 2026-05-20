/**
 * Wager Engine — Universal "Round Wager" layer.
 *
 * Computes settlement from final placements, independent of game mode.
 * All amounts in dollars, rounded to 2 decimals.
 */

export type WagerType = "WINNER_TAKES_ALL" | "TOP_2_SPLIT";

export interface WagerConfig {
  wagerEnabled: boolean;
  wagerBuyIn: number;
  wagerType: WagerType;
  wagerCurrency: string; // "USD"
}

export interface WagerSettlementLine {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amount: number; // positive, dollars
}

export interface WagerPayouts {
  [playerId: string]: number; // + means receives, - means owes
}

export interface WagerResult {
  potTotal: number;
  payouts: WagerPayouts;
  settlementLines: WagerSettlementLine[];
  winnerPlayerIds: string[];
  status: "settled" | "not_finalized";
  /** Team-format fields (scramble 2v2, best_ball 2v2, etc.) */
  isTeamFormat?: boolean;
  winningTeamName?: string;
  losingTeamName?: string;
  teamSettlementAmount?: number; // total amount losing team owes winning team
  teamPayouts?: { playerId: string; playerName: string; net: number }[];
}

/**
 * Determine the round wager outcome for any game mode.
 * Returns the player IDs who won the round.
 */
export interface RoundOutcome {
  winnerPlayerIds: string[]; // empty = round not finalized
  ranking?: { playerId: string; place: number }[];
}

export function getRoundWagerOutcome(
  mode: string,
  players: { player_id: string; profiles: { display_name: string } }[],
  scores: { player_id: string; hole_number: number; strokes: number }[],
  totalHoles: number,
  matchPlayWinnerId?: string | null,
  modeWinnerId?: string | null,
): RoundOutcome {
  if (players.length < 2) return { winnerPlayerIds: [] };

  // For match play: use the explicit match play winner
  if (mode === "match_play" && matchPlayWinnerId) {
    return { winnerPlayerIds: [matchPlayWinnerId] };
  }

  // For skins/wolf/lock_5 etc: use mode-specific winner if provided
  if (modeWinnerId) {
    return { winnerPlayerIds: [modeWinnerId] };
  }

  // Default: stroke play — lowest total strokes wins
  const standings = players
    .map(p => {
      const total = scores
        .filter(s => s.player_id === p.player_id && s.strokes > 0)
        .reduce((sum, s) => sum + s.strokes, 0);
      return { playerId: p.player_id, total };
    })
    .filter(p => p.total > 0)
    .sort((a, b) => a.total - b.total);

  if (standings.length === 0) return { winnerPlayerIds: [] };

  // Check if all players have scored at least totalHoles holes
  const allComplete = players.every(p => {
    const scored = scores.filter(s => s.player_id === p.player_id && s.strokes > 0);
    return scored.length >= totalHoles;
  });
  if (!allComplete) return { winnerPlayerIds: [] };

  const lowestScore = standings[0].total;
  const winners = standings.filter(s => s.total === lowestScore);

  return {
    winnerPlayerIds: winners.map(w => w.playerId),
    ranking: standings.map((s, i) => ({ playerId: s.playerId, place: i + 1 })),
  };
}

/**
 * Compute wager settlement given player IDs, buy-in, type, and winners.
 */
export function computeWagerSettlement(
  playerIds: string[],
  getName: (id: string) => string,
  wagerBuyIn: number,
  wagerType: WagerType,
  winnerPlayerIds: string[],
): WagerResult {
  const numPlayers = playerIds.length;
  const potTotal = round2(numPlayers * wagerBuyIn);

  if (winnerPlayerIds.length === 0) {
    const payouts: WagerPayouts = {};
    playerIds.forEach(id => { payouts[id] = 0; });
    return { potTotal, payouts, settlementLines: [], winnerPlayerIds: [], status: "not_finalized" };
  }

  const payouts: WagerPayouts = {};
  playerIds.forEach(id => { payouts[id] = 0; });
  const lines: WagerSettlementLine[] = [];

  if (wagerType === "WINNER_TAKES_ALL") {
    const numWinners = winnerPlayerIds.length;
    const losers = playerIds.filter(id => !winnerPlayerIds.includes(id));

    if (numWinners === numPlayers) {
      // Everyone tied — no money moves
      return { potTotal, payouts, settlementLines: [], winnerPlayerIds, status: "settled" };
    }

    if (numWinners === 1) {
      // Single winner
      const winnerId = winnerPlayerIds[0];
      losers.forEach(loserId => {
        lines.push({
          fromPlayerId: loserId,
          fromPlayerName: getName(loserId),
          toPlayerId: winnerId,
          toPlayerName: getName(winnerId),
          amount: round2(wagerBuyIn),
        });
        payouts[loserId] -= wagerBuyIn;
      });
      payouts[winnerId] += round2(losers.length * wagerBuyIn);
    } else {
      // Multiple winners — split pot equally
      const splitAmount = round2(potTotal / numWinners);
      // Each non-winner owes wagerBuyIn split across winners
      losers.forEach(loserId => {
        const perWinner = round2(wagerBuyIn / numWinners);
        let remainder = round2(wagerBuyIn - perWinner * numWinners);
        winnerPlayerIds.forEach((winnerId, wi) => {
          let amt = perWinner;
          if (wi === 0) amt = round2(amt + remainder); // first winner gets remainder
          if (amt > 0) {
            lines.push({
              fromPlayerId: loserId,
              fromPlayerName: getName(loserId),
              toPlayerId: winnerId,
              toPlayerName: getName(winnerId),
              amount: amt,
            });
          }
        });
        payouts[loserId] -= wagerBuyIn;
      });
      // Each winner receives splitAmount - buyIn (net)
      winnerPlayerIds.forEach(winnerId => {
        payouts[winnerId] = round2(splitAmount - wagerBuyIn);
      });
    }
  }

  // Fix rounding: ensure payouts sum to 0
  const totalPayouts = Object.values(payouts).reduce((s, v) => s + v, 0);
  if (Math.abs(totalPayouts) > 0.001) {
    // Adjust first winner
    const adj = winnerPlayerIds[0] || playerIds[0];
    payouts[adj] = round2(payouts[adj] - totalPayouts);
  }

  return { potTotal, payouts, settlementLines: lines, winnerPlayerIds, status: "settled" };
}

/**
 * Compute team-aware wager settlement for 2v2 team formats (scramble, best ball).
 * Settles at team level first, then splits equally per player.
 */
export interface TeamDef {
  playerIds: [string, string];
  teamName: string;
}

export function computeTeamWagerSettlement(
  team1: TeamDef,
  team2: TeamDef,
  getName: (id: string) => string,
  wagerBuyIn: number,
  winningTeamIndex: 0 | 1 | null, // null = tie
): WagerResult {
  const allPlayerIds = [...team1.playerIds, ...team2.playerIds];
  const potTotal = round2(allPlayerIds.length * wagerBuyIn);
  const teamPot = round2(2 * wagerBuyIn); // each team contributes 2 * buyIn

  const payouts: WagerPayouts = {};
  allPlayerIds.forEach(id => { payouts[id] = 0; });

  // Tie: no money moves
  if (winningTeamIndex === null) {
    return {
      potTotal,
      payouts,
      settlementLines: [],
      winnerPlayerIds: [],
      status: "settled",
      isTeamFormat: true,
      winningTeamName: undefined,
      losingTeamName: undefined,
      teamSettlementAmount: 0,
      teamPayouts: allPlayerIds.map(id => ({ playerId: id, playerName: getName(id), net: 0 })),
    };
  }

  const winTeam = winningTeamIndex === 0 ? team1 : team2;
  const loseTeam = winningTeamIndex === 0 ? team2 : team1;

  // Each losing player pays buyIn, each winning player receives buyIn
  winTeam.playerIds.forEach(id => { payouts[id] = round2(wagerBuyIn); });
  loseTeam.playerIds.forEach(id => { payouts[id] = round2(-wagerBuyIn); });

  // Settlement lines: each loser pays each winner their share
  const lines: WagerSettlementLine[] = [];
  loseTeam.playerIds.forEach(loserId => {
    // Each loser's buyIn split equally to two winners
    const perWinner = round2(wagerBuyIn / 2);
    let remainder = round2(wagerBuyIn - perWinner * 2);
    winTeam.playerIds.forEach((winnerId, wi) => {
      let amt = perWinner;
      if (wi === 0) amt = round2(amt + remainder);
      if (amt > 0) {
        lines.push({
          fromPlayerId: loserId,
          fromPlayerName: getName(loserId),
          toPlayerId: winnerId,
          toPlayerName: getName(winnerId),
          amount: amt,
        });
      }
    });
  });

  const teamPayouts = [
    ...winTeam.playerIds.map(id => ({ playerId: id, playerName: getName(id), net: round2(wagerBuyIn) })),
    ...loseTeam.playerIds.map(id => ({ playerId: id, playerName: getName(id), net: round2(-wagerBuyIn) })),
  ];

  return {
    potTotal,
    payouts,
    settlementLines: lines,
    winnerPlayerIds: winTeam.playerIds.slice(),
    status: "settled",
    isTeamFormat: true,
    winningTeamName: winTeam.teamName,
    losingTeamName: loseTeam.teamName,
    teamSettlementAmount: teamPot,
    teamPayouts,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Extract WagerConfig from game.stroke_allocations (or wherever it's stored).
 */
export function getWagerConfig(strokeAllocations: any): WagerConfig | null {
  if (!strokeAllocations || typeof strokeAllocations !== "object") return null;
  if (!strokeAllocations.wagerEnabled) return null;
  return {
    wagerEnabled: true,
    wagerBuyIn: strokeAllocations.wagerBuyIn || 0,
    wagerType: strokeAllocations.wagerType || "WINNER_TAKES_ALL",
    wagerCurrency: strokeAllocations.wagerCurrency || "USD",
  };
}
