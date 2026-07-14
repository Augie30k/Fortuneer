# Fortuneer v1 Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- (Optional) Plaid account for bank integration

## Local Development Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Get your Supabase credentials from [supabase.com](https://supabase.com):
- `NEXT_PUBLIC_SUPABASE_URL` - Your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your anon key (publishable)
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (keep secret!)

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Database Schema

Run this SQL in your Supabase SQL editor to create the database schema:

```sql
-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'loan', 'other')) NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  plaid_account_id TEXT,
  plaid_access_token TEXT,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('debit', 'credit')) NOT NULL,
  plaid_transaction_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  period TEXT CHECK (period IN ('monthly', 'yearly', 'custom')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view their own row" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own row" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Accounts
CREATE POLICY "Users can view their own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Categories
CREATE POLICY "Users can view their own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "Users can view transactions of their accounts" ON transactions
  FOR SELECT USING (
    account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create transactions in their accounts" ON transactions
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  );

-- Budgets
CREATE POLICY "Users can view their budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
fortuneer/
├── app/
│   ├── (auth)/           # Auth pages (login, signup)
│   ├── (dashboard)/      # Authenticated pages
│   │   ├── dashboard/    # Dashboard page
│   │   ├── accounts/     # Account management
│   │   ├── transactions/ # Transaction feed
│   │   └── budgets/      # Budget management
│   └── api/              # API routes
├── lib/
│   ├── types.ts          # TypeScript types
│   ├── supabase-client.ts # Client-side Supabase
│   └── supabase-server.ts # Server-side Supabase
├── components/           # Reusable components
└── public/              # Static assets
```

## v1 Features Checklist

### Phase 1: Database & Infrastructure ✅
- [x] Database schema created
- [x] Row Level Security (RLS) configured
- [x] API routes set up
- [x] TypeScript types defined

### Phase 2: Core Dashboard 🏗️
- [x] Dashboard page structure
- [x] Account display
- [x] Metrics cards
- [x] Navigation sidebar
- [ ] Real data integration

### Phase 3: Account Management 🏗️
- [x] Account list page
- [x] Add account form
- [ ] Plaid integration (next)
- [ ] Account editing/deletion

### Phase 4: Transaction Features 🏗️
- [x] Transaction page structure
- [ ] Transaction feed with real data
- [ ] Transaction search/filter
- [ ] Category management

### Phase 5: Budget Management 🏗️
- [x] Budget page structure
- [ ] Budget creation/editing
- [ ] Budget tracking

### Phase 6: Polish & Deployment
- [ ] Mobile responsiveness
- [ ] Error handling
- [ ] Loading states
- [ ] Vercel deployment

## Next Steps

1. **Wire up the dashboard to real data**
   - Update dashboard page to fetch from `/api/dashboard`
   - Update accounts page to display actual accounts

2. **Add Plaid integration**
   - Set up Plaid Link for bank connections
   - Store Plaid access tokens in database

3. **Implement transaction syncing**
   - Fetch transactions from Plaid
   - Auto-categorize transactions
   - Display in transaction feed

4. **Add budget tracking**
   - Calculate spending against budgets
   - Show budget alerts

5. **Deploy to Vercel**
   - Connect GitHub repo
   - Set environment variables
   - Deploy dev and production environments

## Troubleshooting

**Error: "Missing required fields" when creating an account**
- Ensure all form fields are filled in
- Check API response in browser DevTools

**RLS Policy errors**
- Ensure you're logged in
- Check that user ID is being passed correctly
- Verify RLS policies are enabled

**Supabase connection issues**
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check that your Supabase project is running
