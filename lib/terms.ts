/** Terms & Conditions — single source of truth for both the version the app
 *  enforces and the terms text itself.
 *
 *  The content lives here as platform-neutral data (re-exported through
 *  @fortuneer/shared) so the web renderer (components/legal/TermsContent.tsx)
 *  and the mobile terms screen display exactly the same terms users accept.
 *
 *  Bump TERMS_VERSION whenever the terms change materially: every user whose
 *  profile carries an older (or missing) version is routed back through the
 *  acceptance gate (web: /terms/accept via the proxy; mobile: the terms
 *  screen via auth-context) before they can use the app again.
 */
export const TERMS_VERSION = '1.0'
export const TERMS_EFFECTIVE_DATE = 'July 23, 2026'

/** Whether a profile's recorded acceptance satisfies the current terms. */
export function hasAcceptedCurrentTerms(profile: {
  terms_accepted_at?: string | null
  terms_version?: string | null
}): boolean {
  return Boolean(profile.terms_accepted_at) && profile.terms_version === TERMS_VERSION
}

// ---------------------------------------------------------------------------
// Terms content
// ---------------------------------------------------------------------------

/** Inline run of text: plain, bold, or an external link. */
export type TermsSegment = string | { bold: string } | { link: { text: string; href: string } }

export type TermsBlock =
  /** Paragraph; `caps` renders in all-caps (warranty/liability sections). */
  | { type: 'p'; caps?: boolean; segments: TermsSegment[] }
  | { type: 'list'; items: TermsSegment[][] }

export interface TermsSection {
  n: string
  title: string
  blocks: TermsBlock[]
}

const p = (...segments: TermsSegment[]): TermsBlock => ({ type: 'p', segments })
const caps = (...segments: TermsSegment[]): TermsBlock => ({ type: 'p', caps: true, segments })
const list = (...items: TermsSegment[][]): TermsBlock => ({ type: 'list', items })

