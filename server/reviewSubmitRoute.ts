import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './supabaseServer'

interface ReviewSubmitBody {
  bookingId: string
  rating: number
  message?: string
}

export default async function reviewSubmitHandler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body ?? {}) as ReviewSubmitBody
  const bookingId = body.bookingId?.trim()
  const rating = Number(body.rating)

  if (!bookingId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Invalid bookingId or rating' })
  }

  let sb
  try {
    sb = getServiceSupabase()
  } catch {
    return res.status(500).json({ error: 'Server not configured' })
  }

  const { data: booking, error: bookErr } = await sb
    .from('bookings')
    .select('id, shop_id, client_id, shops ( google_review_url )')
    .eq('id', bookingId)
    .maybeSingle()

  if (bookErr || !booking) {
    return res.status(404).json({ error: 'Booking not found' })
  }

  await sb.from('bookings').update({ review_rating: rating }).eq('id', bookingId)

  const shop = booking.shops as { google_review_url?: string | null } | null
  const googleReviewUrl = shop?.google_review_url?.trim() ?? ''

  if (rating >= 4) {
    return res.status(200).json({
      ok: true,
      route: 'google',
      googleReviewUrl: googleReviewUrl || null,
    })
  }

  const { data: complaint, error: compErr } = await sb
    .from('complaints')
    .insert({
      shop_id: booking.shop_id,
      booking_id: bookingId,
      client_id: booking.client_id,
      rating,
      message: body.message?.trim() || null,
      resolved: false,
    })
    .select('id')
    .single()

  if (compErr) {
    return res.status(500).json({ error: compErr.message })
  }

  const alertId = `complaint-${complaint.id}`
  await sb.from('alerts').upsert(
    {
      id: alertId,
      shop_id: booking.shop_id,
      type: 'google_review',
      severity: rating <= 2 ? 'critical' : 'warning',
      title: `Customer complaint — ${rating} stars`,
      message: body.message?.trim() || 'Customer left a low rating — follow up required',
      dismissed: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  return res.status(200).json({
    ok: true,
    route: 'complaint',
    complaintId: complaint.id,
  })
}
