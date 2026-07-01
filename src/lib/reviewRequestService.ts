export type ReviewRequestChannel = 'email' | 'sms' | 'both'

export interface ReviewRequestPayload {
  shopId: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
}

export interface ReviewRequestResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  error?: string
  sent?: { email?: boolean; sms?: boolean }
}

/** Fire-and-forget after POS checkout — logs errors, never blocks UI. */
export async function sendReviewRequestAfterCheckout(
  payload: ReviewRequestPayload
): Promise<ReviewRequestResult> {
  const email = payload.clientEmail?.trim()
  const phone = payload.clientPhone?.trim()
  if (!email && !phone) {
    return { ok: true, skipped: true, reason: 'no_contact' }
  }

  try {
    const res = await fetch('/api/review/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as ReviewRequestResult & {
      error?: string
    }
    if (!res.ok) {
      console.error('[reviewRequest] API error', data.error ?? res.status)
      return { ok: false, error: data.error ?? 'Review request failed' }
    }
    if (data.skipped) {
      console.log('[reviewRequest] skipped', data.reason)
    } else {
      console.log('[reviewRequest] sent', data.sent)
    }
    return data
  } catch (err) {
    console.error('[reviewRequest] request failed', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function sendReviewRequestPreview(
  shopId: string,
  channel: ReviewRequestChannel,
  toEmail: string,
  toPhone?: string
): Promise<ReviewRequestResult> {
  try {
    const res = await fetch('/api/review/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId,
        preview: true,
        previewChannel: channel,
        clientEmail: toEmail,
        clientPhone: toPhone,
        clientName: 'Preview Guest',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as ReviewRequestResult & {
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Preview failed' }
    }
    return { ok: true, sent: data.sent }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
