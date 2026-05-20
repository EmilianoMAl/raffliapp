# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start dev server (scan QR with Expo Go)
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
npx expo start --web    # Web browser
```

No lint, test, or build scripts are configured.

## Architecture

**Raffli** is a multiplayer golf scoring app (Expo SDK 54, React Native 0.81, Expo Router v6).

### Routing

File-based routing via `expo-router`. Route groups:
- `(auth)/` — unauthenticated screens: `login`, `signup`, `forgot-password`, `onboarding` (animated 3-slide intro, stored in AsyncStorage as `ONBOARDING_KEY`), `setup` (display name + handicap entry after signup)
- `(tabs)/` — main app with bottom tab bar
- `round/` — round creation wizard (`create.tsx`: 4-step: course selection → game mode → wager config → player invites)

Root layout ([app/_layout.tsx](app/_layout.tsx)) gates routing on Supabase auth state: unauthenticated → `/(auth)/login`, authenticated → `/(tabs)`. Splash screen stays visible until session check resolves. Also tracks onboarding completion via AsyncStorage.

The tab bar has 5 visible tabs (Home, Rivalry, Play, Chats, Feed). `friends` and `profile` are hidden tab screens (`href: null`) navigated to programmatically. The center **Play** tab is a circular FAB that routes to `/round/create`.

### State Management

No Redux/Context. All state lives in custom hooks under [hooks/game/](hooks/game/):

| Hook | Responsibility |
|------|---------------|
| `useGameState.ts` | Current round: create, join, score, end, real-time sync |
| `useFriends.ts` | Friend list, requests, user search |
| `useSocialState.ts` | Feed posts, DMs, conversations |
| `useNotifications.ts` | Push notification subscriptions |

`useGameState` (~865 lines) is the most complex: it manages optimistic score updates (debounced 300ms reloads), Supabase Realtime subscriptions for multi-player sync, and saves active round to AsyncStorage under key `golfy_current_game` for session restore on relaunch.

### Backend

Supabase handles everything: Postgres DB, auth (Apple/Google/email), and Realtime for live score sync. Client is initialized in [lib/supabase.ts](lib/supabase.ts) using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Auth uses AsyncStorage for session persistence with auto-refresh on app foreground.

Key tables: `profiles` (display_name, username, avatar_url, handicap_index, is_new_to_golf), `games` (host_id, join_code, holes, mode, status, par_values, yardage, handicap_values, course_name, wager config), `game_players`, `scores`, `player_reactions`, `hole_achievements`, `friends`, `friend_requests`, `posts`, `post_likes`, `post_comments`, `conversations`, `messages`, `notifications`, `rivalries`, `scramble_teams`, `match_play_results`, `skins_results`.

Real-time channels are named `game-{gameId}` and subscribe to `postgres_changes` on game tables inside the hooks. Always unsubscribe channels on cleanup (`supabase.removeChannel()`).

### Game Modes & Scoring Engines

13+ game modes: `standard`, `match_play`, `skins`, `wolf`, `nassau`, `scramble`, `best_ball`, `stableford`, `bingo_bango_bongo`, `wheel_of_chaos`, `lock_5`, `drinking`, `betting`. All mode rules live in [lib/engines/](lib/engines/):

- `gameModeRules.ts` — per-mode rule definitions with `short` (howToWin, scoring, funFactor) and `full` (overview, scoringDetails, tieRules, wagerInteraction, edgeCases) descriptors
- `scoringEngine.ts` — end-game result computation; returns `ModeResult[]` (mode, label, winnerId, detail, emoji) and `BetSettlement[]`
- `handicapUtils.ts` — `distributeStrokesToHoles()` allocates handicap strokes to hardest holes first; `buildMatchPlayHandicapConfig()` for differential handicap
- `wagerEngine.ts` — `WagerConfig` (enabled, buyIn, type: `WINNER_TAKES_ALL` | `TOP_2_SPLIT`); `getRoundWagerOutcome()` and `computeWagerSettlement()`
- `wagerSettlement.ts` — settlement line items (who pays whom)
- `skinsEngine.ts`, `scrambleEngine.ts`, `teamRivalryService.ts` — mode-specific logic

These are pure computation modules; call them from `useGameState.endGame()`.

### Design System

Colors are in [lib/theme/colors.ts](lib/theme/colors.ts):
- `fairwayGreen: '#4D7500'` — primary actions
- `highVisLime: '#E0E561'` — active tabs, surface highlights
- `bunkerSand: '#FFF9F5'` — light modal backgrounds
- `graphiteShaft: '#1F201A'` — dark backgrounds, cards
- `skyBlue: '#6BC6E5'` — positive/secondary accents
- `sundayRed: '#EC4533'` — errors/destructive

No UI library. All components are vanilla React Native. Custom SVG navigation icons (`NavHomeIcon`, `NavRivalryIcon`, `NavPlayIcon`, `NavChatsIcon`, `NavFeedIcon`, `BellIcon`, `CardTrophyIcon`) are in [lib/icons.tsx](lib/icons.tsx). The `components/` directory is currently empty.

### Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOLF_API_KEY    # Golf course data API
```

`EXPO_PUBLIC_` prefix is required for Expo to expose variables to the client bundle.
