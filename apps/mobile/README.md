# Fortuneer Mobile (iOS)

Expo (SDK 57) + expo-router app that shares code with the Next.js web app at
the repo root via [`packages/shared`](../../packages/shared).

## How sharing works

- The repo root is the web app and is **not** an npm workspace — this app is a
  standalone npm project. `@fortuneer/shared` is installed as a `file:` link.
- `packages/shared` re-exports platform-neutral modules straight from the web
  app's `lib/` (types, formatting, Vera routing heuristics) plus a
  platform-neutral Supabase client factory. The web app's `lib/` stays the
  single source of truth; don't copy code across.
- `metro.config.js` watches `packages/` and `lib/` and disables hierarchical
  module lookup so every bare import resolves from this app's `node_modules`
  (single copy of react / supabase-js in the bundle).
- Vera's Groq calls stay server-side in the web app's `/api/vera` route; the
  mobile chat screen will call that endpoint with the user's Supabase access
  token. Never put the Groq key in this app.

## Setup

```sh
cp .env.example .env   # fill from the web app's .env.local (NEXT_PUBLIC_* values)
npm install
npm run ios            # boots the iOS simulator via Expo Go
```

Sign in with an existing (confirmed + approved) account — signup lives on the
web app.

## Structure

```
src/app/_layout.tsx        session-gated root (Stack.Protected)
src/app/login.tsx          email/password sign-in
src/app/(tabs)/            Dashboard · Transactions · Vera (placeholder)
src/lib/supabase.ts        client via @fortuneer/shared factory + AsyncStorage
src/lib/auth-context.tsx   session provider
```
