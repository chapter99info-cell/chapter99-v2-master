import { useCallback, useState } from 'react'
import QRCode from 'react-qr-code'
import QRCodeLib from 'qrcode'
import { buildPublicMenuUrl } from '../../lib/menuUrl'
import Toast, { type ToastType } from '../ui/Toast'

interface MenuQrSectionProps {
  shopSlug: string | null | undefined
  shopName: string
}

export default function MenuQrSection({ shopSlug, shopName }: MenuQrSectionProps) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [downloading, setDownloading] = useState(false)

  const slug = shopSlug?.trim().toLowerCase() || ''
  const menuUrl = slug ? buildPublicMenuUrl(slug) : null

  const copyLink = useCallback(async () => {
    if (!menuUrl) return
    try {
      await navigator.clipboard.writeText(menuUrl)
      setToast({ message: 'Menu link copied', type: 'success' })
    } catch {
      setToast({ message: 'Could not copy — select the link and copy manually', type: 'error' })
    }
  }, [menuUrl])

  const downloadQr = useCallback(async () => {
    if (!menuUrl) return
    setDownloading(true)
    try {
      const dataUrl = await QRCodeLib.toDataURL(menuUrl, {
        width: 512,
        margin: 2,
        color: { dark: '#1a3d2b', light: '#ffffff' },
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${slug || 'shop'}-menu-qr.png`
      a.click()
      setToast({ message: 'QR code downloaded', type: 'success' })
    } catch (err) {
      console.error('[MenuQrSection] download failed', err)
      setToast({ message: 'Could not generate QR image', type: 'error' })
    } finally {
      setDownloading(false)
    }
  }, [menuUrl, slug])

  return (
    <section className="ss-section ss-menu-qr">
      <h2 className="ss-section-title">QR Menu</h2>
      <p className="ss-hint">
        Print this QR code for tables or reception. Customers scan to view your digital menu — no
        login required.
      </p>

      {!slug ? (
        <p className="ss-error" style={{ marginTop: 12 }}>
          Set a shop URL slug in Super Admin (Website settings) before generating a menu QR code.
        </p>
      ) : (
        <>
          <div className="ss-menu-qr-preview">
            <div className="ss-menu-qr-card">
              <QRCode
                value={menuUrl!}
                size={200}
                level="M"
                bgColor="#ffffff"
                fgColor="#1a3d2b"
              />
            </div>
            <div className="ss-menu-qr-meta">
              <p className="ss-menu-qr-shop">{shopName}</p>
              <a
                href={menuUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="ss-menu-qr-link"
              >
                {menuUrl}
              </a>
            </div>
          </div>

          <div className="ss-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="ss-btn primary"
              disabled={downloading}
              onClick={() => void downloadQr()}
            >
              {downloading ? 'Generating…' : 'Download QR (PNG)'}
            </button>
            <button type="button" className="ss-btn secondary" onClick={() => void copyLink()}>
              Copy link
            </button>
            <a
              href={menuUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="ss-btn secondary"
            >
              Open menu
            </a>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  )
}
