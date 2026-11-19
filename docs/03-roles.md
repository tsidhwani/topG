# Users and Roles

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
