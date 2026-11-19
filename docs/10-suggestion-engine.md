# Suggestion Engine

The suggestion engine only advises. Kyle and Will set the real lines.

Matchup moneylines (simple Monte Carlo):

1. For each team, take ESPN's projected total as the mean.
2. Assume each team's score is normal with a standard deviation. Start with a fixed value (for example 20 to 25 points), then tune it from this league's past weeks (actual minus projected).
3. Simulate 10,000 matchups. Win probability = share of sims each team wins.
4. Convert probability to fair American odds: p >= 0.5 gives -100 x p / (1 - p); p < 0.5 gives +100 x (1 - p) / p.
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
