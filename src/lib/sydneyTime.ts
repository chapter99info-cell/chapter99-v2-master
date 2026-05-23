/** Calendar date YYYY-MM-DD in Australia/Sydney */
export function sydneyYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

/** UTC instant for 00:00:00 on a Sydney calendar day (YYYY-MM-DD). */
export function sydneyDayStartUtc(ymd: string): Date {
  const noonUtc = new Date(`${ymd}T12:00:00.000Z`)
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(noonUtc)
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12)
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  const second = Number(parts.find(p => p.type === 'second')?.value ?? 0)
  const msFromMidnight = (hour * 3600 + minute * 60 + second) * 1000
  return new Date(noonUtc.getTime() - msFromMidnight)
}

/** UTC instant for end of Sydney calendar day (next midnight, exclusive upper bound). */
export function sydneyDayEndExclusiveUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const nextYmd = next.toISOString().slice(0, 10)
  return sydneyDayStartUtc(nextYmd)
}
