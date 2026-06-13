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
| 🖥️ Desktop Web | v1 — In Development |
| 📱 Mobile Web (PWA) | v1 — In Development |
| 📲 iOS / Android App | Backlog — Evaluating |

> Mobile is delivered as a PWA (Progressive Web App) — installable from the browser with no App Store required.

---

## Roadmap

### v1 — Core Budgeting (MVP)
The foundation. Everything needed to be a fully functional, deployable budgeting app.

**Infrastructure**
- [ ] Project setup, branch structure, CI/CD pipeline
- [ ] Supabase auth (sign up, login, session management)
- [ ] Database schema (users, accounts, transactions, budgets, categories)
- [ ] Vercel deployment (dev + production environments)

**Core Features**
- [ ] Plaid Link integration — connect bank and investment accounts
- [ ] Store and sync Plaid access tokens securely
- [ ] Transaction feed — full history with auto-categorization
- [ ] Budget management — groups, categories, time periods (monthly, yearly, custom)
- [ ] Dashboard — account balances, spending overview, budget status
- [ ] Responsive design — desktop and mobile web (PWA)

---

### v2 — Refinement + Agent-Assisted Development
Complete the budgeting feature set and introduce AI agents as internal dev tooling to accelerate development.

**Budgeting Features**
- [ ] Net worth tracking — assets, liabilities, full picture
- [ ] Goal setting and milestone tracking
- [ ] Smart spending insights — patterns, trends, anomaly detection
- [ ] Recurring transaction detection and management
- [ ] Enhanced dashboards and reporting

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
| Frontend | Next.js 14+ (App Router), TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes / Server Actions |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Bank Integration | Plaid API |
| Deployment | Vercel |
| AI (v3) | Vercel AI SDK, Anthropic API, MCP |

---

## Project Structure

### Principles
- `app/` routes contain no logic — they import from `features/`
- Components never make API calls or access the database directly
- All data fetching and business logic lives in `features/{name}/services/`
- Hooks bridge services and components — no logic in components beyond UI state
- Shared logic between features goes in `lib/` or `hooks/`, never copy-pasted
- One component per file, named to match the file
- `lib/utils/` contains pure functions only — no side effects
- `components/ui/` contains primitives only — zero business logic

### Folder Structure

```
fortuneer/
├── app/                        # Next.js App Router (routing only, no logic)
│   ├── (auth)/
│   ├── (dashboard)/
│   └── api/                    # API route handlers only — delegate to services
│
├── features/                   # Core domain logic, one folder per feature
│   ├── auth/
│   │   ├── components/         # Auth-specific UI components
│   │   ├── hooks/              # e.g. useSession, useAuth
│   │   ├── services/           # Business logic, Supabase/Plaid calls
│   │   └── types.ts            # Feature-specific types
│   ├── accounts/
│   ├── transactions/
│   ├── budgets/
│   ├── dashboard/
│   └── ai/                     # v3 — AI agent layer
│
├── components/                 # Truly shared, reusable UI only
│   ├── ui/                     # Primitives (Button, Input, Modal, Card)
│   └── layout/                 # Shell, Sidebar, Navbar
│
├── lib/                        # Shared non-feature utilities
│   ├── supabase/               # Supabase client setup
│   ├── plaid/                  # Plaid client setup
│   ├── utils/                  # Pure functions (formatCurrency, parseDate, etc.)
│   └── constants.ts
│
├── hooks/                      # Shared hooks used across multiple features
├── types/                      # Global TypeScript types and interfaces
└── config/                     # App-level config (env validation, feature flags)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Plaid](https://plaid.com) developer account

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/fortuneer.git
cd fortuneer

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Plaid
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
```

### Run Locally

```bash
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
