import { supabase } from "@/lib/supabase";
import type { EndGameResults } from "@/lib/engines/scoringEngine";

/**
 * Persist win/loss stats to the profiles table after a game ends.
 * Non-critical: errors are swallowed so they never block the end-game flow.
 */
export async function applyWinStats(
  gameId: string,
  playerIds: string[],
  results: EndGameResults,
  completedAt: string,
): Promise<void> {
  try {
    const winnerId = results.strokePlayWinner?.playerId ?? null;
    if (!winnerId) return;

    for (const playerId of playerIds) {
      const isWinner = playerId === winnerId;

      const { data: profile } = await supabase
        .from("profiles")
        .select("total_wins, total_rounds")
        .eq("id", playerId)
        .single();

      const currentWins = (profile as any)?.total_wins ?? 0;
      const currentRounds = (profile as any)?.total_rounds ?? 0;

      await supabase
        .from("profiles")
        .update({
          total_wins: isWinner ? currentWins + 1 : currentWins,
          total_rounds: currentRounds + 1,
        })
        .eq("id", playerId);
    }
  } catch (err) {
    console.warn("applyWinStats failed (non-critical):", err);
  }
}
