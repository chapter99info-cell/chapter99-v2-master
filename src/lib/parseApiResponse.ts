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
    const preview = text.replace(/\s+/g, ' ').slice(0, 120)
    throw new Error(
      preview.startsWith('<')
        ? `Server error (${res.status}) — check API logs`
        : preview || `Request failed (${res.status})`
    )
  }
}