export const TERMS_SECTIONS: TermsSection[] = [
  {
    n: '1',
    title: 'Acceptance of these Terms',
    blocks: [
      p(
        'These Terms & Conditions (the “Terms”) are a binding agreement between you and the operator of Fortuneer (“Fortuneer”, “we”, “us”, “our”). Fortuneer is an independent project operated by its individual creator; every protection, disclaimer, and limitation in these Terms applies equally to that creator, and to any current or future owners, operators, contributors, and successors of the Service (together, the “Operator Parties”).'
      ),
      p(
        'By creating an account, clicking to accept these Terms, or accessing or using Fortuneer (the “Service”) in any way, you agree to be bound by these Terms. If you do not agree, you must not use the Service. You must accept these Terms — and any updated version of them when prompted — before using the Service; if you decline an updated version, your access to the Service will be suspended until you accept.'
      ),
    ],
  },
  {
    n: '2',
    title: 'The Service — beta software',
    blocks: [
      p(
        'Fortuneer is a personal-finance information tool: it aggregates financial account data you connect or enter, and provides dashboards, budgets, savings goals, transaction categorization, recurring-charge detection, reports, investment tracking, long-term projections, and an AI assistant (“Vera”).'
      ),
      p(
        'The Service is provided as ',
        { bold: 'beta software' },
        ', offered on an invite-only basis, under active development. Features may be incomplete, may change or disappear without notice, may contain bugs, and may produce incorrect results. You accept the Service on that basis.'
      ),
    ],
  },
  {
    n: '3',
    title: 'Not financial, investment, tax, or legal advice',
    blocks: [
      p(
        { bold: 'Nothing in the Service is financial, investment, tax, accounting, or legal advice.' },
        ' All content — including budgets, savings-rate figures, net-worth calculations, spending insights, financial tips, projections, market data, news items, and anything Vera says — is provided for general informational and educational purposes only.'
      ),
      p(
        'We are not a bank, broker-dealer, investment adviser, financial planner, credit counselor, tax preparer, or fiduciary, and no fiduciary, advisory, or professional relationship is created by your use of the Service. Deposits are not held by us and nothing in the Service is insured by the FDIC, SIPC, or any other body. ',
        { bold: 'The Service never holds, custodies, transfers, or moves your money' },
        ' — it reads and displays data only.'
      ),
      p(
        'Before making any financial decision, consult a qualified professional. Any decision you make — and its consequences — is yours alone, and you agree that no Operator Party is responsible for decisions you make based on information shown in the Service.'
      ),
    ],
  },
  {
    n: '4',
    title: 'Projections, simulations, and calculations are estimates',
    blocks: [
      p(
        'The Service includes forward-looking tools, including life-trajectory projections, uncertainty ranges, milestone estimates, debt-payoff simulations, goal pacing, auto-save allocations, interest accrual on manual accounts, and “what a choice is worth” comparisons. These are ',
        { bold: 'hypothetical illustrations' },
        ' generated from simplified models and assumptions (about returns, inflation, income, spending, and your inputs) that will not match reality. Actual outcomes will differ, possibly dramatically. Past performance never guarantees future results. No projection, milestone, badge, or figure in the Service is a promise, forecast, or guarantee of any outcome, and you agree not to rely on them as such.'
      ),
    ],
  },
  {
    n: '5',
    title: 'Vera — AI assistant',
    blocks: [
      p(
        'Vera is an experimental assistant powered by third-party large language models. ',
        { bold: 'AI output can be wrong, incomplete, outdated, or misleading' },
        ', even when it sounds confident. You must independently verify anything Vera tells you before acting on it. Vera’s output is not advice (Section 3 applies in full).'
      ),
      p(
        'At your request, Vera can make limited changes to your data (for example, setting budget amounts or creating goals). Changes Vera makes at your prompting are your changes: you are responsible for reviewing them, and undo tools are provided as a convenience, not a guarantee. Your conversations with Vera are processed by third-party AI providers to generate responses, and are logged (including change history) to operate and safeguard the feature. We may limit, rate-cap, suspend, or permanently disable Vera — for all users or for your account individually — at any time, with or without notice or reason, and Vera’s availability is never a guaranteed part of the Service.'
      ),
    ],
  },
  {
    n: '6',
    title: 'Account data, connected institutions, and third-party services',
    blocks: [
      p(
        'The Service relies on third-party providers, including Plaid Inc. for bank connectivity, hosting and database providers, AI model providers, and sources of market prices and news. By connecting a financial institution you authorize us and Plaid to access and retrieve your account data on your behalf, and you agree to ',
        {
          link: {
            text: 'Plaid’s End User Privacy Policy',
            href: 'https://plaid.com/legal/#end-user-privacy-policy',
          },
        },
        '. Your relationship with your bank or brokerage is governed by their terms, not ours.'
      ),
      p(
        { bold: 'Displayed data may be wrong.' },
        ' Balances, transactions, holdings, prices, quotes, net-worth history (including reconstructed/backfilled history), categorizations, merchant names and logos, recurring-charge detections, and news are provided “as is”, may be delayed, estimated, duplicated, missing, or inaccurate, and must not be treated as an official record. Your financial institution’s own records are the only authoritative source. We are not responsible for the acts, omissions, outages, or data of any third-party provider or institution.'
      ),
    ],
  },
  {
    n: '7',
    title: 'Eligibility and your account',
    blocks: [
      p(
        'You must be at least 18 years old and able to form a binding contract to use the Service. You agree to provide accurate registration information, keep your credentials confidential, and notify us of any unauthorized use. You are responsible for all activity under your account. One account per person; you may not share, sell, or transfer an account. You may only connect financial accounts that you own or are authorized to access.'
      ),
    ],
  },
  {
    n: '8',
    title: 'Access control, moderation, and administration',
    blocks: [
      p(
        'The Service is operated with administrative controls that we may exercise ',
        {
          bold: 'at any time, at our sole discretion, with or without notice, and with or without stating a reason',
        },
        '. You acknowledge and agree that we may:'
      ),
      list(
        [
          { bold: 'Review and approve access requests' },
          ' — new accounts start as pending and gain access only when approved; we may approve, deny, or leave pending any request;',
        ],
        [
          { bold: 'Refuse signups' },
          ' — including barring specific email addresses from registering (before or after a denial);',
        ],
        [{ bold: 'Suspend, block, reactivate, or terminate accounts' }, ', in whole or in part;'],
        [
          { bold: 'Enable or disable features per user or globally' },
          ' — including disabling Vera for an individual account or for everyone;',
        ],
        [
          { bold: 'Take the Service (web, mobile, or both) offline' },
          ' for maintenance, incident response, cost control, or any other reason, for any duration;',
        ],
        [
          { bold: 'Send service announcements and administrative communications' },
          ' related to your account or the Service;',
        ],
        [
          { bold: 'Monitor, log, and audit' },
          ' service usage, administrative actions, and AI-assistant activity to operate, secure, and improve the Service; and',
        ],
        [
          { bold: 'Delete an account and its associated data' },
          ', including where required for security, legal, abuse-related, or operational reasons.',
        ]
      ),
      p(
        'These controls are an agreed condition of using a free, invite-only beta. You agree that exercising (or declining to exercise) any of them does not breach these Terms, entitles you to no compensation, and gives rise to no claim against any Operator Party. Where practical we may tell you why an action was taken, but we are not obligated to. If your account is blocked or denied you may contact us through the in-app message form, but any reinstatement is at our discretion.'
      ),
    ],
  },
  {
    n: '9',
    title: 'Acceptable use',
    blocks: [
      p('You agree not to:'),
      list(
        ['use the Service for any unlawful purpose or in violation of these Terms;'],
        [
          'probe, scan, overload, disrupt, or attempt to gain unauthorized access to the Service, other accounts, or underlying systems;',
        ],
        ['scrape, harvest, or bulk-export data other than through the export features provided;'],
        [
          'reverse engineer, copy, resell, or create derivative works of the Service except where such a restriction is prohibited by law;',
        ],
        [
          'misuse Vera, including attempts to extract system prompts, bypass safeguards, or generate abusive content; or',
        ],
        ['impersonate any person or misrepresent your affiliation.']
      ),
      p('Violations may result in immediate suspension or termination under Section 8.'),
    ],
  },
  {
    n: '10',
    title: 'Your content and license to us',
    blocks: [
      p(
        'You retain ownership of the data you submit or connect to the Service. You grant us a worldwide, non-exclusive, royalty-free license to host, store, process, transmit, display, and back up that data solely to operate, secure, maintain, and improve the Service, including processing through the third-party providers described in Section 6. This license ends when your data is deleted from the Service, subject to residual copies in routine backups and records we are required to keep.'
      ),
    ],
  },
  {
    n: '11',
    title: 'Intellectual property',
    blocks: [
      p(
        'The Service — including its software, design, text, graphics, logos, and the Fortuneer and Vera names — is owned by the Operator Parties or their licensors and protected by intellectual-property laws. Except for the limited right to use the Service under these Terms, no rights are granted to you.'
      ),
    ],
  },
  {
    n: '12',
    title: 'Fees',
    blocks: [
      p(
        'The Service is currently provided free of charge during the beta. We may introduce fees or paid tiers in the future; if we do, we will give notice and no fee will apply to you without your agreement. Providing the Service free of charge is not a commitment to continue doing so, or to continue providing the Service at all.'
      ),
    ],
  },
  {
    n: '13',
    title: 'Privacy',
    blocks: [
      p(
        'We collect and process account information, connected financial data, usage logs, support messages, and Vera conversations as needed to provide the Service, as described in these Terms. We do not sell your personal data. You can export your data (CSV) and delete your account — which revokes bank connections and deletes your associated data — from Settings at any time.'
      ),
    ],
  },
  {
    n: '14',
    title: 'Termination',
    blocks: [
      p(
        'You may stop using the Service and delete your account at any time. We may suspend or terminate your access as described in Section 8, or discontinue the Service entirely. Upon termination, your right to use the Service ends immediately; deletion of an account deletes its associated data, which cannot be recovered. Sections that by their nature should survive (including Sections 3, 4, 10, 11, and 15–19) survive termination.'
      ),
    ],
  },
  {
    n: '15',
    title: 'Disclaimer of warranties',
    blocks: [
      caps(
        'The Service is provided “as is” and “as available”, with all faults and without warranty of any kind. To the maximum extent permitted by law, the Operator Parties disclaim all warranties, express, implied, or statutory — including merchantability, fitness for a particular purpose, title, non-infringement, accuracy, availability, and uninterrupted or error-free operation. No advice or information obtained from the Service creates any warranty.'
      ),
    ],
  },
  {
    n: '16',
    title: 'Limitation of liability',
    blocks: [
      caps(
        'To the maximum extent permitted by law, no Operator Party will be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, savings, investment gains, data, goodwill, or opportunity — including losses arising from financial decisions made in reliance on the Service, inaccurate or delayed data, AI-assistant output, projections, unavailability or discontinuation of the Service or any feature, administrative actions under Section 8, or unauthorized access — even if advised of the possibility of such damages.'
      ),
      caps(
        'To the maximum extent permitted by law, the aggregate liability of all Operator Parties for all claims relating to the Service is limited to the greater of the amount you paid us for the Service in the twelve months before the claim arose, or fifty U.S. dollars (US$50).'
      ),
      p(
        'Some jurisdictions do not allow certain exclusions or limitations; in those jurisdictions, the above apply to the fullest extent permitted, and nothing in these Terms excludes liability that cannot lawfully be excluded (such as for fraud, or for death or personal injury caused by negligence).'
      ),
    ],
  },
  {
    n: '17',
    title: 'Indemnification',
    blocks: [
      p(
        'You agree to indemnify, defend, and hold harmless the Operator Parties from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: your use or misuse of the Service, your violation of these Terms, your violation of any law or third-party right, data or content you submit or connect, or financial decisions made by you or anyone relying on information you obtained from the Service.'
      ),
    ],
  },
  {
    n: '18',
    title: 'Dispute resolution and governing law',
    blocks: [
      p(
        'If you have a dispute, you agree to first contact us through the in-app support form and attempt to resolve it informally for at least 30 days before filing any claim. These Terms are governed by the laws of the State of New Jersey, U.S.A., without regard to conflict-of-laws rules, and any claim must be brought exclusively in the state or federal courts located in New Jersey, whose jurisdiction you accept. ',
        {
          bold: 'To the extent permitted by law, you and we each waive any right to a jury trial and agree that claims may be brought only in an individual capacity — not as a plaintiff or class member in any class, consolidated, or representative proceeding.',
        },
        ' Any claim must be filed within one year after it arose, or it is permanently barred, where such a limitation is permitted by law.'
      ),
    ],
  },
  {
    n: '19',
    title: 'Changes to these Terms and to the Service',
    blocks: [
      p(
        'We may update these Terms at any time. When we make a material change, we will present the updated Terms in the app and require your acceptance before continued use; the version and effective date at the top identify the Terms in force. We may also modify, add, remove, or discontinue any part of the Service at any time. Your continued use after a change to the Service constitutes acceptance of the changed Service.'
      ),
    ],
  },
  {
    n: '20',
    title: 'General',
    blocks: [
      p(
        'These Terms are the entire agreement between you and us regarding the Service. If any provision is held unenforceable, it will be enforced to the maximum extent permissible and the remainder stays in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms; we may assign them in connection with a transfer of the Service. Nothing in these Terms creates any partnership, employment, or agency relationship. Notices to you may be given in-app or by email to your registered address.'
      ),
      p('Questions about these Terms can be sent through the in-app support form.'),
    ],
  },
]
