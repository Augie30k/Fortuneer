# Fortuneer
Fortuneer is a personal finance app that helps you strategically manage your money and reach financial freedom.

# FORTUNEER

> **Pioneer Your Wealth.**
> Fortuneer is a personal finance app that helps you strategically manage your money and reach financial freedom.

![Fortuneer Logo](./assets/brand/fortuneer-logo.svg)

---

## What is Fortuneer?

Most budgeting apps tell you where your money went. Fortuneer helps you decide where it's going.

Fortuneer is a smart personal finance platform built for people who are serious about financial freedom — not just tracking expenses, but building a strategic path to get there. Connect your accounts, understand your money, and let intelligent insights guide your next move.

---

## Features

### v1 — MVP
- 🔗 **Bank Integration** — Connect accounts via Plaid
- 📊 **Transaction History** — Full transaction feed with categorization
- 🔐 **Secure Auth** — Supabase-powered authentication

### v2 — Coming Soon
- 💡 **Smart Insights** — Spending patterns and anomaly detection
- 🎯 **Goal Setting** — Set and track financial milestones
- 📈 **Net Worth Tracking** — Assets, liabilities, full picture

### v3 — Future
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
| AI (Planned) | Vercel AI SDK, Anthropic / OpenAI APIs |

---

## Project Structure

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

- [x] Project setup & brand identity
- [ ] Supabase auth (sign up, login, session)
- [ ] Plaid Link integration
- [ ] Transaction history feed
- [ ] Dashboard UI
- [ ] Spending categorization
- [ ] Goal tracking
- [ ] AI insights layer
- [ ] MCP agent integration

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