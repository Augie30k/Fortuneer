export const MIN_PASSWORD_LENGTH = 10

export const PASSWORD_REQUIREMENTS = [
  {
    key: 'length',
    label: `At least ${MIN_PASSWORD_LENGTH} characters`,
    test: (password: string) => password.length >= MIN_PASSWORD_LENGTH,
  },
  {
    key: 'uppercase',
    label: 'An uppercase letter',
    test: (password: string) => /[A-Z]/.test(password),
  },
  {
    key: 'lowercase',
    label: 'A lowercase letter',
    test: (password: string) => /[a-z]/.test(password),
  },
  {
    key: 'number',
    label: 'A number',
    test: (password: string) => /[0-9]/.test(password),
  },
] as const

export function isStrongPassword(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((r) => r.test(password))
}
