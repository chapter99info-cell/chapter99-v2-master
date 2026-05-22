export interface BookingConfirmationEmailPayload {
  to: string
  clientName: string
  serviceName: string
  durationMin: number
  date: string
  time: string
  therapistLabel: string
  shopName: string
  shopAddress?: string
  shopPhone?: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildBookingConfirmationSubject(shopName: string): string {
  return `Booking confirmed — ${shopName}`
}

export function buildBookingConfirmationText(p: BookingConfirmationEmailPayload): string {
  return `Hi ${p.clientName},

Your appointment is confirmed at ${p.shopName}.

Service: ${p.serviceName} (${p.durationMin} minutes)
Date: ${p.date}
Time: ${p.time}
Therapist: ${p.therapistLabel}

${p.shopAddress ? `Address: ${p.shopAddress}\n` : ''}${p.shopPhone ? `Phone: ${p.shopPhone}\n` : ''}
We look forward to seeing you.

— ${p.shopName}`
}

export function buildBookingConfirmationHTML(p: BookingConfirmationEmailPayload): string {
  const shop = escapeHtml(p.shopName)
  const name = escapeHtml(p.clientName)
  const service = escapeHtml(p.serviceName)
  const date = escapeHtml(p.date)
  const time = escapeHtml(p.time)
  const therapist = escapeHtml(p.therapistLabel)
  const address = p.shopAddress ? escapeHtml(p.shopAddress) : ''
  const phone = p.shopPhone ? escapeHtml(p.shopPhone) : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f0efe8;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0efe8;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd5;">
        <tr>
          <td style="background:#1B4D3E;padding:28px 24px;text-align:center;">
            <p style="margin:0;font-size:22px;color:#F5F0E6;font-weight:600;">${shop}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#C9A227;letter-spacing:0.12em;text-transform:uppercase;">Booking confirmed</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;color:#2c2c2c;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 20px;">Your appointment has been confirmed. Here are your details:</p>
            <table width="100%" style="background:#f8f7f4;border-radius:8px;padding:4px 0;">
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Service</span><br><strong>${service}</strong> · ${p.durationMin} min</td></tr>
              <tr><td style="padding:10px 16px;border-bottom:1px solid #e8e6e0;"><span style="color:#666;font-size:13px;">Date & time</span><br><strong>${date}</strong> at <strong>${time}</strong></td></tr>
              <tr><td style="padding:10px 16px;"><span style="color:#666;font-size:13px;">Therapist</span><br><strong>${therapist}</strong></td></tr>
            </table>
            ${address ? `<p style="margin:20px 0 4px;font-size:14px;color:#555;"><strong>Address:</strong> ${address}</p>` : ''}
            ${phone ? `<p style="margin:4px 0 0;font-size:14px;color:#555;"><strong>Phone:</strong> ${phone}</p>` : ''}
            <p style="margin:24px 0 0;font-size:14px;color:#555;">We look forward to seeing you.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8f7f4;text-align:center;font-size:11px;color:#999;">
            Powered by Chapter99
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
