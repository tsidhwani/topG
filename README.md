# Top G Sportsbook

Betting layer on top of a 10-team home fantasy football league (ESPN Fantasy). See `docs/` for full product context and `CLAUDE.md` for build rules and task order.

## Stack

Next.js (App Router, TypeScript) + Tailwind + shadcn/ui + Supabase (Postgres, Auth, RLS). Deployed on Vercel.

## Getting started

```bash
cp .env.local.example .env.local   # fill in Supabase project values
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Status

Scaffold only. No Supabase project, auth, schema, or ESPN credentials wired up yet — see `docs/11-setup-checklist.md`.
