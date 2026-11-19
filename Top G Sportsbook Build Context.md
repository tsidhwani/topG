# Top G Sportsbook: Build Context

This doc is the context for building Top G Sportsbook in Cursor with Claude Code. Each `##` section is meant to be saved as its own Markdown file in the repo. Suggested file names are listed next to each heading.

## 1. Project Overview (docs/01-overview.md)

Top G Sportsbook is a betting layer on top of a 10-team home fantasy football league that runs on ESPN Fantasy. Two league members, Kyle Kleon and Will Shaw, run it today. They set weekly lines, take bets, and settle up at the end of the week.

Goal: replace the current manual flow (AI-made graphics plus Snapchat messages) with a simple web app where:

- Admins (Kyle and Will) post weekly lines and settle bets.
- League members browse lines, place bets, and see their active and past bets.
- League data (matchups, projections, scores, standings) comes in automatically from ESPN where possible.

What the app does NOT do:

- It does not move money. Payments stay on Venmo, outside the app. The app is only a ledger of who bet what and who owes whom.
- It does not set the official lines. Kyle and Will set lines. The app can suggest lines, which admins accept, edit, or ignore.

Scale: 10 league members, usually 5 to 8 of them betting each week. Data volume is tiny, so keep the setup simple and avoid heavy infrastructure.

## 2. Current Flow (docs/02-current-flow.md)

How Top G works today:

1. Each week, Kyle and Will make lines. They say they use a Monte Carlo simulation. The exact method is unknown.
2. They post the lines as AI-generated graphics to the league.
3. Line types include:
   - Matchup moneylines. Example: Team A projected 130 vs Team B projected 120, priced at -150 vs +125.
   - Player props. Example: CeeDee Lamb, Ja'Marr Chase, and Justin Jefferson to combine for 70+ fantasy points.
   - Parlays that combine several bets.
4. Members place bets by messaging Kyle or Will on Snapchat (for example, "$5 on that").
5. Kyle or Will send back an AI-generated bet slip image.
6. At the end of the week, they work out results and settle up over Venmo.

Pain points the app should fix:

- No central record of bets. Everything lives in Snapchat messages and images.
- Grading and payouts are worked out by hand.
- Members cannot easily see their open bets, history, or running profit and loss.
- Making the graphics and slips takes manual effort every week.

## 3. Users and Roles (docs/03-roles.md)

Two roles:

Admin (Kyle, Will, and Tapan as builder):

- Create, edit, publish, and close weekly lines.
- See suggested lines from the suggestion engine and choose what to publish.
- Void bets, grade bets by hand when needed, and mark payouts as settled.
- See every bet from every user plus a weekly settlement summary (who owes whom).
- Manage users and link each user to their ESPN team.

General user (league members):

- Log in.
- Browse the current week's published lines.
- Build a bet slip: single bets and parlays, with stake in dollars.
- See active bets, past bets, results, and running profit and loss.
- See a league-wide feed or leaderboard (optional, nice to have).

Rules:

- Role is stored on the user's profile row. Default is general user. Admins are set by hand in the database.
- Enforce roles server-side with Supabase Row Level Security, not only in the UI.

## 4. MVP Scope and Roadmap (docs/04-scope.md)

Phase 1, MVP (manual lines, real ledger):

- Auth with two roles.
- Admin page to enter lines by hand: matchup moneylines, over/unders, player props.
- Lines drop on a set day (Wednesday or Thursday morning). Admin clicks Publish.
- Users place single bets and parlays. The app shows potential payout before submitting.
- Bets lock at a cutoff (default: Thursday night kickoff; admin can change per line).
- Admin grades results by hand and marks Venmo settlement as done.
- "My Bets" page: active, past, won/lost, profit and loss.

Phase 2, ESPN connection:

- Pull league teams, weekly matchups, projected points, and final scores from ESPN.
- Pre-fill matchup lines on the admin page with ESPN projections.
- Auto-grade matchup bets and player props once the week's scores are final.

Phase 3, suggestion engine (admin-only tab):

