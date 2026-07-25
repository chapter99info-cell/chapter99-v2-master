import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { SignageRotation } from '../../lib/signageService'
import {
  adminDeleteSignageAsset,
  adminListSignage,
  adminUpdateSignageConfig,
  adminUpsertSignageAsset,
  uploadSignageClip,
  type SignageAdminAsset,
  type SignageAdminConfig,
} from '../../lib/signageAdminService'
import './SignageManager.css'

type Session = { pin: string; level: string; staffName?: string }

export default function SignageManagerPage() {
  const { shopId: rawId } = useParams<{ shopId: string }>()
  const shopId = rawId?.trim() || ''

  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  const [assets, setAssets] = useState<SignageAdminAsset[]>([])
  const [config, setConfig] = useState<SignageAdminConfig>({
    rotation: 0,
    refreshIntervalMinutes: 360,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const verifyPin = useCallback(
    async (pinToVerify: string) => {
      if (!shopId || pinToVerify.length !== 4) return
      setPinLoading(true)
      setPinError('')
      const { data } = await supabase.rpc('verify_pin', {
        p_shop_id: shopId,
        p_pin: pinToVerify,
      })
      setPinLoading(false)
      const row = (data ?? {}) as { success?: boolean; level?: string; staffName?: string; error?: string }
      if (!row.success) {
        setPinError(row.error || 'Invalid PIN')
        setPin('')
        return
      }
      if (row.level !== 'owner' && row.level !== 'super_admin') {
        setPinError('Owner or Super Admin PIN required')
        setPin('')
        return
      }
      setSession({
        pin: pinToVerify,
        level: row.level,
        staffName: row.staffName,
      })
      setPin('')
    },
    [shopId]
  )

  const reload = useCallback(async () => {
    if (!shopId || !session) return
    setLoading(true)
    setError(null)
    const res = await adminListSignage(shopId, session.pin)
    if (!res.ok) {
      setError(res.error || 'Failed to load')
      if (res.error?.toLowerCase().includes('pin')) setSession(null)
    } else {
      setAssets(res.assets)
      setConfig(res.config)
    }
    setLoading(false)
  }, [shopId, session])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onUpload(files: FileList | null) {
    if (!files?.length || !session || !shopId) return
    const file = files[0]
    setBusy(true)
    setError(null)
    try {
      const up = await uploadSignageClip(shopId, file)
      if (!up.url) throw new Error(up.error || 'Upload failed')
      const nextOrder =
        assets.reduce((m, a) => Math.max(m, a.sortOrder), -1) + 1
      const res = await adminUpsertSignageAsset(shopId, session.pin, {
        videoUrl: up.url,
        sortOrder: nextOrder,
        active: true,
      })
      if (!res.ok) throw new Error(res.error || 'Save failed')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function toggleActive(row: SignageAdminAsset) {
    if (!session) return
    setBusy(true)
    setError(null)
    const res = await adminUpsertSignageAsset(shopId, session.pin, {
      id: row.id,
      videoUrl: row.videoUrl,
      sortOrder: row.sortOrder,
      active: !row.active,
    })
    if (!res.ok) setError(res.error || 'Update failed')
    else await reload()
    setBusy(false)
  }

  async function onDelete(row: SignageAdminAsset) {
    if (!session) return
    if (!window.confirm(`Delete clip?\n${row.videoUrl}`)) return
    setBusy(true)
    setError(null)
    const res = await adminDeleteSignageAsset(shopId, session.pin, row.id)
    if (!res.ok) setError(res.error || 'Delete failed')
    else await reload()
    setBusy(false)
  }

  async function saveConfig() {
    if (!session) return
    setBusy(true)
    setError(null)
    const res = await adminUpdateSignageConfig(shopId, session.pin, {
      rotation: config.rotation,
      refreshIntervalMinutes: config.refreshIntervalMinutes,
    })
    if (!res.ok) setError(res.error || 'Config save failed')
    setBusy(false)
  }

  if (!shopId) {
    return (
      <div className="sm-root">
        <p className="sm-error">Missing shopId in URL</p>
      </div>
    )
  }

  if (!session) {
    return (
      <SignagePinScreen
        shopId={shopId}
        pin={pin}
        setPin={setPin}
        onVerify={verifyPin}
        error={pinError}
        loading={pinLoading}
      />
    )
  }

  return (
    <div className="sm-root">
      <header className="sm-header">
        <div>
          <h1 className="sm-title">Signage Manager</h1>
          <p className="sm-sub">
            Shop <code>{shopId}</code>
            {session.staffName ? ` · ${session.staffName}` : ''} ({session.level})
          </p>
        </div>
        <div className="sm-header-actions">
          <a
            className="sm-btn sm-btn-secondary"
            href={`/signage/${encodeURIComponent(shopId)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open display
          </a>
          <button
            type="button"
            className="sm-btn sm-btn-secondary"
            onClick={() => setSession(null)}
          >
            Lock
          </button>
        </div>
      </header>

      {error ? <div className="sm-error">{error}</div> : null}

      <section className="sm-card">
        <h2>Display config</h2>
        <div className="sm-row">
          <label>
            Rotation
            <select
              value={config.rotation}
              disabled={busy}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  rotation: Number(e.target.value) as SignageRotation,
                }))
              }
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </label>
          <label>
            Cache refresh (minutes)
            <input
              type="number"
              min={1}
              max={10080}
              value={config.refreshIntervalMinutes}
              disabled={busy}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  refreshIntervalMinutes: Math.max(1, Number(e.target.value) || 1),
                }))
              }
            />
          </label>
          <button
            type="button"
            className="sm-btn"
            disabled={busy}
            onClick={() => void saveConfig()}
          >
            Save config
          </button>
        </div>
      </section>

      <section className="sm-card">
        <div className="sm-row sm-row-between">
          <h2>Video clips</h2>
          <button
            type="button"
            className="sm-btn"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Upload clip
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>

        {loading ? (
          <p className="sm-muted">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="sm-muted">No clips yet. Upload an MP4 to get started.</p>
        ) : (
          <ul className="sm-list">
            {assets.map((row) => (
              <li key={row.id} className={row.active ? '' : 'inactive'}>
                <div className="sm-clip-meta">
                  <span className="sm-order">#{row.sortOrder}</span>
                  <a href={row.videoUrl} target="_blank" rel="noreferrer">
                    {row.videoUrl.split('/').pop()}
                  </a>
                </div>
                <div className="sm-clip-actions">
                  <button
                    type="button"
                    className="sm-btn sm-btn-secondary"
                    disabled={busy}
                    onClick={() => void toggleActive(row)}
                  >
                    {row.active ? 'Active' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className="sm-btn sm-btn-danger"
                    disabled={busy}
                    onClick={() => void onDelete(row)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SignagePinScreen({
  shopId,
  pin,
  setPin,
  onVerify,
  error,
  loading,
}: {
  shopId: string
  pin: string
  setPin: Dispatch<SetStateAction<string>>
  onVerify: (pin: string) => void
  error: string
  loading: boolean
}) {
  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  function press(key: string) {
    if (loading) return
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1))
      return
    }
    if (key === '' || pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) onVerify(next)
  }

  return (
    <div className="sm-pin">
      <div className="sm-pin-brand">Chapter99</div>
      <div className="sm-pin-title">Signage Manager</div>
      <p className="sm-pin-sub">Owner PIN · {shopId}</p>
      <div className="sm-pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`sm-pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>
      {error ? <div className="sm-error">{error}</div> : null}
      <div className="sm-pin-pad">
        {numpad.map((key, i) => (
          <button
            key={`${key}-${i}`}
            type="button"
            className="sm-pin-key"
            disabled={key === '' || loading}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
