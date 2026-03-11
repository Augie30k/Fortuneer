# FORTUNEER
Fortuneer is a personal finance app that helps you strategically manage your money and reach financial freedom.
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
| 📱 Mobile Web | v1 — In Development |
| 📲 iOS / Android App | v2 — Planned (Expo) |

---

## Features

### v1 — MVP (Desktop + Mobile Web)
- 🔐 **Secure Auth** — Supabase-powered authentication
- 🔗 **Bank Integration** — Connect accounts via Plaid
- 📊 **Transaction History** — Full transaction feed with categorization
- 🏠 **Dashboard** — Account balances and spending overview

### v2 — Mobile App + Growth
- 📲 **Native iOS & Android App** — Expo (React Native), Turborepo monorepo
- 💡 **Smart Insights** — Spending patterns and anomaly detection
- 🎯 **Goal Setting** — Set and track financial milestones
- 📈 **Net Worth Tracking** — Assets, liabilities, full picture

### v3 — AI Layer
- 🤖 **AI Financial Agent** — Natural language queries, personalized strategy
- 🔌 **MCP Integration** — Model Context Protocol for extensible AI tooling
- 📬 **Proactive Alerts** — Agent-driven nudges and recommendations

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
| Mobile App (v2) | Expo (React Native), Turborepo monorepo |
| AI (v3) | Vercel AI SDK, Anthropic / OpenAI APIs, MCP |

---

## Project Structure

### v1 — Current
```
fortuneer/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Auth routes (login, signup)
│   ├── (dashboard)/      # Protected app routes
│   └── api/              # API routes (Plaid, Supabase)
├── components/           # Reusable UI components
├── lib/                  # Utilities, Supabase client, Plaid client
├── hooks/                # Custom React hooks
├── types/                # TypeScript types
├── assets/
│   └── brand/            # Logo SVGs, brand guide
└── public/               # Static assets
```

### v2 — Turborepo Monorepo (Web + Mobile)
```
fortuneer/
├── apps/
│   ├── web/              # Next.js (migrated from v1)
│   └── mobile/           # Expo (React Native)
└── packages/
    ├── ui/               # Shared components
    ├── types/            # Shared TypeScript types
    └── lib/              # Shared Supabase + Plaid clients
```

---

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

Create a `.env.local` file in the root with the following:

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

## Roadmap

**v1 — MVP (Desktop + Mobile Web)**
- [x] Project setup & brand identity
- [ ] Supabase auth (sign up, login, session)
- [ ] Plaid Link integration
- [ ] Store user Plaid access tokens in Supabase
- [ ] Fetch and store transaction history
- [ ] Transaction feed UI
- [ ] Spending categorization
- [ ] Dashboard UI (balances + spending overview)
- [ ] Responsive design (mobile web)
- [ ] Vercel deployment

**v2 — Mobile App + Growth**
- [ ] Migrate to Turborepo monorepo
- [ ] Expo mobile app (iOS + Android)
- [ ] Smart spending insights
- [ ] Goal setting and tracking
- [ ] Net worth tracking

**v3 — AI Layer**
- [ ] AI financial agent
- [ ] MCP integration
- [ ] Proactive alerts and recommendations

---

## Development Workflow

### Branch Structure
- `main` — production, auto-deploys to Vercel
- `dev` — staging, Vercel preview deployment
- `feature/*` — individual features, branch off `dev`
- `fix/*` — bug fixes, branch off `dev`
- `hotfix/*` — urgent production fixes, branch off `main`

### Branch Naming Scheme
| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/{issue-number}-{description}` | `feature/7-plaid-link-flow` |
| Bug Fix | `fix/{issue-number}-{description}` | `fix/12-auth-redirect-loop` |
| Hotfix | `hotfix/{description}` | `hotfix/broken-plaid-token` |
| Release | `release/v{version}` | `release/v1.0.0` |

### Flow
1. Pick an issue → create branch directly from the issue page on GitHub (`feature/{n}-{description}` off `dev`)
2. Build and test locally
3. PR into `dev` with `closes #{issue-number}` in the commit message → automatically closes issue on merge → Vercel preview URL generated
4. When all issues in a milestone are closed → PR `dev` into `main` → production release
5. Tag the release: `git tag v1.0.0 && git push origin v1.0.0`

### GitHub Project Tracking
Everything is connected through issues — no manual linking of branches to projects or milestones needed:

```
Project Board (Fortuneer MVP)
    └── Milestone (e.g. Auth, Bank Integration)
            └── Issue (#1 Setup Supabase Auth)
                    └── Branch (feature/1-setup-supabase-auth)
                            └── PR → closes #1 → milestone progress updates → board updates
```

- **Issues → Milestones** — assign on creation
- **Issues → Project Board** — add to Fortuneer MVP board
- **Branches → Issues** — create branch from issue page, reference with `closes #n`
- **Milestones → Project** — implicit through issues, no direct link needed

### Environments
| Branch | Plaid | Supabase |
|---|---|---|
| `dev` / `feature/*` | Sandbox | Dev project |
| `main` | Production | Prod project |



---

## Contributing

This is a personal project and not currently open to external contributions. Star the repo if you find it interesting — more coming soon.

---

## License

MIT © [Augustine Asumadu](https://augustineasumadu.com)

---

<p align="center">
  <strong>FORTUNEER</strong> · Pioneer Your Wealth
</p>