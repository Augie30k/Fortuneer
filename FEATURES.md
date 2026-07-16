# Fortuneer feature roadmap

Feature landscape distilled from Monarch Money, YNAB, Copilot Money, Rocket
Money, and community feedback (r/ynab, r/MonarchMoney — July 2026).
✅ = shipped in Fortuneer, 🔜 = planned, 💡 = idea/backlog.

## Dashboard
- ✅ Customizable widgets — in-place edit mode: reorder/remove on the widgets
  themselves, hidden-widget tray to re-add; persisted per device
- ✅ Time-range selector (1M / 3M / 6M / 1Y / All) driving charts
- ✅ Net worth over time (area chart with gradient fill, forward-filled daily
  snapshots)
- ✅ KPI tiles: net worth, assets, monthly spending, savings rate
- ✅ Spending vs "this time last month" delta + pace speedometer
  (green/amber/red gauge on the spending tile)
- ✅ Upcoming bills widget (from recurring detection)
- 💡 Financial health score

## Accounts
- ✅ "Connect bank" (blue, matching the app's trust/banking accent) opens a
  picker first — bank connection (Plaid) or a manual account — instead of
  jumping straight into the Plaid popup; the picker is where more
  connection platforms would slot in later
- ✅ Plaid Link connect (sandbox), multiple institutions
- ✅ Institution logos (fetched from Plaid at link time) on account rows
- ✅ Grouped by type (Cash / Credit / Investments / Loans / Other)
- ✅ Overview chart: flips between net-worth trend and asset/liability
  composition breakdown; range + account-type filters
- ✅ Hide/unhide accounts, rename, edit manual balances
- ✅ Disconnect institution (revokes at Plaid, removes local data)
- ✅ Remove a single linked account without dropping the connection
  (exclusion list keeps sync from resurrecting it)
- ✅ Delete manual accounts
- ✅ Add a transaction directly from an account's detail page
- ✅ Net-worth history backfilled from transaction ledger on connect
  (weekly reconstructed balances, not just from-today snapshots)
- ✅ Manual accounts grouped into assets vs liabilities, with optional
  APY/APR auto-accrual (daily/weekly/monthly/yearly compounding —
  savings grow, loans accrue interest)
- ✅ Picking "Other" or "Loan" when adding a manual account offers a
  finer-grained optional type (Real estate, Vehicle, Other asset / Mortgage,
  Auto loan, Student loan, Other liability) for clarity in the account list
- ✅ A "setting up your account" loading state covers the gap between
  finishing Plaid Link and the dashboard/accounts page actually populating
  (exchange + initial sync takes a few seconds) — no more looking stuck
- 💡 Zillow home-value tracking

## Investments
- ✅ Holdings synced from Plaid (positions, prices, value, cost basis)
- ✅ Portfolio value / cost basis / gain summary + per-holding gains
- ✅ Performance vs. the market: portfolio compared against S&P 500 /
  Nasdaq / Dow, normalized % change over the selected range
- ✅ Portfolio movers ticker — a continuous, seamlessly-looping crawl (like a
  news channel ticker, no jump cuts) rather than a click-through carousel —
  next to a compact market-news widget (source-colored avatars, relative
  timestamps), refreshed daily
- ✅ Financial tip of the day
- 💡 Allocation breakdown, benchmarks per account

## Transactions
- ✅ Search, category/account filters, date-range and amount-range filters
- ✅ Sorting (newest/oldest/largest expense/largest income)
- ✅ Bulk recategorization with floating action bar
- ✅ Rules engine — applied to new imports and retroactively; create, edit,
  delete from Settings with merchant autocomplete + live match preview
- ✅ Rule suggestion after recategorizing a transaction (one tap to preview
  and save the equivalent rule)
- ✅ CSV export honoring active filters; CSV import into any account
- ✅ Manual transaction entry (expense/income) + delete
- ✅ Notes, pending badges, merchant logos
- 🔜 Split transactions
- 🔜 "Needs review" flag + review queue
- 💡 Attachments/receipts

## Budgets
- ✅ Income is a first-class group, styled identically to every expense
  group (no special treatment) and listed after Goals: expected monthly
  income is set like any budget (with the same only-this-month / every-month
  / cadence scopes), and rows track money *received* against it
- ✅ Summary is three self-contained cards instead of one shared tile block:
  **Income** (expected income, a progress bar, earned + remaining),
  **Expenses** (budgeted expenses, a severity-colored bar, spent +
  remaining/over), and **Expected savings** (budgeted income minus budgeted
  expenses minus goal plans — a forward-looking plan-vs-plan number, green
  when positive and red when negative, with no bar since it's not a
  to-date progress metric)
- ✅ Edit-all-at-once budget sheet: every category inline with spent context,
  one save (Monarch-inspired, single-screen); income group listed first with
  received-this-month context and a split Income/Budget running total
- ✅ Effective-dated budgets: amounts are per-month; changing one affects only
  that month by default, with per-category opt-in to carry it forward to all
  future months (repeat toggle in the sheet, toast action on inline edits)
- ✅ Month navigation into past and future months + month/year picker popover
  — floored at the account's creation month (both chevron and picker), since
  there's no budget history before the account itself existed
- ✅ Category groups with per-group subtotals; group order managed in Settings
- ✅ Drag-to-reorder categories, drag across groups, rename groups inline
- ✅ Per-category monthly tracking, over/near-limit meters
- ✅ Recurring cadences beyond monthly — quarterly, semiannual, or annual —
  for bills that don't hit every month (materialized as explicit on/off
  months under the hood, ~3 years ahead); chosen from a compact dropdown
  tucked under the "this month / every month" choice so the popover stays short
