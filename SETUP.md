# Fortuneer — Setup Guide

## Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- A [Plaid](https://plaid.com) account (sandbox keys are free) for bank linking

## 1. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API (publishable/anon key) |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API (secret/service-role key — never expose to the browser) |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid dashboard → Keys |
| `PLAID_ENV` | `sandbox` for development |
| `GROQ_API_KEY` | console.groq.com — powers Vera, the AI assistant (optional; Vera shows a setup notice without it) |

## 2. Install dependencies

```bash
npm install
```

## 3. Database schema

The schema lives in `supabase/migrations/` as numbered SQL files. Apply them
**in order** (001 first) in the Supabase SQL editor, or via any Postgres
client connected to your project:

```
supabase/migrations/
  001_core_schema.sql          profiles, plaid_items, accounts, categories,
                               transactions, budgets, balance_snapshots + RLS
  002_rules_goals.sql          category rules, savings goals
  003_investments_apy.sql      holdings, manual-account APY accrual
  004_groups_order_exclusions.sql  category groups, plaid account exclusions
  005_category_order.sql       category sort order + default seed order
  006_category_fork_lineage.sql    forked_from lineage on categories
  007_effective_dated_budgets.sql  month column on budgets (effective-dated)
  008_budget_auto_revert.sql   auto_revert flag on budgets
  009_plaid_item_logo.sql      institution logo on plaid_items
  010_rule_conditions.sql      rule match_type + amount conditions
  011_goal_category_link.sql   goal → budget category link
  012_agent_actions.sql        Vera (AI assistant) action log for undo
  013_vera_conversations.sql   Vera persistent chat history
  014_goal_contributions.sql   per-contribution goal history (Goals group on Budgets)
  015_remove_goal_category_link.sql  drops goals.category_id (superseded by 014's model)
  016_goal_allocations.sql     effective-dated monthly allocation per goal (planning figure)
  017_goal_auto_contributions.sql  marks month-end auto-save contributions (idempotency)
```

Every table has Row Level Security enabled and cascades from
`auth.users(id)`, so user data is isolated and fully removed when an auth
user is deleted.

## 4. Supabase Auth configuration

- Enable the **Email** provider (Supabase → Authentication → Providers).
- Set your site URL (Authentication → URL Configuration) so confirmation and
  password-reset emails link back to your app (`http://localhost:3000` in dev).

## 5. Run

```bash
npm run dev
```

Sign up, confirm your email, then link a bank from the Accounts page. In
sandbox, Plaid Link accepts the test institution **First Platypus Bank**
(credentials `user_good` / `pass_good`).

See `DEVELOPMENT.md` for project layout, data-model notes, and the
verification workflow.
