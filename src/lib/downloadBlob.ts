/**
 * Trigger a file download from a Blob.
 * Appends a temporary <a> to the document and delays revokeObjectURL
 * so desktop Chrome/Safari handle async-generated files reliably.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const win = window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string
      types?: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<FileSystemFileHandle>
  }

  if (win.showSaveFilePicker) {
    try {
      const isPdf = filename.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf'
      const handle = await win.showSaveFilePicker({
        suggestedName: filename,
        types: isPdf
          ? [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
          : undefined,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}
