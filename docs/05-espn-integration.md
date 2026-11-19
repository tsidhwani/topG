# ESPN Integration

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

## This league's details

- League URL: `https://fantasy.espn.com/football/league?leagueId=142150087`
- League ID: `142150087`
- Season: 2026
- Public/private and `espn_s2`/`SWID` cookies: not yet gathered. See the setup checklist (docs/11-setup-checklist.md).
