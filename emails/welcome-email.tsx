import type { CSSProperties } from 'react'

/** Hand-rolled, table-based markup (no @react-email/components) — email
 *  clients need real inline styles, and table layout is the only reliably
 *  supported way to lay things out across Outlook/Gmail/Apple Mail. Colors
 *  and type mirror the app's light-mode tokens in app/globals.css, since
 *  email clients don't render the dark theme or any external stylesheet. */

const colors = {
  background: '#F5F5F7',
  card: '#FFFFFF',
  foreground: '#1D1D1F',
  muted: '#86868B',
  border: '#E5E5EA',
  primary: '#0071E3',
  primaryDark: '#005BB8',
}

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

const styles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: colors.background,
    fontFamily,
  },
  preheader: {
    display: 'none',
    overflow: 'hidden',
    lineHeight: '1px',
    opacity: 0,
    maxHeight: 0,
    maxWidth: 0,
  },
  card: {
    maxWidth: 480,
    width: '100%',
    margin: '0 auto',
    backgroundColor: colors.card,
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
  },
  logoMark: {
    display: 'inline-block',
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    verticalAlign: 'middle',
  },
  wordmark: {
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: colors.foreground,
    verticalAlign: 'middle',
    paddingLeft: 10,
  },
  heading: {
    margin: '0 0 12px',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: colors.foreground,
  },
  paragraph: {
    margin: '0 0 16px',
    fontSize: 15,
    lineHeight: '24px',
    color: colors.foreground,
  },
  muted: {
    margin: 0,
    fontSize: 13,
    lineHeight: '20px',
    color: colors.muted,
  },
  button: {
    display: 'inline-block',
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    padding: '12px 24px',
    borderRadius: 8,
  },
}

export interface WelcomeEmailProps {
  /** Recipient's display name; falls back to a neutral greeting when absent. */
  fullName?: string | null
  /** Absolute URL to the app's dashboard / sign-in entry point. */
  dashboardUrl: string
}

export default function WelcomeEmail({ fullName, dashboardUrl }: WelcomeEmailProps) {
  const firstName = fullName?.trim().split(' ')[0]

  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- this is a standalone email document rendered by @react-email/render, not a Next.js page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Welcome to Fortuneer</title>
      </head>
      <body style={styles.body}>
        <span style={styles.preheader}>
          Your Fortuneer account has been approved — you&apos;re all set to get started.
        </span>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: colors.background, padding: '40px 16px' }}
        >
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" width="480" cellPadding={0} cellSpacing={0} style={styles.card}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '32px 32px 24px' }}>
                        <span style={styles.logoMark} />
                        <span style={styles.wordmark}>Fortuneer</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0 32px' }}>
                        <p style={styles.heading}>
                          {firstName ? `You're approved, ${firstName}.` : "You're approved."}
                        </p>
                        <p style={styles.paragraph}>
                          Your Fortuneer account has been reviewed and approved. You now have full
                          access — connect your accounts, set budgets, and start tracking your
                          goals.
                        </p>
                        <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 28px' }}>
                          <tbody>
                            <tr>
                              <td style={{ borderRadius: 8, backgroundColor: colors.primary }}>
                                <a href={dashboardUrl} style={styles.button}>
                                  Go to your dashboard
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '20px 32px 32px', borderTop: `1px solid ${colors.border}` }}>
                        <p style={styles.muted}>
                          Fortuneer · Pioneer Your Wealth
                          <br />
                          If you weren&apos;t expecting this email, you can safely ignore it.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
