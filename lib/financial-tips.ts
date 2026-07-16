/** General financial tips, one surfaced per day (rotated by day of year). */
const TIPS = [
  'Pay yourself first: automate a transfer to savings the day your paycheck lands, before spending starts.',
  'An emergency fund of 3–6 months of expenses turns a crisis into an inconvenience.',
  'Time in the market beats timing the market — consistency compounds more than clever entries.',
  'Check your subscription list quarterly. Most people find at least one they forgot they were paying for.',
  "Max out any employer 401(k) match before other investing — it's an instant 100% return.",
  'Dollar-cost averaging removes emotion: invest the same amount on the same day every month.',
  'High-interest debt is a guaranteed negative return. Paying off a 24% APR card beats most investments.',
  'Rebalance your portfolio about once a year — it quietly forces you to buy low and sell high.',
  'Lifestyle creep eats raises. When your income goes up, raise your savings rate first.',
  'A low-cost index fund outperforms most professional fund managers over 10+ years.',
  'Name your savings goals. "Japan trip" gets funded; "Savings account #2" gets raided.',
  'Review your insurance deductibles annually — the cheapest premium is not always the cheapest policy.',
  'The best budget is one you actually check. Five minutes weekly beats an hour monthly.',
  'Keep investing boring. Excitement in a portfolio usually means risk you have not priced.',
  "Don't check your portfolio daily. Volatility is loud in days, quiet in decades.",
  'Negotiate bills once a year: internet, phone, and insurance often drop with a single call.',
  'Tax-advantaged accounts first (401k, IRA, HSA), taxable brokerage second.',
  'An HSA is triple tax-advantaged — deductible in, tax-free growth, tax-free out for medical costs.',
  'Set a 24-hour rule for unplanned purchases over $100. Most urges expire overnight.',
  'Credit score basics: pay on time, keep utilization under 30%, and keep old cards open.',
  'Diversification is the only free lunch in investing — across assets, sectors, and geographies.',
  'Windfalls (bonuses, refunds, gifts) are savings-rate rocket fuel. Bank at least half before it blends into spending.',
  'Round up your loan payments. Even $50 extra monthly can shave years off a mortgage.',
  'Inflation is a silent fee on cash. Money you will not need for 5+ years belongs invested.',
  'Track your net worth monthly — it is the single number that summarizes every money decision you make.',
  'Fees compound like returns do, in reverse. A 1% annual fee can eat a quarter of a portfolio over 30 years.',
  'Buy the used car a millionaire would: reliable, boring, and paid off quickly.',
  'Financial goals without dates are wishes. Attach a month and a number to each one.',
  'Your savings rate matters more than your rate of return until your portfolio is several times your annual savings.',
  'Automate everything you can: bills, savings, investing. Willpower is a terrible long-term strategy.',
]

/** Deterministic tip for a given date — same tip all day, new one tomorrow. */
export function tipOfTheDay(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return TIPS[dayOfYear % TIPS.length]
}
