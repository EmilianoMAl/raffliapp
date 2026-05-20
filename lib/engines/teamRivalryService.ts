import { supabase } from "@/lib/supabase";
import type { Score } from "@/hooks/game/useGameState";

interface TeamDef {
  playerIds: [string, string];
  playerNames: [string, string];
}

interface UpsertTeamRivalryOptions {
  preResolvedWinnerTeamIndex?: 0 | 1 | null;
  scoreSummaryOverride?: string;
  teamSettlementAmount?: number;
}

/**
 * Persist a team rivalry record after a 2v2 game ends.
 * Non-critical: errors are swallowed so they never block the end-game flow.
 */
export async function upsertTeamRivalryForMatch(
  gameId: string,
  team1: TeamDef,
  team2: TeamDef,
  scores: Score[],
  completedAt: string,
  opts?: UpsertTeamRivalryOptions,
): Promise<void> {
  try {
    const { preResolvedWinnerTeamIndex, scoreSummaryOverride, teamSettlementAmount } = opts ?? {};

    // Canonical sort for team pair key
    const t1Key = [...team1.playerIds].sort().join(":");
    const t2Key = [...team2.playerIds].sort().join(":");
    const pairKey = t1Key < t2Key ? `${t1Key}|${t2Key}` : `${t2Key}|${t1Key}`;

    const { data: existing } = await supabase
      .from("team_rivalries")
      .select("*")
      .eq("pair_key", pairKey)
      .maybeSingle();

    const prevWins1 = (existing as any)?.team1_wins ?? 0;
    const prevWins2 = (existing as any)?.team2_wins ?? 0;
    const prevRounds = (existing as any)?.total_rounds ?? 0;

    const team1Won = preResolvedWinnerTeamIndex === 0 ? 1 : 0;
    const team2Won = preResolvedWinnerTeamIndex === 1 ? 1 : 0;

    const record = {
      pair_key: pairKey,
      team1_player_ids: team1.playerIds,
      team2_player_ids: team2.playerIds,
      team1_wins: prevWins1 + team1Won,
      team2_wins: prevWins2 + team2Won,
      total_rounds: prevRounds + 1,
      last_played_at: completedAt,
      ...(scoreSummaryOverride ? { last_score_summary: scoreSummaryOverride } : {}),
      ...(teamSettlementAmount ? { last_settlement_amount: teamSettlementAmount } : {}),
    };

    if (existing) {
      await supabase.from("team_rivalries").update(record).eq("pair_key", pairKey);
    } else {
      await supabase.from("team_rivalries").insert(record);
    }
  } catch (err) {
    console.warn("upsertTeamRivalryForMatch failed (non-critical):", err);
  }
}
