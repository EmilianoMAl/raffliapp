/**
 * Handicap utilities for Match Play net scoring.
 * Pure functions — no side effects, no DB calls.
 */

export interface HandicapConfig {
  useHandicaps: boolean;
  handicapIndexByPlayerId: Record<string, number>;
  strokesReceivedByPlayerId: Record<string, number>;
  strokeAllocationsByPlayerId: Record<string, Record<number, number>>;
}

/**
 * Compute strokes received for a player given their handicap index.
 * Simplified: just round the index (no slope rating in MVP).
 */
export function computeStrokesReceived(handicapIndex: number): number {
  return Math.max(0, Math.round(handicapIndex));
}

/**
 * Distribute `totalStrokes` across holes using hole difficulty ranking.
 * 
 * @param totalStrokes Number of strokes to allocate (integer >= 0)
 * @param totalHoles Number of holes in the round
 * @param handicapValues Optional array of hole handicap/difficulty rankings (1 = hardest).
 *                       If not provided, defaults to distributing by hole number.
 * @returns Record<holeNumber, strokesOnThatHole> where strokesOnThatHole is 0, 1, or 2+
 */
export function distributeStrokesToHoles(
  totalStrokes: number,
  totalHoles: number,
  handicapValues?: number[] | null
): Record<number, number> {
  const allocations: Record<number, number> = {};
  if (totalStrokes <= 0) return allocations;

  // Build ranked list of holes by difficulty (lower handicap value = harder)
  const holeOrder: number[] = [];
  if (handicapValues && handicapValues.length >= totalHoles) {
    // Sort holes by handicap value ascending (1 = hardest gets strokes first)
    const indexed = Array.from({ length: totalHoles }, (_, i) => ({
      hole: i + 1,
      hcpValue: handicapValues[i] || (i + 1),
    }));
    indexed.sort((a, b) => a.hcpValue - b.hcpValue);
    holeOrder.push(...indexed.map(h => h.hole));
  } else {
    // No handicap data — just go 1, 2, 3...
    for (let i = 1; i <= totalHoles; i++) holeOrder.push(i);
  }

  // Distribute strokes round-robin through the ranked holes
  let remaining = totalStrokes;
  let pass = 0;
  while (remaining > 0 && pass < 10) {
    for (const hole of holeOrder) {
      if (remaining <= 0) break;
      allocations[hole] = (allocations[hole] || 0) + 1;
      remaining--;
    }
    pass++;
  }

  return allocations;
}

/**
 * Build a full HandicapConfig for match play given player handicap indexes.
 * 
 * For match play, strokes are relative: the lower-handicap player plays at scratch
 * and the higher-handicap player receives the difference.
 */
export function buildMatchPlayHandicapConfig(
  handicapIndexByPlayerId: Record<string, number>,
  totalHoles: number,
  handicapValues?: number[] | null
): HandicapConfig {
  const playerIds = Object.keys(handicapIndexByPlayerId);
  
  // Compute raw strokes received for each player
  const rawStrokes: Record<string, number> = {};
  playerIds.forEach(id => {
    rawStrokes[id] = computeStrokesReceived(handicapIndexByPlayerId[id]);
  });

  // Make strokes relative (lowest plays at 0)
  const minStrokes = Math.min(...Object.values(rawStrokes));
  const strokesReceivedByPlayerId: Record<string, number> = {};
  playerIds.forEach(id => {
    strokesReceivedByPlayerId[id] = rawStrokes[id] - minStrokes;
  });

  // Distribute strokes to holes for each player
  const strokeAllocationsByPlayerId: Record<string, Record<number, number>> = {};
  playerIds.forEach(id => {
    strokeAllocationsByPlayerId[id] = distributeStrokesToHoles(
      strokesReceivedByPlayerId[id],
      totalHoles,
      handicapValues
    );
  });

  return {
    useHandicaps: true,
    handicapIndexByPlayerId,
    strokesReceivedByPlayerId,
    strokeAllocationsByPlayerId,
  };
}

/**
 * Get net score for a player on a specific hole.
 * Returns gross score if no allocation exists.
 */
export function getNetScoreForHole(
  grossScore: number,
  playerId: string,
  holeNumber: number,
  config: HandicapConfig | null
): number {
  if (!config || !config.useHandicaps || grossScore <= 0) return grossScore;
  const strokes = config.strokeAllocationsByPlayerId?.[playerId]?.[holeNumber] || 0;
  return Math.max(1, grossScore - strokes);
}

/**
 * Check if a player receives a stroke on a given hole.
 */
export function playerReceivesStroke(
  playerId: string,
  holeNumber: number,
  config: HandicapConfig | null
): boolean {
  if (!config || !config.useHandicaps) return false;
  return (config.strokeAllocationsByPlayerId?.[playerId]?.[holeNumber] || 0) > 0;
}
