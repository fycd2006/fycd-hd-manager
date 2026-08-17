import { z } from 'zod'

export const RegisterSchema = z.object({
  username: z.string().trim().min(2, '帳號名稱至少需要 2 個字元').max(50, '帳號名稱最多 50 個字元'),
  email: z.string().trim().email('無效的電子郵件格式'),
  password: z.string()
    .min(8, '密碼長度至少需要 8 個字元')
    .regex(/[A-Z]/, '密碼必須包含至少一個大寫英文字母')
    .regex(/[a-z]/, '密碼必須包含至少一個小寫英文字母')
    .regex(/[0-9]/, '密碼必須包含至少一個數字')
})

export const LoginSchema = z.object({
  username: z.string().trim().min(1, '帳號或 Email 為必填'),
  password: z.string().min(1, '密碼為必填')
})

export const ForgotPasswordSchema = z.object({
  username: z.string().trim().min(1, '帳號名稱為必填'),
  email: z.string().trim().email('請輸入有效的電子郵件地址')
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token 為必填'),
  newPassword: z.string()
    .min(8, '密碼長度至少需要 8 個字元')
    .regex(/[A-Z]/, '密碼必須包含至少一個大寫英文字母')
    .regex(/[a-z]/, '密碼必須包含至少一個小寫英文字母')
    .regex(/[0-9]/, '密碼必須包含至少一個數字')
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

