import { emailColors, emailStyles as styles } from './email-theme'

export interface DenialEmailProps {
  /** Recipient's display name; falls back to a neutral greeting when absent. */
  fullName?: string | null
}

/** Sent when an admin denies a pending access request. Deliberately neutral:
 *  it never mentions blocking or the quarantine list, just that the request
 *  wasn't approved, with a reply path for appeals. */
export default function DenialEmail({ fullName }: DenialEmailProps) {
  const firstName = fullName?.trim().split(' ')[0]

  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- this is a standalone email document rendered by @react-email/render, not a Next.js page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>About your Fortuneer request</title>
      </head>
      <body style={styles.body}>
        <span style={styles.preheader}>An update on your Fortuneer access request.</span>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: emailColors.background, padding: '40px 16px' }}
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
                      <td style={{ padding: '0 32px 12px' }}>
                        <p style={styles.heading}>About your request</p>
                        <p style={styles.paragraph}>{firstName ? `Hi ${firstName},` : 'Hi,'}</p>
                        <p style={styles.paragraph}>
                          Thanks for your interest in Fortuneer. After review, we aren&apos;t able to
                          approve your access request at this time.
                        </p>
                        <p style={styles.paragraph}>
                          If you believe this is a mistake, just reply to this email and we&apos;ll
                          take another look.
                        </p>
                        <p style={styles.paragraph}>— The Fortuneer team</p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '20px 32px 32px', borderTop: `1px solid ${emailColors.border}` }}>
                        <p style={styles.muted}>Fortuneer · Pioneer Your Wealth</p>
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
