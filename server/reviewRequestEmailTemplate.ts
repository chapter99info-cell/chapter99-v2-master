export type ReviewRequestChannel = 'email' | 'sms' | 'both'

export interface ReviewRequestEmailPayload {
  to: string
  clientName?: string
  shopName: string
  googleReviewUrl: string
  logoUrl?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReviewRequestSubject(shopName: string): string {
  return `Thank you for visiting ${shopName}!`
}

export function buildReviewRequestText(p: ReviewRequestEmailPayload): string {
  const name = p.clientName?.trim() || 'there'
  return `Hi ${name},

Thank you for visiting ${p.shopName}! We hope you had a wonderful experience.

We'd love to hear your feedback on Google:
${p.googleReviewUrl}

Thank you,
${p.shopName}`
}

export function buildReviewRequestHTML(p: ReviewRequestEmailPayload): string {
  const shop = escapeHtml(p.shopName)
  const name = escapeHtml(p.clientName?.trim() || 'there')
  const reviewUrl = escapeHtml(p.googleReviewUrl)
  const logo = p.logoUrl?.trim() ? escapeHtml(p.logoUrl.trim()) : ''

  const logoBlock = logo
    ? `<img src="${logo}" alt="${shop}" width="72" height="72" style="display:block;margin:0 auto 16px;border-radius:8px;object-fit:contain;" />`
    : `<div style="font-size:20px;font-weight:700;color:#1a3d2b;margin:0 0 12px;">${shop}</div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank you for visiting ${shop}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">
          <tr>
            <td style="background:#1a3d2b;padding:28px 24px;text-align:center;">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 12px;font-size:22px;color:#1a3d2b;">Thank you for visiting ${shop}!</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#444;">Hi ${name},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444;">
                We hope you had a wonderful experience with us today. Your feedback helps us improve and helps others discover ${shop}.
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#444;font-weight:600;">
                We'd love to hear your feedback
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:999px;background:#1a3d2b;">
                    <a href="${reviewUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">
                      Leave a Google Review
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#888;text-align:center;">
                If the button doesn't work, copy this link:<br>
                <a href="${reviewUrl}" style="color:#1a3d2b;word-break:break-all;">${reviewUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#999;text-align:center;">
          Powered by Chapter99 · chapter99solutions.com.au
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildReviewRequestSms(shopName: string, googleReviewUrl: string): string {
  return `Thanks for visiting ${shopName}! We'd love your review: ${googleReviewUrl} Reply STOP to unsubscribe`
}
