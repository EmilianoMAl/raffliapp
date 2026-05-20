/**
 * Wager Settlement Engine
 *
 * Converts per-player net results into a minimal set of transfers.
 * Works in integer cents to avoid floating-point drift, then
 * formats back to dollars for display.
 */

export interface WagerTransfer {
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  amount: number; // always positive, in dollars (2-decimal)
}

export interface WagerBreakdownItem {
  label: string; // e.g. "Betting", "Skins"
  netByPlayer: Record<string, number>; // playerId → net in dollars
}

export interface WagerSettlement {
  transfers: WagerTransfer[];
  breakdown: WagerBreakdownItem[];
  totalNetByPlayer: Record<string, number>;
}

/**
 * Minimise transfers using a greedy creditor/debtor algorithm.
 *
 * @param netByPlayer  playerId → net amount in dollars (positive = owed money, negative = owes money)
 * @param getName      lookup function: playerId → display name
 * @returns minimal list of WagerTransfer
 */
export function computeMinimalTransfers(
  netByPlayer: Record<string, number>,
  getName: (id: string) => string
): WagerTransfer[] {
  // Work in cents to avoid FP issues
  const cents: Record<string, number> = {};
  for (const [id, amt] of Object.entries(netByPlayer)) {
    cents[id] = Math.round(amt * 100);
  }

  // Normalise: ensure sum === 0 by adjusting the smallest absolute value
  const sum = Object.values(cents).reduce((s, v) => s + v, 0);
  if (sum !== 0) {
    let minAbsId = Object.keys(cents)[0];
    let minAbs = Math.abs(cents[minAbsId]);
    for (const [id, v] of Object.entries(cents)) {
      if (Math.abs(v) < minAbs) {
        minAbs = Math.abs(v);
        minAbsId = id;
      }
    }
    cents[minAbsId] -= sum;
  }

  // Split into creditors & debtors
  const creditors: { id: string; amt: number }[] = [];
  const debtors: { id: string; amt: number }[] = [];

  for (const [id, v] of Object.entries(cents)) {
    if (v > 0) creditors.push({ id, amt: v });
    else if (v < 0) debtors.push({ id, amt: -v }); // store as positive
  }

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers: WagerTransfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const payment = Math.min(creditors[ci].amt, debtors[di].amt);
    if (payment >= 1) {
      // >= $0.01
      transfers.push({
        fromPlayerId: debtors[di].id,
        fromPlayerName: getName(debtors[di].id),
        toPlayerId: creditors[ci].id,
        toPlayerName: getName(creditors[ci].id),
        amount: Math.round(payment) / 100, // back to dollars, 2 dec
      });
    }
    creditors[ci].amt -= payment;
    debtors[di].amt -= payment;
    if (creditors[ci].amt < 1) ci++;
    if (debtors[di].amt < 1) di++;
  }

  return transfers;
}

/**
 * Build a full WagerSettlement from the scoring engine's BetSettlement array
 * and any additional mode-specific breakdowns.
 */
export function buildWagerSettlement(
  settlements: { fromPlayer: string; toPlayer: string; amount: number; reason: string }[],
  players: { player_id: string; profiles: { display_name: string } }[]
): WagerSettlement {
  if (settlements.length === 0) {
    return { transfers: [], breakdown: [], totalNetByPlayer: {} };
  }

  const getName = (id: string) =>
    players.find(p => p.player_id === id)?.profiles.display_name || id;

  // Build per-reason breakdown & total net
  const totalNet: Record<string, number> = {};
  const reasonNets: Record<string, Record<string, number>> = {};

  players.forEach(p => {
    totalNet[p.player_id] = 0;
  });

  settlements.forEach(s => {
    // Map names back to IDs
    const fromId = players.find(p => p.profiles.display_name === s.fromPlayer)?.player_id || s.fromPlayer;
    const toId = players.find(p => p.profiles.display_name === s.toPlayer)?.player_id || s.toPlayer;

    if (!totalNet[fromId]) totalNet[fromId] = 0;
    if (!totalNet[toId]) totalNet[toId] = 0;

    totalNet[fromId] -= s.amount;
    totalNet[toId] += s.amount;

    if (!reasonNets[s.reason]) {
      reasonNets[s.reason] = {};
      players.forEach(p => {
        reasonNets[s.reason][p.player_id] = 0;
      });
    }
    if (!reasonNets[s.reason][fromId]) reasonNets[s.reason][fromId] = 0;
    if (!reasonNets[s.reason][toId]) reasonNets[s.reason][toId] = 0;
    reasonNets[s.reason][fromId] -= s.amount;
    reasonNets[s.reason][toId] += s.amount;
  });

  const transfers = computeMinimalTransfers(totalNet, getName);

  const breakdown: WagerBreakdownItem[] = Object.entries(reasonNets).map(([label, net]) => ({
    label,
    netByPlayer: net,
  }));

  return { transfers, breakdown, totalNetByPlayer: totalNet };
}
