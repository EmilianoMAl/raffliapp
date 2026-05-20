import { supabase } from "@/lib/supabase";
import type { Game, GamePlayer, Score } from "@/hooks/game/useGameState";
import { recomputeSkins } from "@/lib/engines/skinsEngine";
import { computeTeamTotal, computeTeamTotals, resolveScrambleWinner, type ScrambleHoleScore } from "@/lib/engines/scrambleEngine";

export interface ModeResult {
  mode: string;
  label: string;
  winnerId: string | null;
  winnerName: string;
  detail: string;
  emoji: string;
}

export interface BetSettlement {
  fromPlayer: string;
  toPlayer: string;
  amount: number;
  reason: string;
}

export interface EndGameResults {
  strokePlayWinner: { playerId: string; name: string; total: number; vsPar: string } | null;
  modeResults: ModeResult[];
  settlements: BetSettlement[];
}

export async function computeEndGameResults(
  game: Game,
  players: GamePlayer[],
  scores: Score[]
): Promise<EndGameResults> {
  const parValues = game.par_values || [];
  const results: ModeResult[] = [];
  const settlements: BetSettlement[] = [];

  const getPlayerName = (id: string) =>
    players.find(p => p.player_id === id)?.profiles.display_name || "Unknown";

  const getTotal = (playerId: string) =>
    scores.filter(s => s.player_id === playerId && s.strokes > 0).reduce((sum, s) => sum + s.strokes, 0);

  // Stroke Play winner (always computed)
  const standings = players
    .map(p => ({ id: p.player_id, name: p.profiles.display_name, total: getTotal(p.player_id) }))
    .filter(p => p.total > 0)
    .sort((a, b) => a.total - b.total);

  const totalPar = parValues.reduce((s, p) => s + (p || 0), 0);
  const strokePlayWinner = standings[0]
    ? {
        playerId: standings[0].id,
        name: standings[0].name,
        total: standings[0].total,
        vsPar: totalPar > 0
          ? (standings[0].total - totalPar === 0 ? "E" : standings[0].total - totalPar > 0 ? `+${standings[0].total - totalPar}` : `${standings[0].total - totalPar}`)
          : "",
      }
    : null;

  results.push({
    mode: "standard",
    label: "Stroke Play",
    winnerId: strokePlayWinner?.playerId || null,
    winnerName: strokePlayWinner?.name || "–",
    detail: strokePlayWinner ? `${strokePlayWinner.total} (${strokePlayWinner.vsPar})` : "–",
    emoji: "🏆",
  });

  // Match Play
  if (game.mode === "match_play") {
    const { data: matchResults } = await supabase
      .from("match_play_results")
      .select("*")
      .eq("game_id", game.id);

    if (matchResults && matchResults.length > 0) {
      const holeCounts: Record<string, number> = {};
      let tiedHoles = 0;
      matchResults.forEach(r => {
        if (r.winner_id && !r.is_tied) {
          holeCounts[r.winner_id] = (holeCounts[r.winner_id] || 0) + 1;
        } else if (r.is_tied) {
          tiedHoles++;
        }
      });
      const sorted = Object.entries(holeCounts).sort(([, a], [, b]) => b - a);

      if (sorted.length >= 1) {
        // For 2-player: winner is whoever has more holes won (they're "up")
        const topWins = sorted[0][1];
        const secondWins = sorted.length >= 2 ? sorted[1][1] : 0;
        const diff = topWins - secondWins;
        const holesRemaining = game.holes - matchResults.length;

        // Winner is the player who is "up" — if diff > holesRemaining, match is clinched
        if (diff > 0) {
          results.push({
            mode: "match_play",
            label: "Match Play",
            winnerId: sorted[0][0],
            winnerName: getPlayerName(sorted[0][0]),
            detail: holesRemaining === 0 ? `${diff} UP` : `${diff} & ${holesRemaining}`,
            emoji: "🎯",
          });
        } else if (diff === 0) {
          // All square — no winner
          results.push({
            mode: "match_play",
            label: "Match Play",
            winnerId: null,
            winnerName: "Tied",
            detail: "All Square",
            emoji: "🎯",
          });
        }
      }
    }
  }

  // Skins
  if (game.mode === "skins") {
    const playerIds = players.map(p => p.player_id);
    const sk = recomputeSkins(scores, playerIds, game.holes);
    const sorted = Object.entries(sk.playerTotals).sort(([, a], [, b]) => b - a);
    if (sorted.length > 0 && sorted[0][1] > 0) {
      results.push({
        mode: "skins",
        label: "Skins",
        winnerId: sorted[0][0],
        winnerName: getPlayerName(sorted[0][0]),
        detail: `${sorted[0][1]} skins`,
        emoji: "💰",
      });
    }
  }

  // Wolf
  if (game.mode === "wolf") {
    const { data: wolfData } = await supabase
      .from("wolf_teams")
      .select("*")
      .eq("game_id", game.id);

    if (wolfData) {
      const points: Record<string, number> = {};
      players.forEach(p => (points[p.player_id] = 0));

      wolfData.forEach(team => {
        if (team.team_score === null || team.opponent_score === null) return;
        const wolfWins = team.team_score < team.opponent_score;
        const tied = team.team_score === team.opponent_score;
        if (tied) return; // No points on tie
        
        if (team.went_lone_wolf) {
          if (wolfWins) {
            points[team.wolf_player_id] = (points[team.wolf_player_id] || 0) + 3;
            players.forEach(p => {
              if (p.player_id !== team.wolf_player_id) {
                points[p.player_id] = (points[p.player_id] || 0) - 1;
              }
            });
          } else {
            points[team.wolf_player_id] = (points[team.wolf_player_id] || 0) - 3;
            players.forEach(p => {
              if (p.player_id !== team.wolf_player_id) {
                points[p.player_id] = (points[p.player_id] || 0) + 1;
              }
            });
          }
        } else {
          // Partnered
          if (wolfWins) {
            points[team.wolf_player_id] = (points[team.wolf_player_id] || 0) + 1;
            if (team.partner_id) points[team.partner_id] = (points[team.partner_id] || 0) + 1;
            players.forEach(p => {
              if (p.player_id !== team.wolf_player_id && p.player_id !== team.partner_id) {
                points[p.player_id] = (points[p.player_id] || 0) - 1;
              }
            });
          } else {
            points[team.wolf_player_id] = (points[team.wolf_player_id] || 0) - 1;
            if (team.partner_id) points[team.partner_id] = (points[team.partner_id] || 0) - 1;
            players.forEach(p => {
              if (p.player_id !== team.wolf_player_id && p.player_id !== team.partner_id) {
                points[p.player_id] = (points[p.player_id] || 0) + 1;
              }
            });
          }
        }
      });

      const sorted = Object.entries(points).sort(([, a], [, b]) => b - a);
      if (sorted.length > 0) {
        results.push({
          mode: "wolf",
          label: "Wolf",
          winnerId: sorted[0][0],
          winnerName: getPlayerName(sorted[0][0]),
          detail: `${sorted[0][1]} points`,
          emoji: "🐺",
        });
      }
    }
  }


  // Lock 5
  if (game.mode === "lock_5") {
    const { data: lockData } = await supabase
      .from("lock_decisions")
      .select("*")
      .eq("game_id", game.id);

    if (lockData) {
      const getLockedTotal = (playerId: string) => {
        const lockedHoles = lockData
          .filter((d: any) => d.player_id === playerId && d.is_locked)
          .map((d: any) => d.hole_number);
        return scores
          .filter(s => s.player_id === playerId && lockedHoles.includes(s.hole_number))
          .reduce((sum, s) => sum + s.strokes, 0);
      };

      const lock5Standings = players
        .map(p => ({ id: p.player_id, name: p.profiles.display_name, total: getLockedTotal(p.player_id) }))
        .filter(p => p.total > 0)
        .sort((a, b) => a.total - b.total);

      if (lock5Standings.length > 0) {
        results.push({
          mode: "lock_5",
          label: "Lock 5",
          winnerId: lock5Standings[0].id,
          winnerName: lock5Standings[0].name,
          detail: `${lock5Standings[0].total} locked strokes`,
          emoji: "🔒",
        });
      }
    }
  }


  if (game.mode === "betting") {
    const { data: betsData } = await supabase
      .from("hole_bets")
      .select("*")
      .eq("game_id", game.id);

    if (betsData) {
      const winnings: Record<string, number> = {};
      players.forEach(p => (winnings[p.player_id] = 0));
      const totalBetPerPlayer = betsData.reduce((s, b) => s + b.bet_amount, 0);
      const perPlayer = totalBetPerPlayer / Math.max(players.length, 1);

      betsData.forEach(bet => {
        const holeScores = scores.filter(s => s.hole_number === bet.hole_number && s.strokes > 0);
        if (holeScores.length === 0) return;
        const lowest = Math.min(...holeScores.map(s => s.strokes));
        const winners = holeScores.filter(s => s.strokes === lowest);
        if (winners.length === 1) {
          winnings[winners[0].player_id] += bet.bet_amount;
        }
      });

      // Settlement: each player owes the difference
      const sortedWinners = Object.entries(winnings).sort(([, a], [, b]) => b - a);
      if (sortedWinners.length >= 2 && sortedWinners[0][1] > 0) {
        results.push({
          mode: "betting",
          label: "Betting",
          winnerId: sortedWinners[0][0],
          winnerName: getPlayerName(sortedWinners[0][0]),
          detail: `$${sortedWinners[0][1]} won`,
          emoji: "💵",
        });

        // Compute settlements
        const net: Record<string, number> = {};
        players.forEach(p => {
          net[p.player_id] = (winnings[p.player_id] || 0) - perPlayer;
        });

        const debtors = Object.entries(net).filter(([, v]) => v < 0).sort(([, a], [, b]) => a - b);
        const creditors = Object.entries(net).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);

        let di = 0, ci = 0;
        while (di < debtors.length && ci < creditors.length) {
          const amount = Math.min(-debtors[di][1], creditors[ci][1]);
          if (amount > 0.5) {
            settlements.push({
              fromPlayer: getPlayerName(debtors[di][0]),
              toPlayer: getPlayerName(creditors[ci][0]),
              amount: Math.round(amount),
              reason: "Betting",
            });
          }
          debtors[di][1] += amount;
          creditors[ci][1] -= amount;
          if (Math.abs(debtors[di][1]) < 0.01) di++;
          if (Math.abs(creditors[ci][1]) < 0.01) ci++;
        }
      }
    }
  }

  // Scramble
  if (game.mode === "scramble") {
    const { data: teamsData } = await supabase
      .from("scramble_teams")
      .select("id, team_name")
      .eq("game_id", game.id);

    if (teamsData && teamsData.length >= 1) {
      const { data: scrambleScores } = await supabase
        .from("scramble_hole_scores")
        .select("*")
        .eq("game_id", game.id);

      const holeScores = (scrambleScores || []) as unknown as ScrambleHoleScore[];

      if (teamsData.length === 1) {
        // 2P co-op — just show team total, no winner
        const total = computeTeamTotal(holeScores, teamsData[0].id);
        results.push({
          mode: "scramble",
          label: "Scramble (Co-op)",
          winnerId: null,
          winnerName: teamsData[0].team_name,
          detail: `${total} total`,
          emoji: "🤝",
        });
      } else if (teamsData.length === 2) {
        // 4P 2v2
        const totals = computeTeamTotals(holeScores, teamsData);
        const t1Total = totals[0].total;
        const t2Total = totals[1].total;
        const winnerId = resolveScrambleWinner(totals);

        // Load members to find a representative player ID for winnerId
        const { data: membersData } = await supabase
          .from("scramble_team_members")
          .select("team_id, player_id")
          .in("team_id", teamsData.map(t => t.id));

        const winnerTeam = teamsData.find(t => t.id === winnerId);
        const winnerMembers = (membersData || []).filter(m => m.team_id === winnerId);

        results.push({
          mode: "scramble",
          label: "Scramble (2v2)",
          winnerId: winnerMembers[0]?.player_id || null,
          winnerName: winnerId ? (winnerTeam?.team_name || "Winner") : "Tied",
          detail: winnerId
            ? `${winnerId === teamsData[0].id ? t1Total : t2Total} vs ${winnerId === teamsData[0].id ? t2Total : t1Total}`
            : `${t1Total} - ${t2Total}`,
          emoji: "🤝",
        });
      }
    }
  }

  return { strokePlayWinner, modeResults: results, settlements };
}
