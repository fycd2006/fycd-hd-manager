import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

export interface SendEmailResult {
  ok: boolean
  id?: string
  error?: string
}

/**
 * Send Password Reset Email via Resend
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  username?: string
): Promise<SendEmailResult> {
  if (!resend) {
    console.warn('[EMAIL] RESEND_API_KEY is not set. Skipped physical email sending. Reset URL:', resetUrl)
    return { ok: false, error: 'RESEND_API_KEY 未設定' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'FYCD HD Manager <onboarding@resend.dev>'
  const displayName = username || to.split('@')[0]

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>重設您的密碼 - FYCD HD Manager</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 40px 20px;
      color: #1e293b;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
      padding: 40px 32px;
      box-sizing: border-box;
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .title {
      font-size: 22px;
      font-weight: 800;
      color: #EA580C;
      margin: 12px 0 4px 0;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .content {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      margin-bottom: 30px;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background-color: #3F6212;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 13px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(63, 98, 18, 0.25);
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      border-top: 1px solid #f1f5f9;
      padding-top: 20px;
      margin-top: 20px;
      text-align: center;
    }
    .url-fallback {
      background-color: #f1f5f9;
      padding: 10px 14px;
      border-radius: 8px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      color: #475569;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">FYCD HD Manager</div>
      <div class="subtitle">雲端資料庫與工作區管理系統</div>
    </div>
    <div class="content">
      <p>親愛的 <strong>${displayName}</strong> 您好：</p>
      <p>我們收到了為您的 FYCD HD Manager 帳號重設密碼的請求。請點擊下方按鈕以設定新密碼：</p>
      
      <div class="btn-container">
        <a href="${resetUrl}" target="_blank" class="btn">立即重設密碼</a>
      </div>

      <p style="font-size: 13px; color: #64748b;">
        ⏱️ 此重設連結於 <strong>30 分鐘內有效</strong>，且僅能使用一次。
      </p>

      <p style="font-size: 12.5px; color: #94a3b8;">
        如果上方按鈕無法點擊，請複製以下連結並貼至瀏覽器網址列開啟：
      </p>
      <div class="url-fallback">${resetUrl}</div>
    </div>
    
    <div class="footer">
      如果您並未發出重設密碼的請求，請忽略此郵件，您的帳號仍然是安全的。<br>
      © ${new Date().getFullYear()} FYCD HD Manager. All rights reserved.
    </div>
  </div>
</body>
</html>
`

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: '[FYCD HD Manager] 重設您的帳號密碼',
      html: htmlContent
    })

    if (error) {
      console.error('[EMAIL] Resend API error:', error)
      return { ok: false, error: error.message }
    }

    console.log(`[EMAIL] Reset password email sent successfully to ${to}. Message ID: ${data?.id}`)
    return { ok: true, id: data?.id }
  } catch (err: any) {
    console.error('[EMAIL] Unexpected error while sending email:', err)
    return { ok: false, error: err?.message || '寄送郵件失敗' }
  }
}
