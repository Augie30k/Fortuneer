import { emailColors, emailStyles as styles } from './email-theme'

export interface BroadcastEmailProps {
  /** Email heading — usually the same as the subject line. */
  subject: string
  /** Plain-text body; blank lines split it into paragraphs. */
  body: string
}

/** Announcement email sent from The Hub's Broadcast page to every active
 *  user — product updates, downtime notices, and the like. */
export default function BroadcastEmail({ subject, body }: BroadcastEmailProps) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- this is a standalone email document rendered by @react-email/render, not a Next.js page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{subject}</title>
      </head>
      <body style={styles.body}>
        <span style={styles.preheader}>{paragraphs[0] ?? subject}</span>
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
                        <p style={styles.heading}>{subject}</p>
                        {paragraphs.map((p, i) => (
                          <p key={i} style={{ ...styles.paragraph, whiteSpace: 'pre-line' }}>
                            {p}
                          </p>
                        ))}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '20px 32px 32px', borderTop: `1px solid ${emailColors.border}` }}>
                        <p style={styles.muted}>
                          Fortuneer · Pioneer Your Wealth
                          <br />
                          You&apos;re receiving this because you have a Fortuneer account.
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
