import { ForgotPasswordSchema, ResetPasswordSchema } from '../schemas/auth'

describe('Password Reset Schemas', () => {
  describe('ForgotPasswordSchema', () => {
    it('validates a correct username and email address', () => {
      const valid = ForgotPasswordSchema.safeParse({ username: 'admin', email: 'user@example.com' })
      expect(valid.success).toBe(true)
      if (valid.success) {
        expect(valid.data.username).toBe('admin')
        expect(valid.data.email).toBe('user@example.com')
      }
    })

    it('trims whitespace on username and email', () => {
      const valid = ForgotPasswordSchema.safeParse({ username: '  admin  ', email: '  test@domain.com  ' })
      expect(valid.success).toBe(true)
      if (valid.success) {
        expect(valid.data.username).toBe('admin')
        expect(valid.data.email).toBe('test@domain.com')
      }
    })

    it('rejects missing username', () => {
      const invalid = ForgotPasswordSchema.safeParse({ username: '', email: 'test@domain.com' })
      expect(invalid.success).toBe(false)
    })

    it('rejects invalid email formats', () => {
      const invalid = ForgotPasswordSchema.safeParse({ username: 'admin', email: 'not-an-email' })
      expect(invalid.success).toBe(false)
    })
  })

  describe('ResetPasswordSchema', () => {
    it('validates compliant passwords with uppercase, lowercase, and numbers', () => {
      const valid = ResetPasswordSchema.safeParse({
        token: 'valid-random-token-1234567890',
        newPassword: 'Password123'
      })
      expect(valid.success).toBe(true)
    })

    it('rejects password shorter than 8 characters', () => {
      const invalid = ResetPasswordSchema.safeParse({
        token: 'token-123',
        newPassword: 'Pass1'
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain('8 個字元')
      }
    })

    it('rejects password without uppercase letter', () => {
      const invalid = ResetPasswordSchema.safeParse({
        token: 'token-123',
        newPassword: 'password123'
      })
      expect(invalid.success).toBe(false)
    })

    it('rejects password without numbers', () => {
      const invalid = ResetPasswordSchema.safeParse({
        token: 'token-123',
        newPassword: 'PasswordABC'
      })
      expect(invalid.success).toBe(false)
    })

    it('rejects empty token', () => {
      const invalid = ResetPasswordSchema.safeParse({
        token: '',
        newPassword: 'Password123'
      })
      expect(invalid.success).toBe(false)
    })
  })
})
