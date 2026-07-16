# Fortuneer — Developer Guide

Next.js 16 (App Router) + TypeScript app with Supabase (Postgres, Auth, RLS)
and Plaid for bank data. UI is shadcn/ui (Radix) + Tailwind CSS v4, charts are
Recharts, drag-and-drop is dnd-kit.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in values — see SETUP.md
npm run dev                  # http://localhost:3000
```

Production build & serve:

```bash
npm run build
npx next start -p 3000
```

## Project layout

```
app/
  (auth)/            login, signup, forgot/reset password
  (dashboard)/       all authenticated pages (dashboard, accounts, transactions,
                     budgets, goals, recurring, investments, reports, settings)
  api/               route handlers — one folder per resource
components/          shared components; components/ui is shadcn primitives;
                     components/charts is Recharts/SVG chart components
lib/                 supabase clients, plaid client + sync engine, shared
                     helpers (formatting, effective budgets, category forking)
supabase/migrations/ numbered SQL migrations (001..N) — the source of truth
                     for schema; apply in order
proxy.ts             auth middleware (redirects unauthenticated users)
```

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key (RLS-scoped clients) |
| `SUPABASE_SECRET_KEY` | Service-role key — server-only, used by `lib/supabase-admin.ts` for privileged ops (account deletion) |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | Plaid API credentials (`sandbox` for dev) |
| `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES` | Optional; default `transactions` / `US` |

## Data model notes (the non-obvious parts)

- **Money convention follows Plaid**: `transactions.amount > 0` is money OUT
  (expense), `< 0` is money IN (income).
- **Fork-on-edit categories**: shared/global categories (`user_id IS NULL`)
  are never mutated. Editing one creates a personal fork
  (`lib/category-fork.ts`) and repoints the user's transactions/budgets/rules
  to it. `categories.forked_from` records lineage so `GET /api/categories`
  hides the superseded global row for that user.
- **Effective-dated budgets**: `budgets` rows carry a `month` column; a row
  applies from its month forward until a later row for the same category
  overrides it (`lib/effective-budget.ts`). Saving an amount is single-month
  by default — the API writes an `auto_revert` row for the following month so
  the change doesn't bleed forward. Passing `perpetual: true` (per item on
  bulk saves) carries it forward instead, reclaiming any auto-revert chain.
- **Plaid sync** (`lib/plaid-sync.ts`): cursor-based `/transactions/sync`,
  auto-categorization from Plaid PFC + user rules, balance snapshots, and an
  `excluded_plaid_accounts` list so a removed account isn't resurrected on
  the next sync.
- **RLS everywhere**: every table references `auth.users(id) on delete
  cascade`, so deleting the auth user (Settings → Danger zone) removes all
  user data in one cascade.

## Verification workflow

Every meaningful change should pass all three:

```bash
npx tsc --noEmit                # types
rm -rf .next && npm run build   # clean production build
```

Then the e2e smoke suite — a Node script that creates a throwaway confirmed
Supabase user, links Plaid sandbox (First Platypus Bank, bypassing Link UI via
`/sandbox/public_token/create`), exercises every API route against a
production server on a dedicated port, and deletes the user (cascade cleans
everything). Beware stale servers: verify the port is actually free
(`lsof -i :<port>`) before starting, and confirm the new server responds
before trusting results — an old process serving stale code produces
convincing-but-wrong test outcomes.

## Conventions

- Route handlers follow one pattern: create RLS client → `auth.getUser()` →
  401 if missing → query scoped by `user_id` → JSON. See any file in `app/api`.
- Destructive UI actions that lose real data (account deletion, goal deletion)
  confirm via `AlertDialog`; cheap reversible deletes act immediately with a
  toast.
- Icons are lucide-react; category icons map through `components/CategoryIcon.tsx`.
- New schema changes = new numbered file in `supabase/migrations/`, never
  edits to old ones.