- ✅ A dedicated, visually distinct "Goals" group (listed above Income):
  every goal gets its own row (gold-accented header, colored left border)
  with overall progress — separate from real spending categories, and
  never written to transactions, so Reports stays untouched. Goal money is
  taken out of Expected Savings specifically, never mixed into the
  Expenses card's own totals
- ✅ Click a goal's plan figure (or "Set plan" if it has none) to set a
  fixed monthly amount — every month, every month until the goal's target
  date, or just this month — same mechanism as a regular category's budget
- ✅ **Auto-save**: any goal with a monthly figure — a fixed plan *or* a
  date-derived pace — automatically claims room from this month's Expected
  Savings (income budgeted minus expenses budgeted, before goals), no
  manual contribution needed. Rather than a static plan number plus a
  caveat underneath, the goal's own monthly amount *is* the live claim for
  the current month — it shrinks toward $0 as the pool tightens and rises
  again as it recovers, exactly as if you'd retyped the figure yourself
  (and editing it starts from that live number, so a manual override picks
  up right where the dynamic clamp left off). Multiple goals share the pool
  in priority order (see below) — the first in line is filled first and
  protected, the last in line is the first to give ground as the pool
  tightens — and once a goal's target is fully met, leftover beyond it is
  never further eaten. Flexible goals (no plan, no date) never participate.
  A fixed-plan goal that comes up short one month carries the shortfall
  forward and tops up future months until it's paid off; a date-paced goal
  self-corrects the same way just by recalculating (less saved + less time
  left = a higher pace). When the real month (not just the one you're
  viewing) ends, whatever was live-claimed is committed for real into the
  goal's saved total — checked lazily whenever goals load, so no server
  scheduler is needed, and safe to re-check any number of times without
  double-counting
- ✅ **Goal priority**: a "Prioritize" toggle on the Goals group switches it
  into a drag-to-reorder list; the saved order drives both display order
  (a brand-new goal always lands at the back, never ahead of existing
  goals) and auto-save fill order — the top goal claims Expected Savings
  room first, the bottom goal is the first to lose room as the month gets
  tight
- 🔜 Rollover budgets (top community ask)
- 💡 Flex budgeting

## Goals
- ✅ Savings goals with a target amount and one of three plan styles chosen
  at creation: **by date** (pick a deadline, the app computes — and
  re-computes monthly — what it takes to land on it), **by amount** (pick a
  fixed monthly amount, the app projects the finish date), or **flexible**
  (no monthly figure at all — the goal never inflates budget totals just by
  existing)
- ✅ Template-based creation (emergency fund, trip, down payment…) with a
  live preview that always derives the number you didn't type: a date shows
  "≈ $X/mo", an amount shows "reach it by <month>"
- ✅ Progress rings, overall saved/target/reached summary, and a per-goal
  "this month" bar (contributed vs. plan) consistent with the Budgets page