- Simple simulation that turns projections into suggested odds.
- Suggested props, for example combined player points.
- Season futures: playoff odds and title odds from record, points for, points against, and remaining schedule.
- Admins accept, edit, or ignore each suggestion. Nothing goes live without an admin publishing it.

Out of scope: payments, real-money processing, public signups, and outside users beyond the league.

## 5. ESPN Integration (docs/05-espn-integration.md)

Verdict: connecting to the ESPN league is possible, but through an unofficial API. ESPN publishes no supported public fantasy API. The community has reverse-engineered the endpoints the ESPN web app uses, and these are widely used.

What is needed:

- League ID: the number in the league URL (`leagueId=...`).
- Season year: 2026.
- For a private league, two browser cookies from a logged-in league member: `espn_s2` and `SWID`. These act as login credentials. Find them in browser DevTools, under Storage or Application, Cookies, espn.com.

Reference implementations:

- Python: `espn-api` by cwendt94 on GitHub. Usage: `League(league_id=..., year=2026, espn_s2=..., swid=...)`. Gives teams, rosters, standings, matchups, box scores with player points and projections.
- Raw HTTP: `GET https://fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{leagueId}` with `view` params such as `mTeam`, `mMatchup`, `mMatchupScore`, `mRoster`, `mBoxscore`, `mSettings`, sending the two cookies. Claude Code should check the current host against the espn-api source code, since ESPN has moved hosts before.

Data to pull:

- Teams: id, name, owner, record, points for, points against.
- Schedule: every matchup for every week (needed for futures and remaining schedule).
- Weekly matchups: home team, away team, projected total, live score, final score.
- Player box scores: player id, name, NFL team, weekly projected and actual fantasy points (needed for props).

Risks and rules:

- Unofficial: ESPN can change or break it at any time. The app must keep working with manual line entry and manual grading if the sync fails.
- Cookies expire, often after a few months or a password change. Store them only as server-side environment variables. Never send them to the browser or commit them to Git.
- Sync on a schedule, not on every page load. Suggested: Tuesday morning (final scores, grade bets) and Wednesday morning (new week's matchups and projections). A manual "Sync now" button for admins too.
- Cache ESPN responses in Supabase so the site never depends on ESPN being up.

## 6. Tech Stack and Architecture (docs/06-architecture.md)

- Frontend and API: Next.js (App Router, TypeScript) hosted on Vercel.
- Database and auth: Supabase (Postgres, Supabase Auth, Row Level Security).
- Styling: Tailwind CSS plus shadcn/ui. Mobile-first, since most people will use it on their phones.
- Scheduled jobs: Vercel Cron hitting protected API routes (`/api/cron/sync-espn`, `/api/cron/grade`), protected by a `CRON_SECRET`.
- ESPN client: write a small TypeScript client that calls the ESPN endpoints directly, using espn-api (Python) as the reference for endpoints and field names. Fallback if that gets hard: a Python job in GitHub Actions that writes to Supabase.
- Auth: Supabase magic link email or Google sign-in. Only invited league members can sign up (allowlist of emails).

Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `ESPN_LEAGUE_ID`, `ESPN_SEASON`, `ESPN_S2`, `ESPN_SWID` (server only)
- `CRON_SECRET`

## 7. Data Model (docs/07-data-model.md)

Supabase tables. Money is stored in cents as integers. Odds are stored in American format as integers (for example -150, +125).

- `profiles`: id (auth user id), display\_name, role (`admin` or `user`), espn\_team\_id (nullable), venmo\_handle, created\_at.
- `espn_teams`: espn\_team\_id, season, name, owner\_name, wins, losses, ties, points\_for, points\_against, synced\_at.
- `espn_matchups`: id, season, week, home\_team\_id, away\_team\_id, home\_projected, away\_projected, home\_score, away\_score, is\_final, synced\_at.
- `espn_player_weeks`: season, week, player\_id, player\_name, nfl\_team, position, projected\_points, actual\_points, is\_final.
- `weeks`: season, week, status (`draft`, `open`, `locked`, `graded`, `settled`), lines\_publish\_at, lock\_at.
- `markets`: id, season, week, type (`moneyline`, `spread`, `total`, `player_prop`, `future`), title, description, status (`draft`, `open`, `locked`, `graded`, `void`), lock\_at, created\_by, source (`manual` or `suggested`), linked matchup or player ids (jsonb).
- `selections`: id, market\_id, label (for example "Team A ML", "Over 70.5"), american\_odds, line (nullable number), result (`pending`, `win`, `loss`, `push`, `void`).
- `bets`: id, user\_id, type (`single` or `parlay`), stake\_cents, potential\_payout\_cents, status (`open`, `won`, `lost`, `push`, `void`), placed\_at, settled (bool), settled\_at.
- `bet_legs`: id, bet\_id, selection\_id, odds\_at\_placement (locks the price the user got).
- `suggestions`: id, season, week, type, payload (jsonb), created\_at, accepted\_market\_id (nullable).
- `audit_log`: id, actor\_id, action, details (jsonb), created\_at.

Row Level Security:

- Users can read open and past markets and selections, read their own bets, and insert bets only for themselves on markets that are open and not past `lock_at`.
- Admins can read and write everything.
- Place bets through a server-side function that re-checks lock time and copies the current odds onto each leg, so the client cannot tamper with odds or timing.

## 8. Odds, Payouts and Settlement (docs/08-odds-and-settlement.md)

American odds to profit on a stake:

- Positive odds (+125): profit = stake × 125 / 100. A $5 bet wins $6.25 profit, $11.25 returned.
- Negative odds (-150): profit = stake × 100 / 150. A $5 bet wins $3.33 profit, $8.33 returned.

Decimal odds (used for parlays): +X becomes 1 + X/100; -X becomes 1 + 100/X. Parlay payout = stake × product of every leg's decimal odds.

Grading rules:

- Moneyline: the team with more final fantasy points wins. Exact tie = push (stake returned).
- Over/under and combined player props: compare actual total to the line. Use half-point lines (70.5) to avoid pushes; whole-number lines can push.
- Parlay: wins only if every leg wins. A pushed or voided leg drops out and the parlay is repriced on the remaining legs. All legs pushed = whole bet pushed.
- Player who does not play (bye, injury, inactive): admin decides void or grade as scored. Default: grade as scored, since it is fantasy points. Admins can override.
- Grading runs when ESPN marks the week final (usually Tuesday). Admins review and confirm before results show as final.

Settlement (money stays on Venmo):

- Weekly summary per user: total staked, total returned, net for the week.
- Net > 0: Top G owes the user. Net < 0: the user owes Top G.
- Admin marks each user's week as settled once Venmo is done. Show Venmo handles to make paying easy.
- Open question: does the book (Kyle and Will) pay out of a shared pot, or do they split profit and loss? This affects only the admin summary page.

## 9. Pages and User Flows (docs/09-pages.md)

User pages:

1. Login: magic link or Google, allowlisted emails only.
2. This Week (home): published lines grouped by Matchups, Player Props, Futures. Tap a selection to add it to the bet slip. Countdown to lock.
3. Bet Slip (drawer): single or parlay toggle, stake input, potential payout updating live, Place Bet button, confirmation screen that replaces the old AI bet slip image.
4. My Bets: Active tab (open bets with live scores when available), History tab (won, lost, push), season profit and loss.
5. League (nice to have): standings from ESPN, leaderboard of bettor profit, feed of bets placed (option to hide stakes).

Admin pages:

1. Lines Builder: create markets by hand. For matchups, pre-fill both teams and ESPN projections. Set odds, line and lock time. Save as draft.
2. Suggestions (Phase 3): model-suggested odds, props and futures. Each has Accept, Edit then Accept, or Dismiss.
3. Publish: preview the week's board as users will see it, then publish. Optional: schedule publish for Wednesday or Thursday morning.
4. Grading: auto-graded results from ESPN for review, manual override per selection, confirm week.
5. Settlement: who owes whom for the week, mark settled.
6. Admin Settings: users and roles, team linking, ESPN sync status, last sync time, Sync Now button, cookie expiry warning.

## 10. Suggestion Engine (docs/10-suggestion-engine.md)

The suggestion engine only advises. Kyle and Will set the real lines.

Matchup moneylines (simple Monte Carlo):

1. For each team, take ESPN's projected total as the mean.
2. Assume each team's score is normal with a standard deviation. Start with a fixed value (for example 20 to 25 points), then tune it from this league's past weeks (actual minus projected).
3. Simulate 10,000 matchups. Win probability = share of sims each team wins.
4. Convert probability to fair American odds: p ≥ 0.5 gives -100 × p / (1 - p); p < 0.5 gives +100 × (1 - p) / p.
5. Add a small house edge (vig), for example 4 to 5%, so both sides are slightly worse than fair. Admin sets the vig.

Player combo props (for example Lamb + Chase + Jefferson over 70.5):

- Line = sum of ESPN player projections, rounded to .5.
- Over/under priced near -110 each, or simulated from player variance if time allows.
- Suggest props built from popular rostered players and big matchups of the week.

Futures (season level):

- Inputs: current record, points for, points against, remaining schedule from ESPN, league playoff format.
- Simulate the rest of the season many times using each team's average score and spread.
- Output: odds to make playoffs, win the regular season, and win the title.

Optional LLM layer: an LLM can write fun market names and blurbs, and flag interesting props. It should not set the odds. The numbers come from the simulation.

## 11. Setup Checklist: What Tapan Needs to Gather (docs/11-setup-checklist.md)

- [ ] ESPN league ID (from the league URL).
- [ ] Is the league public or private? If private, the `espn_s2` and `SWID` cookies from a logged-in member (Kyle or Will, or Tapan).
- [ ] League settings: scoring type (PPR, half PPR), number of regular-season weeks, playoff teams and format.
- [ ] Emails of the 10 league members for the allowlist, and which are admins.
- [ ] Each member's matching ESPN team.
- [ ] Current Top G rules: max bet, min bet, which bet types allowed, parlay limits, how pushes and inactive players are handled, how the book splits money.
- [ ] Ask Kyle and Will how their current Monte Carlo works, and get a few past weeks of lines and bets to seed testing.
- [ ] Vercel account, Supabase project, GitHub repo.

## 12. Instructions for Claude Code (CLAUDE.md)

Put this section in `CLAUDE.md` at the repo root.

- Read every file in `docs/` before writing code.
- Build in phases: Phase 1 (manual lines and bet ledger) must work end to end before any ESPN code.
- Never put ESPN cookies or the Supabase service key in client code or in Git. Use `.env.local` and Vercel environment variables. Add `.env*` to `.gitignore`.
- All money in integer cents. All odds math in one tested module (`lib/odds.ts`) with unit tests for payouts, parlays, pushes and conversions.
- Bet placement goes through a server action or Postgres function that checks lock time and copies odds at placement.
- Write Supabase migrations as SQL files in `supabase/migrations`, with RLS policies in the same migrations.
- Keep the ESPN client in `lib/espn/`, isolated so it can be swapped or turned off. The app must work fully with ESPN disabled.
- Mobile-first UI. Keep it simple: 10 users, low traffic.
- Ask before adding paid services or new infrastructure.
- Payments are out of scope. Never add payment processing.

Suggested first tasks for Claude Code:

1. Scaffold Next.js with TypeScript, Tailwind, shadcn/ui, Supabase client.
2. Write the schema migration and RLS policies from docs/07.
3. Build auth with roles and the email allowlist.
4. Build `lib/odds.ts` with tests.
5. Build Admin Lines Builder and Publish.
6. Build This Week, Bet Slip and My Bets.
7. Build manual Grading and Settlement.
8. Then Phase 2: ESPN client, sync cron, auto-grading.
9. Then Phase 3: suggestion engine.
