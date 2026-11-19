# Top G Sportsbook

Betting layer on top of a 10-team home fantasy football league (ESPN Fantasy). See `docs/` for full context.

## Rules

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

## Suggested task order

1. Scaffold Next.js with TypeScript, Tailwind, shadcn/ui, Supabase client.
2. Write the schema migration and RLS policies from docs/07-data-model.md.
3. Build auth with roles and the email allowlist.
4. Build `lib/odds.ts` with tests.
5. Build Admin Lines Builder and Publish.
6. Build This Week, Bet Slip and My Bets.
7. Build manual Grading and Settlement.
8. Then Phase 2: ESPN client, sync cron, auto-grading.
9. Then Phase 3: suggestion engine.
