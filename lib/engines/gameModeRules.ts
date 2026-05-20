export interface ShortRules {
  howToWin: string;
  scoring: string;
  funFactor: string;
}

export interface FullRules {
  overview: string;
  scoringDetails: string;
  tieRules: string;
  wagerInteraction: string;
  edgeCases: string;
}

export interface GameModeRuleSet {
  short: ShortRules;
  full: FullRules;
}

export const gameModeRules: Record<string, GameModeRuleSet> = {
  standard: {
    short: {
      howToWin: "Finish the round with the fewest total strokes.",
      scoring: "Every stroke counts. Your total across all holes is your final score. Lowest wins.",
      funFactor: "Pure golf. No gimmicks, no excuses — just you vs. the course.",
    },
    full: {
      overview:
        "Stroke Play is the most traditional format in golf. Each player counts every stroke on every hole, and the player with the lowest cumulative total at the end of the round wins.",
      scoringDetails:
        "Each hole's score is simply the number of strokes taken. Par values are used for reference (birdie, bogey, etc.) but the winner is determined solely by total strokes. If handicaps are enabled, net scores are calculated by subtracting allocated strokes on designated holes.",
      tieRules:
        "If two or more players finish with the same total, the tie is broken by comparing back-9 scores, then back-3 holes, then the final hole. If still tied, it's a draw.",
      wagerInteraction:
        "When Betting Mode is layered on, you can set a per-stroke wager. Each stroke of difference between players is worth the stake amount. Nassau-style front/back/overall splits are also supported.",
      edgeCases:
        "If a player picks up on a hole (doesn't finish), they record a maximum of double-par for that hole. Incomplete rounds are marked but still scored for holes played.",
    },
  },
  match_play: {
    short: {
      howToWin: "Win more holes than your opponent.",
      scoring: "Each hole is worth 1 point. Lowest score on the hole wins it. Ties carry no value unless Betting Mode is active.",
      funFactor: "Momentum swings fast. Every hole resets the pressure.",
    },
    full: {
      overview:
        "Match Play is a hole-by-hole battle. Instead of counting total strokes, you compete to win individual holes. The player who wins the most holes wins the match.",
      scoringDetails:
        "On each hole, the player with fewer strokes wins that hole (+1). If both players score the same, the hole is halved (no point awarded). The match status is tracked as 'X Up with Y to play.' A match can end early if a player is up by more holes than remain (e.g., 4&3 means 4 up with 3 to play).",
      tieRules:
        "If the match is tied after 18 (or 9) holes, it's declared All Square. In tournament settings, sudden-death playoffs can be used, but in Raffli casual play it stays a draw unless Betting Mode triggers a press.",
      wagerInteraction:
        "Betting Mode adds per-hole stakes. A 'press' can be triggered when a player falls 2 down, creating a new side bet for the remaining holes. Nassau-style wagers split front 9, back 9, and overall into separate bets.",
      edgeCases:
        "If a player concedes a hole (picks up), the opponent wins that hole automatically. Dormie (up by the same number of holes remaining) means the trailing player must win every remaining hole to halve the match.",
    },
  },
  skins: {
    short: {
      howToWin: "Win holes outright — ties carry the skin to the next hole.",
      scoring: "Each hole has a 'skin' worth 1 unit. If no one wins outright, the value carries over and stacks.",
      funFactor: "One big hole can flip the entire round. Carryovers build insane tension.",
    },
    full: {
      overview:
        "Skins is a high-stakes, high-drama format where each hole has an independent value. The player with the lowest score on a hole wins that skin. If two or more players tie for the low score, the skin carries over to the next hole, increasing the pot.",
      scoringDetails:
        "Each hole starts with 1 skin. If there's a clear winner (sole lowest score), they collect the skin(s). If tied, the skin carries to the next hole. Carryovers can stack — a 4-hole carryover means 5 skins are on the line for hole 5. The player with the most skins at the end wins.",
      tieRules:
        "If the final hole results in a carryover, those skins are either split evenly among tied players or voided, depending on your group's house rules. Raffli defaults to splitting.",
      wagerInteraction:
        "Each skin can be assigned a dollar value. With Betting Mode active, winning 7 skins at $5/skin = $35 payout. Carryovers make late-round holes potentially worth 3–5x their base value.",
      edgeCases:
        "In rare cases, all skins can carry to the last few holes, creating massive winner-take-all scenarios. If a player picks up, they cannot win the skin on that hole but others still compete.",
    },
  },
  wolf: {
    short: {
      howToWin: "Pick the right partner each hole — or go Lone Wolf and double the stakes.",
      scoring: "The Wolf chooses a partner after watching tee shots. The 2v2 team with the lower combined score wins the hole.",
      funFactor: "Mind games, alliances, and betrayals. Every tee shot is a negotiation.",
    },
    full: {
      overview:
        "Wolf is a rotating-partner format for 4 players. Each hole, one player is the 'Wolf' (rotation: 1-2-3-4-1-2...). The Wolf watches other players tee off in order and must decide after each shot whether to pick that player as their partner. If they don't pick anyone, they go 'Lone Wolf' — playing 1 vs. 3.",
      scoringDetails:
        "If the Wolf picks a partner, it's 2v2. The team with the lower combined best-ball score wins the hole (2 points each). If the Wolf goes lone, they win 4 points for winning or lose 4 for losing. Blind Wolf (declaring before anyone tees off) doubles the Lone Wolf value to 8.",
      tieRules:
        "If the 2v2 (or 1v3) teams tie on a hole, no points are awarded and the points carry to the next hole. On the last hole, ties are broken by individual scores.",
      wagerInteraction:
        "Each point can carry a dollar value. Lone Wolf is high-risk/high-reward — perfect for players who want to gamble on their own game. Betting Mode tracks cumulative point values.",
      edgeCases:
        "The Wolf must declare their partner immediately after that player's tee shot — no waiting to see everyone hit. On holes 17 and 18, some groups let the player who's losing go Wolf out of turn for a comeback opportunity.",
    },
  },
  lock_5: {
    short: {
      howToWin: "Lock your 5 best holes per 9 — only those count toward your final score.",
      scoring: "After each hole, decide: lock it or leave it. You must lock exactly 5 of 9 holes. Lowest locked total wins.",
      funFactor: "Bad hole? No problem — just don't lock it. Strategy meets damage control.",
    },
    full: {
      overview:
        "Lock 5 adds a strategic layer to stroke play. You play all 9 (or 18) holes normally, but after each hole you choose whether to 'lock' that score. You must lock exactly 5 holes per 9. Only your locked holes count toward your final score.",
      scoringDetails:
        "Your final score is the sum of your 5 locked holes (per 9). For an 18-hole round, you lock 5 on the front and 5 on the back, for a total of 10 locked holes. The player with the lowest locked total wins.",
      tieRules:
        "Ties are broken by comparing the best single locked hole, then second-best, and so on. If still tied after all 5, it's a draw.",
      wagerInteraction:
        "Betting Mode applies to locked scores only. This means a player who had a blowup hole but strategically didn't lock it can still compete for the pot. Wagers settle on final locked totals.",
      edgeCases:
        "If a player forgets to lock/unlock before the next hole, their most recent hole auto-locks if they have locks remaining. You cannot change a lock decision once you advance to the next hole. On hole 9, if you haven't locked 5 yet, remaining holes auto-lock.",
    },
  },
  drinking: {
    short: {
      howToWin: "Survive. The course sets drinking rules — penalties and rewards on every hole.",
      scoring: "Normal scoring applies, but trigger events (3-putt, birdie, water, etc.) come with drink assignments.",
      funFactor: "Golf meets a party game. The worse you play, the more fun everyone else has.",
    },
    full: {
      overview:
        "Drinking Mode overlays fun penalty rules on top of any game format. Specific events during play trigger drink assignments — sometimes for you, sometimes for others. It's designed for casual rounds where fun > competition.",
      scoringDetails:
        "Standard stroke scoring still applies underneath. Drinking events are tracked separately. Common triggers: 3-putt (drink 1), water ball (drink 2), birdie (assign 1 drink to someone), eagle (everyone else drinks 2). Custom rules can be added per group.",
      tieRules:
        "Drinking mode doesn't affect tiebreakers for the underlying game format. Drink tallies are shown for bragging rights only.",
      wagerInteraction:
        "When combined with Betting Mode, you can add drink-or-pay stakes: losers of bets can choose to drink instead of paying, at a predetermined conversion rate (e.g., 1 drink = $2 off).",
      edgeCases:
        "Players can opt out of drinking (designated driver mode) — their penalties convert to push-up challenges or other fun alternatives. The host sets the intensity level (chill, standard, or chaos) before the round.",
    },
  },
  betting: {
    short: {
      howToWin: "Win money. Set stakes and the scoring format handles the rest.",
      scoring: "Wagers are calculated based on the active game mode's results. Settlement shows who owes who.",
      funFactor: "Real stakes make every putt matter. Raffli handles the math so you focus on playing.",
    },
    full: {
      overview:
        "Betting Mode is a layer that can be applied on top of any game format. It converts game results into dollar amounts based on pre-set stakes. At the end of the round, Raffli calculates net settlements — who owes who and how much.",
      scoringDetails:
        "Stakes are set before the round (e.g., $5/hole, $2/skin, $10/match). The underlying game mode determines winners and losers. Betting Mode multiplies results by stake amounts and nets everything down to the minimum number of payments.",
      tieRules:
        "Ties in the underlying format mean no money changes hands for that component. If the overall round is tied, the net is $0 and 'No payments needed' is shown.",
      wagerInteraction:
        "This IS the wager system. It supports per-hole bets, overall bets, press bets (Match Play), carryover values (Skins), and side bets. All settlements are shown in the Round Recap.",
      edgeCases:
        "If a player leaves mid-round, bets are settled through the last completed hole. Partial rounds are prorated. The minimum bet is $0.50 to keep things interesting without getting out of hand.",
    },
  },
  wheel_of_chaos: {
    short: {
      howToWin: "Survive the chaos. Play your best while completing random challenges on every hole.",
      scoring: "Standard stroke scoring applies, but each hole comes with a Chaos Challenge that changes how you play it.",
      funFactor: "No two rounds are the same. Random challenges keep everyone laughing and adapting.",
    },
    full: {
      overview:
        "Wheel of Chaos is a game mode overlay that assigns a random challenge at the start of each hole. Challenges range from using your non-dominant hand to tee off, putting with your eyes closed, or playing with only 3 clubs. It's designed for groups who want unpredictability and laughs.",
      scoringDetails:
        "Underneath the chaos, standard stroke scoring applies. Your total strokes still determine the winner. Challenges don't change your score — they change HOW you play. Some challenges target a single player, others affect everyone. The engine balances targets so no one gets hit too often.",
      tieRules:
        "Ties are broken using standard stroke play tiebreakers (back 9, back 3, last hole). Chaos challenges don't factor into tiebreakers.",
      wagerInteraction:
        "When combined with Betting Mode, stakes apply to final stroke totals. The chaos adds variance — a player who gets tough challenges might argue for a handicap adjustment, but Raffli keeps it raw. Side bets on individual challenges (e.g., 'bet you can't birdie with a putter only') are encouraged.",
      edgeCases:
        "Challenges are deterministic and seeded by the match ID and hole number, so they stay consistent across reloads and for all players. If a challenge is physically impossible (e.g., a left-handed challenge for a left-handed player), the player can re-spin once per round.",
    },
  },

  scramble: {
    short: {
      howToWin: "Your team picks the best shot each stroke and everyone plays from there.",
      scoring: "After each shot, the team chooses the best ball position. All players hit from that spot until the ball is holed. Lowest team total wins.",
      funFactor: "Pure teamwork. Every player contributes, and big drives from anyone help the whole squad.",
    },
    full: {
      overview:
        "Scramble is the most popular team format in golf. All players tee off, the team selects the best shot, and everyone plays their next shot from that spot. This repeats until the ball is holed. It encourages aggressive play since you always have a safety net.",
      scoringDetails:
        "The team records one score per hole — the total strokes it takes from tee to cup using the best-ball-each-stroke method. Teams are typically 2 or 4 players. Raffli tracks which player's shot was selected on each stroke for post-round stats.",
      tieRules:
        "Ties are broken by comparing back 9 team totals, then back 3, then the 18th hole. If still tied, it's a draw.",
      wagerInteraction:
        "When combined with Betting Mode, wagers apply to the team score. Skins can also be played between teams on a per-hole basis. Nassau works naturally with team totals for front 9, back 9, and overall.",
      edgeCases:
        "If a team has fewer players (e.g., 2 vs. 4), no handicap adjustment is applied by default — the format naturally advantages larger teams. Solo scramble is not supported; minimum 2 players per team.",
    },
  },

  best_ball: {
    short: {
      howToWin: "Each player plays their own ball. The team takes the best individual score on each hole.",
      scoring: "Everyone plays normally. On each hole, the lowest score among teammates counts as the team score. Lowest team total wins.",
      funFactor: "Play your own game but know your partner has your back. One great hole from anyone can save the team.",
    },
    full: {
      overview:
        "Best Ball (also called Four-Ball) is a team format where each player plays their own ball throughout the round. On each hole, the team's score is the lowest individual score among the teammates. It rewards consistency and clutch performances.",
      scoringDetails:
        "Each player completes every hole with their own ball. The team score for each hole is the minimum of all teammates' scores. For example, if Player A scores 5 and Player B scores 4 on a par-4, the team records a 4. Total team score is the sum of all hole minimums.",
      tieRules:
        "Ties are broken using standard methods: compare back 9 team totals, then back 3, then the 18th hole. Individual scorecards can be used as a secondary tiebreaker.",
      wagerInteraction:
        "When combined with Betting Mode, wagers apply to team scores. Skins and Nassau both work naturally — each hole's team score determines the hole winner. Match Play can also be overlaid for team-vs-team hole-by-hole competition.",
      edgeCases:
        "If a player picks up on a hole (doesn't finish), their score is excluded and the team relies on the remaining teammate(s). If no one on a team finishes a hole, the team records a maximum score (double par).",
    },
  },
};
