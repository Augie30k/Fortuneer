import { emailColors, emailStyles as styles } from './email-theme'

export interface SupportReplyEmailProps {
  /** Recipient's display name; falls back to a neutral greeting when absent. */
  fullName?: string | null
  /** Subject line of the ticket being answered. */
  ticketSubject: string
  /** Plain-text reply; blank lines split it into paragraphs. */
  replyBody: string
  /** The user's original message, quoted below the reply for context. */
  originalMessage: string
}

/** Reply to a support/feature request, sent from The Hub's Support page. */
export default function SupportReplyEmail({
  fullName,
  ticketSubject,
  replyBody,
  originalMessage,
}: SupportReplyEmailProps) {
  const firstName = fullName?.trim().split(' ')[0]
  const paragraphs = replyBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-head-element -- this is a standalone email document rendered by @react-email/render, not a Next.js page */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Re: {ticketSubject}</title>
      </head>
      <body style={styles.body}>
        <span style={styles.preheader}>{paragraphs[0] ?? `A reply to your request: ${ticketSubject}`}</span>
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
                        <p style={styles.heading}>Re: {ticketSubject}</p>
                        <p style={styles.paragraph}>{firstName ? `Hi ${firstName},` : 'Hi,'}</p>
                        {paragraphs.map((p, i) => (
                          <p key={i} style={{ ...styles.paragraph, whiteSpace: 'pre-line' }}>
                            {p}
                          </p>
                        ))}
                        <p style={styles.paragraph}>— The Fortuneer team</p>
                        <table
                          role="presentation"
                          width="100%"
                          cellPadding={0}
                          cellSpacing={0}
                          style={{ margin: '8px 0 24px' }}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  borderLeft: `3px solid ${emailColors.border}`,
                                  padding: '4px 0 4px 12px',
                                }}
                              >
                                <p style={{ ...styles.muted, marginBottom: 4 }}>You wrote:</p>
                                <p style={{ ...styles.muted, whiteSpace: 'pre-line' }}>{originalMessage}</p>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '20px 32px 32px', borderTop: `1px solid ${emailColors.border}` }}>
                        <p style={styles.muted}>
                          Fortuneer · Pioneer Your Wealth
                          <br />
                          Need more help? Reply from the Support page in the app.
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
