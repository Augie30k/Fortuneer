import type { CSSProperties } from 'react'

/** Shared look for all Fortuneer transactional email. Hand-rolled inline
 *  styles (no @react-email/components) — email clients need real inline
 *  styles, and table layout is the only reliably supported way to lay things
 *  out across Outlook/Gmail/Apple Mail. Colors and type mirror the app's
 *  light-mode tokens in app/globals.css, since email clients don't render
 *  the dark theme or any external stylesheet. */

export const emailColors = {
  background: '#F5F5F7',
  card: '#FFFFFF',
  foreground: '#1D1D1F',
  muted: '#86868B',
  border: '#E5E5EA',
  primary: '#0071E3',
  primaryDark: '#005BB8',
}

export const emailFontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const emailStyles: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: emailColors.background,
    fontFamily: emailFontFamily,
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
    backgroundColor: emailColors.card,
    borderRadius: 12,
    border: `1px solid ${emailColors.border}`,
    overflow: 'hidden',
  },
  logoMark: {
    display: 'inline-block',
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: emailColors.primary,
    verticalAlign: 'middle',
  },
  wordmark: {
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: emailColors.foreground,
    verticalAlign: 'middle',
    paddingLeft: 10,
  },
  heading: {
    margin: '0 0 12px',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: emailColors.foreground,
  },
  paragraph: {
    margin: '0 0 16px',
    fontSize: 15,
    lineHeight: '24px',
    color: emailColors.foreground,
  },
  muted: {
    margin: 0,
    fontSize: 13,
    lineHeight: '20px',
    color: emailColors.muted,
  },
  button: {
    display: 'inline-block',
    backgroundColor: emailColors.primary,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    padding: '12px 24px',
    borderRadius: 8,
  },
}