- ✅ Add/withdraw money with quick-amount buttons ("finish it" / "all"); an
  optional "already saved" starting balance can be excluded from this
  month's budget deduction via a checkbox (counts toward the lifetime total
  either way)
- ✅ Edit goals after creation — including switching plan styles (the fixed
  plan syncs to the Budgets page, switching away clears it); delete
  requires confirmation
- ✅ Every goal automatically appears in its own "Goals" group on the
  Budgets page (once you have at least one) — contributions deduct from
  that page's Remaining total without ever touching Reports
- ✅ Goals widget on the dashboard (hidden automatically when there are no goals)
- 🔜 Link a goal to an account (progress = account balance)
- 💡 Debt payoff strategies (avalanche vs snowball)

## Recurring
- ✅ Heuristic detection + next-charge projection + monthly total
- 🔜 Bill calendar view
- 💡 Price-increase alerts

## Reports
- ✅ Dedicated reports page: date presets (this/last month, 3mo, YTD, 12mo,
  all), group by category/merchant/account, per-account filter
- ✅ Sankey cash-flow diagram (income sources → budget → categories + saved),
  gradient ribbons, click any segment to see its transactions
- ✅ Spending & income donut charts with hover pull-out, linked legend, and
  click-to-filter transactions
- ✅ Income / expenses / net summary tiles
- 💡 Shareable reports with hidden amounts (Monarch-style)

## Settings
- ✅ Organized into tabs: Account / Categories & rules / Connections & data
- ✅ Profile (name, currency preference) with explicit edit mode
- ✅ Appearance: light / dark / system
- ✅ Custom categories (create/edit/delete, color-coded, grouped) — including
  income categories via a dedicated toggle; they always share the single
  "Income" group (enforced server-side) instead of fragmenting into
  ad-hoc group names
- ✅ Budget group ordering (drag to reorder), with a "New group" shortcut
  that jumps straight to naming one; Income shown as a pinned, non-draggable
  entry (its position on the Budgets page isn't driven by category order,
  so dragging it wouldn't do anything — shown for visibility, not implying
  it's freely reorderable)
- ✅ Category rules manager (create, edit, delete)
- ✅ Connections manager (per-institution status + disconnect)
- ✅ Full CSV export
- ✅ Account deletion (confirmation dialog; revokes Plaid tokens, cascades all data)

## Vera — AI assistant
- ✅ Floating chat available on every page, plus a dedicated full-page view
  (`/vera`) with a persistent conversation sidebar
- ✅ Has a distinct personality — warm, direct, opinionated (grounded in
  real data, never generic advice) — set via her system prompt
- ✅ Persistent chat history (ChatGPT/Claude-style): conversations are
  saved, auto-titled from the first message, browsable, and deletable
- ✅ Answers questions about the user's own data via read tools (budgets,
  spending, transactions, goals, accounts/net worth)
- ✅ Takes action on request: set budget amounts (single-month or ongoing),
  create goals, record contributions
- ✅ Safeguards: no delete capability at all, RLS-scoped queries, amount
  caps, confirm-before-large-changes prompting
- ✅ Every change logged to an audit table with a prior-state snapshot —
  one-click Undo in the chat
- ✅ Graceful failure handling: a failed response offers one-click Retry
  (without duplicating the message in history); after two failed retries the
  composer locks with a "Vera is temporarily down" notice — starting a new
  chat unlocks it
- ✅ Cost/token-efficient by design: a zero-token heuristic router (no extra
  model call) sends simple lookups and small talk to a small/fast Groq
  model and reserves the larger model for financial writes or long/complex
  asks; history sent to the model is windowed and output length is capped,
  and the system prompt is tuned for concision without losing personality
  or the safety rules
- 🔜 Transaction recategorization tool, spending insights digests

## Platform
- ✅ Apple-style light/dark theme, responsive
- ✅ Forgot/reset password
- ✅ Signup validates the email isn't already registered, with a live
  password-match/length checklist and a show/hide toggle
- ✅ Modern calendar date picker across all forms
- ✅ Plaid webhooks for automatic syncs (in addition to manual + on-connect)
- 🔜 PWA manifest for installable mobile app
- 💡 Household sharing / partner access
