import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runCronAlerts } from '../../server/cronAlerts'
import { runCronBookingReminders } from '../../server/cronBookingReminders'
import { runCronDailySheets } from '../../server/cronDailySheets'
import { runCronDailyReport } from '../../server/cronDailyReport'
import { runCronWinback } from '../../server/cronWinback'
import { runCronBirthday } from '../../server/cronBirthday'
import { runCronReviewSentiment } from '../../server/reviewSentimentCore'

const JOBS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>> = {
  'daily-sheets': runCronDailySheets,
  alerts: runCronAlerts,
  'booking-reminders': runCronBookingReminders,
  'daily-report': runCronDailyReport,
  winback: runCronWinback,
  birthday: runCronBirthday,
  'review-sentiment': runCronReviewSentiment,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.job
  const job = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  const run = JOBS[job]
  if (!run) {
    return res.status(404).json({ error: `Unknown cron job: ${job}` })
  }
  return run(req, res)
}
