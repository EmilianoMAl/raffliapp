import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { computeEndGameResults } from "@/lib/engines/scoringEngine";
import { applyWinStats } from "@/lib/applyWinStats";
import { updateRivalriesForGame } from "@/hooks/useRivalries";
import { upsertTeamRivalryForMatch } from "@/lib/engines/teamRivalryService";
import { getWagerConfig, getRoundWagerOutcome, computeWagerSettlement, computeTeamWagerSettlement } from "@/lib/engines/wagerEngine";
import { computeTeamTotal, computeTeamTotals, resolveScrambleWinner, type ScrambleHoleScore } from "@/lib/engines/scrambleEngine";
import { recomputeSkins, computeSkinsSettlement } from "@/lib/engines/skinsEngine";

export type GameMode = "standard" | "drinking" | "betting" | "skins" | "wolf" | "match_play" | "wheel_of_chaos" | "lock_5" | "scramble" | "best_ball" | "nassau" | "stableford" | "bingo_bango_bongo";
export type GameStatus = "waiting" | "active" | "completed";

export interface Game {
  id: string;
  join_code: string;
  host_id: string;
  holes: number;
  mode: GameMode;
  status: GameStatus;
  par_values?: number[];
  yardage_values?: number[] | null;
  handicap_values?: number[] | null;
  started_at?: string | null;
  completed_at?: string | null;
  course_name?: string | null;
  drinking_config?: Record<string, boolean> | any;
  starting_hole?: number;
  stroke_allocations?: any;
}

// Re-export HandicapConfig for convenience
export type { HandicapConfig } from "@/lib/engines/handicapUtils";

/**
 * Extract typed HandicapConfig from game.stroke_allocations.
 * Returns null if handicaps are not enabled.
 */
export function getHandicapConfig(game: Game): import("@/lib/engines/handicapUtils").HandicapConfig | null {
  const sa = game.stroke_allocations;
  if (!sa || typeof sa !== "object" || !("useHandicaps" in sa) || !sa.useHandicaps) return null;
  return sa as import("@/lib/engines/handicapUtils").HandicapConfig;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  };
}

export interface Score {
  id: string;
  game_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
}

export interface PlayerReaction {
  id: string;
  game_id: string;
  player_id: string;
  hole_number: number;
  reaction: string;
  created_at: string;
}

export interface HoleAchievement {
  id: string;
  game_id: string;
  player_id: string;
  hole_number: number;
  achievement_type: string;
}

const GAME_SESSION_KEY = "golfy_current_game";

