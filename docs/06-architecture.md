# Tech Stack and Architecture

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
