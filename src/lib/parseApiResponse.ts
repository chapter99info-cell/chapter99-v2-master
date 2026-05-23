/** Parse fetch response as JSON; surface plain-text/HTML server errors clearly. */
export async function parseApiJson<T extends Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(`Empty response (${res.status})`)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 200)
    const contentType = res.headers.get('content-type') ?? ''
    if (preview.startsWith('<') || contentType.includes('text/html')) {
      throw new Error(
        `API returned HTML instead of JSON (${res.status}). Deploy /api routes on Vercel or run "vercel dev" locally — not plain "vite".`
      )
    }
    throw new Error(preview || `Request failed (${res.status})`)
  }
}
