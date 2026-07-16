# FORTUNEER
> **Pioneer Your Wealth.**
> Fortuneer is a personal finance app that helps you strategically manage your money and reach financial freedom.

![Fortuneer Logo](./assets/brand/fortuneer-logo-v3.svg)

---

## What is Fortuneer?

Most budgeting apps tell you where your money went. Fortuneer helps you decide where it's going.

Fortuneer is a smart personal finance platform built for people who are serious about financial freedom — not just tracking expenses, but building a strategic path to get there. Connect your accounts, understand your money, and let intelligent insights guide your next move.

---

## Platform

| Platform | Status |
|---|---|
| 🖥️ Desktop Web | **1.0.0-beta.1** |
| 📱 Mobile Web (PWA) | 1.0.0-beta.1 (responsive web; PWA manifest planned) |
| 📲 iOS / Android App | Backlog — Evaluating |

> Mobile is delivered as a PWA (Progressive Web App) — installable from the browser with no App Store required.

---

## Roadmap

> **Current release: `1.0.0-beta.1`** — v1 core budgeting plus most of the v2
> feature set (net worth, goals, recurring, reports, investments) and the
> first cut of the v3 AI layer (Vera). See `FEATURES.md` for the full list.

### v1 — Core Budgeting (MVP)
The foundation. Everything needed to be a fully functional, deployable budgeting app.

**Infrastructure**
- [x] Project setup, branch structure
- [ ] CI/CD pipeline
- [x] Supabase auth (sign up, login, sessions, forgot/reset password)
- [x] Database schema with RLS (see `supabase/migrations/`)
- [ ] Vercel deployment (dev + production environments)

**Core Features**
- [x] Plaid Link integration — connect bank and investment accounts
- [x] Store and sync Plaid access tokens securely (cursor-based sync)
- [x] Transaction feed — full history with auto-categorization (Plaid PFC + user rules)
- [x] Budget management — groups, categories, effective-dated monthly budgets
- [x] Dashboard — customizable widgets, net worth, cash flow, spending pace
- [x] Responsive design — desktop and mobile web

---

### v2 — Refinement + Agent-Assisted Development
Complete the budgeting feature set and introduce AI agents as internal dev tooling to accelerate development.

**Budgeting Features**
- [x] Net worth tracking — assets, liabilities, history backfill
- [x] Goal setting and milestone tracking
- [ ] Smart spending insights — patterns, trends, anomaly detection
- [x] Recurring transaction detection and management
- [x] Enhanced dashboards and reporting (Sankey cash flow, spending/income breakdowns, investments)

**Dev Tooling**
- [ ] Developer agent — accelerates feature implementation on established codebase
- [ ] Project manager agent — tracks issues, milestones, and feature specs
- [ ] Testing and security agent — automated test coverage and vulnerability scanning

---

### v3 — AI Financial Layer
Intelligent features that reason over your financial data, not just report on it.

- [ ] AI financial agent — natural language queries over your own data
- [ ] Strategy-aware investment tracking — understands your goals per account
- [ ] Goal-aware budgeting — tracks against personal financial targets
- [ ] Scenario modeling — forward-looking projections and what-if analysis
- [ ] Proactive alerts — agent-driven nudges and anomaly notifications
- [ ] MCP integration — Model Context Protocol for extensible AI tooling

---

### Backlog — Future Expansion
- Investment research layer — RAG over earnings reports, market filings, GSE data
- Agent orchestration — multi-step autonomous financial workflows
- Native iOS / Android app (Expo) — evaluating based on user demand

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui (Radix) |
| Charts | Recharts + custom SVG |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL, RLS) |
| Auth | Supabase Auth |
| Bank Integration | Plaid API |
| Deployment | Vercel |
| AI (v3) | Vercel AI SDK, Anthropic API, MCP |

---

## Project Structure

```
fortuneer/
├── app/
│   ├── (auth)/                 # Login, signup, forgot/reset password
│   ├── (dashboard)/            # Authenticated pages (dashboard, accounts,
│   │                           #   transactions, budgets, goals, recurring,
│   │                           #   investments, reports, settings)
│   └── api/                    # Route handlers, one folder per resource
│
├── components/                 # Shared components
│   ├── ui/                     # shadcn/ui primitives — zero business logic
│   └── charts/                 # Recharts / custom SVG chart components
│
├── lib/                        # Supabase clients, Plaid client + sync engine,
│                               #   shared helpers (format, effective budgets,
│                               #   category forking)
├── supabase/migrations/        # Numbered SQL migrations — schema source of truth
└── proxy.ts                    # Auth middleware
```

See `DEVELOPMENT.md` for data-model notes and the verification workflow.

## Getting Started

Follow `SETUP.md` — in short:

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Plaid keys
# apply supabase/migrations/*.sql to your Supabase project, in order
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Development Workflow

### Branch Structure
- `main` — production, auto-deploys to Vercel
- `dev` — staging, Vercel preview deployment
- `feature/*` — individual features, branch off `dev`
- `fix/*` — bug fixes, branch off `dev`
- `hotfix/*` — urgent production fixes, branch off `main`

### Branch Naming
| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/{issue-number}-{description}` | `feature/7-plaid-link-flow` |
| Bug Fix | `fix/{issue-number}-{description}` | `fix/12-auth-redirect-loop` |
| Hotfix | `hotfix/{description}` | `hotfix/broken-plaid-token` |
| Release | `release/v{version}` | `release/v1.0.0` |

### Flow
1. Pick an issue → create branch directly from the issue page (`feature/{n}-{description}` off `dev`)
2. Build and test locally
3. PR into `dev` with `closes #{issue-number}` → Vercel preview URL generated
4. When all issues in a milestone are closed → PR `dev` into `main` → production release
5. Tag the release: `git tag v1.0.0 && git push origin v1.0.0`

### GitHub Project Tracking

```
Project Board (Fortuneer)
    └── Milestone (e.g. Auth, Bank Integration)
            └── Issue (#1 Setup Supabase Auth)
                    └── Branch (feature/1-setup-supabase-auth)
                            └── PR → closes #1 → milestone progress updates → board updates
```

### Environments
| Branch | Plaid | Supabase |
|---|---|---|
| `dev` / `feature/*` | Sandbox | Dev project |
| `main` | Production | Prod project |

---

## Brand

Fortuneer's visual identity is built around **deep indigo** and **amber gold** — premium, strategic, and forward-looking.

| Asset | File |
|---|---|
| Logo (Icon + Wordmark) | `assets/brand/fortuneer-logo-v3.svg` |
| App Icon | `assets/brand/fortuneer-icon.svg` |
| Brand Style Guide | `assets/brand/fortuneer-brand-guide.html` |

**Primary Colors:**
- Gold: `#FCD34D` / `#D97706`
- Indigo: `#6D28D9` / `#A78BFA`
- Background: `#07071A`
- Text: `#EEE8F5`

**Fonts:** EB Garamond (display) · DM Sans (body)

**Tagline:** Pioneer Your Wealth

---

## Contributing

This is a personal project shared with a small group. Not open to external contributions.

---

## License

MIT © [Augustine Asumadu](https://augustineasumadu.com)

---

<p align="center">
  <strong>FORTUNEER</strong> · Pioneer Your Wealth
</p>