export const useGameState = (user: User | null) => {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [reactions, setReactions] = useState<PlayerReaction[]>([]);
  const [achievements, setAchievements] = useState<HoleAchievement[]>([]);
  const [isRejoining, setIsRejoining] = useState(false);
  const [scoreLoadTimer, setScoreLoadTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Save game session to AsyncStorage whenever currentGame changes
  useEffect(() => {
    if (currentGame) {
      AsyncStorage.setItem(GAME_SESSION_KEY, JSON.stringify({
        gameId: currentGame.id,
        joinCode: currentGame.join_code,
      })).catch(() => {});
    }
  }, [currentGame]);

  // Try to rejoin saved game session on mount
  useEffect(() => {
    if (!user || currentGame || isRejoining) return;

    const attemptRejoin = async () => {
      const savedSession = await AsyncStorage.getItem(GAME_SESSION_KEY);
      if (!savedSession) return;

      setIsRejoining(true);
      try {
        const { gameId } = JSON.parse(savedSession);

        // Check if game still exists and is not completed
        const { data: game, error: gameError } = await supabase
          .from("games")
          .select("*")
          .eq("id", gameId)
          .single();

        if (gameError || !game || game.status === "completed") {
          // Game doesn't exist or is completed, clear saved session
          await AsyncStorage.removeItem(GAME_SESSION_KEY);
          setIsRejoining(false);
          return;
        }

        // Check if user is already a player in this game
        const { data: existingPlayer } = await supabase
          .from("game_players")
          .select("*")
          .eq("game_id", gameId)
          .eq("player_id", user.id)
          .single();

        if (existingPlayer) {
          // User is already in the game, just restore the state
          setCurrentGame(game as unknown as Game);
          await loadPlayers(game.id);
          await loadScores(game.id);
          await loadReactions(game.id);
          await loadAchievements(game.id);
          toast({ title: "Rejoined your game!" });
        } else {
          // User is not in the game anymore, clear saved session
          await AsyncStorage.removeItem(GAME_SESSION_KEY);
        }
      } catch (error) {
        console.error("Error rejoining game:", error);
        await AsyncStorage.removeItem(GAME_SESSION_KEY);
      } finally {
        setIsRejoining(false);
      }
    };

    attemptRejoin();
  }, [user]);

  // Subscribe to game updates
  useEffect(() => {
    if (!currentGame?.id) return;

    const channel = supabase
      .channel(`game-${currentGame.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${currentGame.id}`,
        },
        () => {
          loadPlayers(currentGame.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `game_id=eq.${currentGame.id}`,
        },
        () => {
          // Debounce score reloads to avoid redundant fetches after optimistic updates
          if (scoreLoadTimer) clearTimeout(scoreLoadTimer);
          const timer = setTimeout(() => loadScores(currentGame.id), 300);
          setScoreLoadTimer(timer);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_reactions",
          filter: `game_id=eq.${currentGame.id}`,
        },
        () => {
          loadReactions(currentGame.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hole_achievements",
          filter: `game_id=eq.${currentGame.id}`,
        },
        () => {
          loadAchievements(currentGame.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${currentGame.id}`,
        },
        (payload) => {
          setCurrentGame(payload.new as Game);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentGame?.id]);

  const loadPlayers = async (gameId: string) => {
    const { data, error } = await supabase
      .from("game_players")
      .select("*, profiles(display_name, avatar_url)")
      .eq("game_id", gameId);

    if (error) {
      console.error("Error loading players:", error);
      return;
    }

    setPlayers(data || []);
  };

  const loadScores = async (gameId: string) => {
    const { data, error } = await supabase
      .from("scores")
      .select("*")
      .eq("game_id", gameId);

    if (error) {
      console.error("Error loading scores:", error);
      return;
    }

    setScores(data || []);
  };

  const loadReactions = async (gameId: string) => {
    const { data, error } = await supabase
      .from("player_reactions")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading reactions:", error);
      return;
    }

    setReactions(data || []);
  };

  const loadAchievements = async (gameId: string) => {
    const { data, error } = await supabase
      .from("hole_achievements")
      .select("*")
      .eq("game_id", gameId);

    if (error) {
      console.error("Error loading achievements:", error);
      return;
    }

    setAchievements(data || []);
  };

  const refreshGame = async () => {
    if (!currentGame) return;
    const gameId = currentGame.id;
    const { data: game } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (game) setCurrentGame(game as unknown as Game);
    await Promise.all([
      loadPlayers(gameId),
      loadScores(gameId),
      loadReactions(gameId),
      loadAchievements(gameId),
    ]);
  };

  const createGame = async (holes: number, mode: GameMode, courseName?: string, invitedFriendIds?: string[], parValues?: number[], drinkingConfig?: Record<string, boolean>, yardageValues?: number[], handicapValues?: number[], startingHole?: number, strokeAllocations?: any) => {
    if (!user) return;

    const joinCode = await generateJoinCode();
    
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        join_code: joinCode,
        host_id: user.id,
        holes,
        mode: mode as any,
        par_values: parValues || Array(holes).fill(null),
        course_name: courseName || null,
        ...(drinkingConfig ? { drinking_config: drinkingConfig } : {}),
        ...(yardageValues ? { yardage_values: yardageValues } : {}),
        ...(handicapValues ? { handicap_values: handicapValues } : {}),
        ...(startingHole && startingHole > 1 ? { starting_hole: startingHole } : {}),
        ...(strokeAllocations ? { stroke_allocations: strokeAllocations } : {}),
      })
      .select()
      .single();

    if (gameError) {
      toast({
        title: "Error creating game",
        description: gameError.message,
        variant: "destructive",
      });
      return;
    }

    // Join as host
    const { error: joinError } = await supabase.from("game_players").insert({
      game_id: game.id,
      player_id: user.id,
    });

    if (joinError) {
      toast({
        title: "Error joining game",
        description: joinError.message,
        variant: "destructive",
      });
      return;
    }

    // Send round invites to selected friends
    if (invitedFriendIds && invitedFriendIds.length > 0) {
      const invites = invitedFriendIds.map(friendId => ({
        game_id: game.id,
        inviter_id: user.id,
        invitee_id: friendId,
      }));
      await supabase.from("round_invites").insert(invites);

      // Send notifications
      const notifications = invitedFriendIds.map(friendId => ({
        user_id: friendId,
        type: "round_invite" as const,
        title: "Round invite!",
        body: `You've been invited to a ${mode} round${courseName ? ` at ${courseName}` : ""}`,
        reference_id: game.id,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    setCurrentGame(game as unknown as Game);
    await loadPlayers(game.id);
    await loadReactions(game.id);
    await loadAchievements(game.id);
    toast({ title: `Game created! Code: ${joinCode}` });
  };

  const joinGame = async (joinCode: string) => {
    if (!user) return;

    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("*")
      .eq("join_code", joinCode.toUpperCase())
      .single();

    if (gameError) {
      toast({
        title: "Game not found",
        description: "Please check the code and try again",
        variant: "destructive",
      });
      return;
    }

    const { error: joinError } = await supabase.from("game_players").insert({
      game_id: game.id,
      player_id: user.id,
    });

    if (joinError) {
      if (joinError.code === "23505") {
        toast({ title: "You're already in this game!" });
      } else {
        toast({
          title: "Error joining game",
          description: joinError.message,
          variant: "destructive",
        });
        return;
      }
    }

    setCurrentGame(game as unknown as Game);
    await loadPlayers(game.id);
    await loadScores(game.id);
    await loadReactions(game.id);
    await loadAchievements(game.id);
    toast({ title: "Joined game!" });
  };

  const startGame = async () => {
    if (!currentGame) return;

    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from("games")
      .update({ status: "active" as GameStatus, started_at: startedAt })
      .eq("id", currentGame.id);

    if (error) {
      toast({
        title: "Error starting game",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCurrentGame({ ...currentGame, status: "active", started_at: startedAt });
    }
  };

  const updateScore = async (playerId: string, holeNumber: number, strokes: number) => {
    if (!currentGame) return;

    // Optimistic update — instantly reflect in UI
    setScores(prev => {
      const idx = prev.findIndex(s => s.game_id === currentGame.id && s.player_id === playerId && s.hole_number === holeNumber);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], strokes };
        return updated;
      }
      return [...prev, {
        id: `optimistic-${playerId}-${holeNumber}`,
        game_id: currentGame.id,
        player_id: playerId,
        hole_number: holeNumber,
        strokes,
      }];
    });

    const { error } = await supabase
      .from("scores")
      .upsert({
        game_id: currentGame.id,
        player_id: playerId,
        hole_number: holeNumber,
        strokes,
      }, {
        onConflict: 'game_id,player_id,hole_number'
      });

    if (error) {
      toast({
        title: "Error updating score",
        description: error.message,
        variant: "destructive",
      });
      // Revert optimistic update on error
      loadScores(currentGame.id);
      return;
    }

    // Send turn notification after completing hole 9 on 18-hole rounds
    if (holeNumber === 9 && currentGame.holes === 18 && strokes > 0) {
      sendTurnNotification(playerId);
    }
  };

  const sendTurnNotification = async (playerId: string) => {
    if (!currentGame) return;

    // Check player has scores for all front 9 holes
    const { data: frontNineScores } = await supabase
      .from("scores")
      .select("hole_number, strokes")
      .eq("game_id", currentGame.id)
      .eq("player_id", playerId)
      .gte("hole_number", 1)
      .lte("hole_number", 9);

    const filledHoles = (frontNineScores || []).filter(s => s.strokes > 0);
    if (filledHoles.length < 9) return;

    const frontTotal = filledHoles.reduce((sum, s) => sum + s.strokes, 0);
    const parValues = currentGame.par_values || [];
    const frontPar = parValues.slice(0, 9).reduce((sum, p) => sum + (p || 4), 0);
    const diff = frontTotal - frontPar;
    const diffLabel = diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`;

    // Get player name
    const player = players.find(p => p.player_id === playerId);
    const name = player?.profiles.display_name || "A player";

    // Get friends of this player
    const { data: friendRows } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${playerId},friend_id.eq.${playerId}`);

    const friendIds = (friendRows || []).map(f =>
      f.user_id === playerId ? f.friend_id : f.user_id
    );

    if (friendIds.length === 0) return;

    // Don't re-send if already notified for this game's turn
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("type", "turn_update")
      .eq("reference_id", currentGame.id)
      .in("user_id", friendIds)
      .limit(1);

    if (existing && existing.length > 0) return;

    const coursePart = currentGame.course_name ? ` at ${currentGame.course_name}` : "";
    const notifications = friendIds.map(friendId => ({
      user_id: friendId,
      type: "turn_update",
      title: "⛳ Turn Update",
      body: `${name} shot ${frontTotal} (${diffLabel}) on the front 9${coursePart}`,
      reference_id: currentGame.id,
    }));

    await supabase.from("notifications").insert(notifications);
  };

  const addReaction = async (holeNumber: number, reaction: string) => {
    if (!currentGame || !user) return;

    const { error } = await supabase
      .from("player_reactions")
      .insert({
        game_id: currentGame.id,
        player_id: user.id,
        hole_number: holeNumber,
        reaction,
      });

    if (error) {
      console.error("Error adding reaction:", error);
    }
  };

  const endGame = async () => {
    if (!currentGame) return;

    // Auto-detect holes played based on scored holes
    const scoredHoles = new Set(scores.filter(s => s.strokes > 0).map(s => s.hole_number));
    const holesPlayed = scoredHoles.size <= 9 ? 9 : 18;

    const completedAt = new Date().toISOString();
    const updatedGame = { ...currentGame, status: "completed" as GameStatus, completed_at: completedAt, holes: holesPlayed };

    // Compute wager BEFORE marking game complete so we can persist atomically
    let wagerUpdateFields: any = {};
    try {
      const results = await computeEndGameResults(updatedGame, players, scores);
      const playerIds = players.map(p => p.player_id);

      // Compute wager settlement
      const wagerCfg = getWagerConfig(updatedGame.stroke_allocations);
      if (wagerCfg && wagerCfg.wagerEnabled && wagerCfg.wagerBuyIn > 0) {
        const getName = (id: string) =>
          players.find(p => p.player_id === id)?.profiles.display_name || "Unknown";

        let wagerResult;

        // Team-format wager path for scramble 2v2
        const isTeamWager = players.length === 4 && updatedGame.mode === "scramble";
        if (isTeamWager) {
          // Load scramble teams and determine winner
          const { data: teamsData } = await supabase
            .from("scramble_teams").select("id, team_name").eq("game_id", currentGame.id);
          const { data: membersData } = teamsData && teamsData.length === 2
            ? await supabase.from("scramble_team_members").select("team_id, player_id")
                .in("team_id", teamsData.map(t => t.id))
            : { data: null };
          const { data: scrambleScores } = await supabase
            .from("scramble_hole_scores").select("*").eq("game_id", currentGame.id);

          if (teamsData && teamsData.length === 2 && membersData && scrambleScores) {
            const t1Members = membersData.filter(m => m.team_id === teamsData[0].id).map(m => m.player_id as string);
            const t2Members = membersData.filter(m => m.team_id === teamsData[1].id).map(m => m.player_id as string);

            if (t1Members.length === 2 && t2Members.length === 2) {
              const holeScores = scrambleScores as unknown as ScrambleHoleScore[];
              const totals = computeTeamTotals(holeScores, teamsData);
              const winnerId = resolveScrambleWinner(totals);
              const winningTeamIndex: 0 | 1 | null =
                winnerId === teamsData[0].id ? 0 : winnerId === teamsData[1].id ? 1 : null;

              wagerResult = computeTeamWagerSettlement(
                { playerIds: [t1Members[0], t1Members[1]] as [string, string], teamName: teamsData[0].team_name },
                { playerIds: [t2Members[0], t2Members[1]] as [string, string], teamName: teamsData[1].team_name },
                getName, wagerCfg.wagerBuyIn, winningTeamIndex,
              );
            }
          }
        }

        // Fallback: individual wager settlement (non-team formats)
        if (!wagerResult) {
          const modeWinnerId = results.modeResults.find(r => r.mode !== "standard" && r.winnerId)?.winnerId || null;
          const matchPlayWinnerId = results.modeResults.find(r => r.mode === "match_play")?.winnerId || null;
          const outcome = getRoundWagerOutcome(
            updatedGame.mode, players, scores, updatedGame.holes,
            matchPlayWinnerId, modeWinnerId,
          );
          wagerResult = computeWagerSettlement(
            playerIds, getName, wagerCfg.wagerBuyIn, wagerCfg.wagerType, outcome.winnerPlayerIds,
          );
        }

        const existingSa = updatedGame.stroke_allocations || {};
        wagerUpdateFields = {
          stroke_allocations: {
            ...existingSa,
            wagerResult: {
              potTotal: wagerResult.potTotal,
              payouts: wagerResult.payouts,
              settlementLines: wagerResult.settlementLines,
              winnerPlayerIds: wagerResult.winnerPlayerIds,
              status: wagerResult.status,
              isTeamFormat: wagerResult.isTeamFormat || false,
              winningTeamName: wagerResult.winningTeamName || null,
              losingTeamName: wagerResult.losingTeamName || null,
              teamSettlementAmount: wagerResult.teamSettlementAmount || null,
              teamPayouts: wagerResult.teamPayouts || null,
            },
          },
        };
      }

      // Compute skins settlement if skins mode with betPerHole configured
      let skinsSettlementFields: any = {};
      const skinsConfig = updatedGame.stroke_allocations?.skinsConfig;
      if (
        updatedGame.mode === "skins" &&
        skinsConfig &&
        skinsConfig.betPerHole > 0
      ) {
        const splitTies = !!skinsConfig.splitTies;
        const skinsState = recomputeSkins(scores, playerIds, holesPlayed, splitTies);
        const skinsNet = computeSkinsSettlement(
          skinsState.payoutEvents,
          playerIds,
          skinsConfig.betPerHole,
        );
        skinsSettlementFields = {
          skinsSettlement: {
            payoutEvents: skinsState.payoutEvents,
            netByPlayer: skinsNet,
            betPerHole: skinsConfig.betPerHole,
            splitTies,
          },
        };
        // Merge into wager update fields
        const existingSa2 = wagerUpdateFields.stroke_allocations || updatedGame.stroke_allocations || {};
        wagerUpdateFields = {
          stroke_allocations: {
            ...existingSa2,
            ...wagerUpdateFields.stroke_allocations,
            ...skinsSettlementFields,
          },
        };
      }
      const { error } = await supabase
        .from("games")
        .update({
          status: "completed" as GameStatus,
          completed_at: completedAt,
          holes: holesPlayed,
          ...wagerUpdateFields,
        })
        .eq("id", currentGame.id);

      if (error) {
        toast({ title: "Error completing game", description: error.message, variant: "destructive" });
        return;
      }

      setCurrentGame({ ...updatedGame, ...wagerUpdateFields });

      // Apply win stats + rivalries (non-critical, fire and forget)
      await applyWinStats(currentGame.id, playerIds, results, completedAt);
      // Pass skins net money to rivalry tracking if available
      const skinsNet = (wagerUpdateFields?.stroke_allocations as any)?.skinsSettlement?.netByPlayer as Record<string, number> | undefined;
      await updateRivalriesForGame(currentGame.id, players, scores, updatedGame.mode, results.settlements, skinsNet);

      // Team rivalries: only when 4 players in a 2v2 team format (scramble / best_ball)
      if (players.length === 4 && (updatedGame.mode === "scramble" || updatedGame.mode === "best_ball")) {
        try {
          // Load team assignments from scramble_teams/scramble_team_members
          const { data: teamsData } = await supabase
            .from("scramble_teams")
            .select("id, team_name")
            .eq("game_id", currentGame.id);

          if (teamsData && teamsData.length === 2) {
            const { data: membersData } = await supabase
              .from("scramble_team_members")
              .select("team_id, player_id")
              .in("team_id", teamsData.map((t) => t.id));

            const team1Members = (membersData || [])
              .filter((m) => m.team_id === teamsData[0].id)
              .map((m) => m.player_id as string);
            const team2Members = (membersData || [])
              .filter((m) => m.team_id === teamsData[1].id)
              .map((m) => m.player_id as string);

            const getName = (id: string) =>
              players.find((p) => p.player_id === id)?.profiles?.display_name ?? "Player";

            if (team1Members.length === 2 && team2Members.length === 2) {
              // For scramble 4P: determine winner from scramble_hole_scores
              let preResolvedWinnerTeamIndex: 0 | 1 | null | undefined = undefined;
              let scoreSummaryOverride: string | undefined = undefined;

              if (updatedGame.mode === "scramble") {
                const { data: scrambleScores } = await supabase
                  .from("scramble_hole_scores")
                  .select("*")
                  .eq("game_id", currentGame.id);

                if (scrambleScores) {
                  const holeScores = scrambleScores as unknown as ScrambleHoleScore[];
                  const totals = computeTeamTotals(holeScores, teamsData);
                  const winnerId = resolveScrambleWinner(totals);
                  if (winnerId === teamsData[0].id) preResolvedWinnerTeamIndex = 0;
                  else if (winnerId === teamsData[1].id) preResolvedWinnerTeamIndex = 1;
                  else preResolvedWinnerTeamIndex = null;

                  const t1Total = totals.find(t => t.teamId === teamsData[0].id)?.total ?? 0;
                  const t2Total = totals.find(t => t.teamId === teamsData[1].id)?.total ?? 0;
                  const diff = Math.abs(t1Total - t2Total);
                  const winnerName = winnerId === teamsData[0].id ? teamsData[0].team_name
                    : winnerId === teamsData[1].id ? teamsData[1].team_name : null;
                  scoreSummaryOverride = winnerName
                    ? `${winnerName} won by ${diff} stroke${diff !== 1 ? 's' : ''}`
                    : `Tie (${t1Total} strokes each)`;
                }
              }

              // Extract team settlement amount from persisted wager result if available
              const persistedWager = wagerUpdateFields?.stroke_allocations?.wagerResult;
              const teamSettlementAmount = persistedWager?.isTeamFormat ? (persistedWager.teamSettlementAmount ?? 0) : 0;

              await upsertTeamRivalryForMatch(
                currentGame.id,
                {
                  playerIds: [team1Members[0], team1Members[1]] as [string, string],
                  playerNames: [getName(team1Members[0]), getName(team1Members[1])] as [string, string],
                },
                {
                  playerIds: [team2Members[0], team2Members[1]] as [string, string],
                  playerNames: [getName(team2Members[0]), getName(team2Members[1])] as [string, string],
                },
                scores,
                completedAt,
                preResolvedWinnerTeamIndex !== undefined
                  ? { preResolvedWinnerTeamIndex, scoreSummaryOverride, teamSettlementAmount }
                  : teamSettlementAmount > 0
                    ? { teamSettlementAmount }
                    : undefined
              );
            }
          }
        } catch (teamErr) {
          console.warn("Team rivalry upsert failed (non-critical):", teamErr);
        }
      }
    } catch (err) {
      console.error("Error completing game:", err);
      // Fallback: mark complete without wager if computation fails
      const { error } = await supabase
        .from("games")
        .update({ status: "completed" as GameStatus, completed_at: completedAt, holes: holesPlayed })
        .eq("id", currentGame.id);
      if (error) {
        toast({ title: "Error completing game", description: error.message, variant: "destructive" });
      } else {
        setCurrentGame(updatedGame);
      }
    }
  };

  const leaveGame = () => {
    // Clear saved session when intentionally leaving
    AsyncStorage.removeItem(GAME_SESSION_KEY).catch(() => {});
    setCurrentGame(null);
    setPlayers([]);
    setScores([]);
    setReactions([]);
    setAchievements([]);
  };

  const updateParForHole = async (holeNumber: number, par: number) => {
    if (!currentGame) return;

    const newParValues = [...(currentGame.par_values || Array(currentGame.holes).fill(null))];
    newParValues[holeNumber - 1] = par;

    const { error } = await supabase
      .from("games")
      .update({ par_values: newParValues })
      .eq("id", currentGame.id);

    if (error) {
      console.error("Error updating par:", error);
    }
  };

  return {
    currentGame,
    players,
    scores,
    reactions,
    achievements,
    isRejoining,
    createGame,
    joinGame,
    startGame,
    endGame,
    updateScore,
    updateParForHole,
    addReaction,
    leaveGame,
    refreshGame,
  };
};

const generateJoinCode = async (): Promise<string> => {
  const { data, error } = await supabase.rpc("generate_join_code");
  if (error) throw error;
  return data;
};
