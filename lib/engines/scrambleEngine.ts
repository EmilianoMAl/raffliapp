export interface ScrambleHoleScore {
  game_id: string;
  team_id: string;
  hole_number: number;
  strokes: number;
}

export interface TeamTotal {
  teamId: string;
  teamName: string;
  total: number;
}

export function computeTeamTotal(
  holeScores: ScrambleHoleScore[],
  teamId: string,
): number {
  return holeScores
    .filter(s => s.team_id === teamId && s.strokes > 0)
    .reduce((sum, s) => sum + s.strokes, 0);
}

export function computeTeamTotals(
  holeScores: ScrambleHoleScore[],
  teams: { id: string; team_name: string }[],
): TeamTotal[] {
  return teams.map(t => ({
    teamId: t.id,
    teamName: t.team_name,
    total: computeTeamTotal(holeScores, t.id),
  }));
}

/** Returns the winning team's id, or null on a tie. */
export function resolveScrambleWinner(totals: TeamTotal[]): string | null {
  if (totals.length < 2) return totals[0]?.teamId ?? null;
  const sorted = [...totals].sort((a, b) => a.total - b.total);
  if (sorted[0].total === 0) return null; // no scores yet
  if (sorted[0].total === sorted[1].total) return null; // tie
  return sorted[0].teamId;
}
