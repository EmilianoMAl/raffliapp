import { supabase } from "@/lib/supabase";
import type { GamePlayer, Score } from "@/hooks/game/useGameState";
import type { BetSettlement } from "@/lib/engines/scoringEngine";

/**
 * Upsert head-to-head rivalry records after a game ends.
 * Non-critical: errors are swallowed so they never block the end-game flow.
 */
export async function updateRivalriesForGame(
  gameId: string,
  players: GamePlayer[],
  scores: Score[],
  mode: string,
  settlements: BetSettlement[],
  skinsNet?: Record<string, number>,
): Promise<void> {
  try {
    if (players.length < 2) return;

    // Determine stroke-play winner
    const totals = players.map(p => ({
      id: p.player_id,
      total: scores
        .filter(s => s.player_id === p.player_id && s.strokes > 0)
        .reduce((sum, s) => sum + s.strokes, 0),
    })).filter(p => p.total > 0);

    if (totals.length === 0) return;

    totals.sort((a, b) => a.total - b.total);
    const winnerId = totals[0].total < totals[1]?.total ? totals[0].id : null;

    // Update rivalry for each unique pair
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1Id = players[i].player_id;
        const p2Id = players[j].player_id;

        // Canonical order: smaller UUID first
        const [canonP1, canonP2] = p1Id < p2Id ? [p1Id, p2Id] : [p2Id, p1Id];

        const { data: existing } = await supabase
          .from("rivalries")
          .select("*")
          .eq("player1_id", canonP1)
          .eq("player2_id", canonP2)
          .maybeSingle();

        const p1Wins = (existing as any)?.player1_wins ?? 0;
        const p2Wins = (existing as any)?.player2_wins ?? 0;
        const totalRounds = (existing as any)?.total_rounds ?? 0;

        const p1Won = winnerId === canonP1 ? 1 : 0;
        const p2Won = winnerId === canonP2 ? 1 : 0;

        if (existing) {
          await supabase
            .from("rivalries")
            .update({
              player1_wins: p1Wins + p1Won,
              player2_wins: p2Wins + p2Won,
              total_rounds: totalRounds + 1,
            })
            .eq("player1_id", canonP1)
            .eq("player2_id", canonP2);
        } else {
          await supabase.from("rivalries").insert({
            player1_id: canonP1,
            player2_id: canonP2,
            player1_wins: p1Won,
            player2_wins: p2Won,
            total_rounds: 1,
          });
        }
      }
    }
  } catch (err) {
    console.warn("updateRivalriesForGame failed (non-critical):", err);
  }
}
