/**
 * Staff dashboard panel — Digital Signage (replaces old TvSignageManager / tv_playlist_items UI).
 *
 * TODO: Reconnect "Generate AI Banner" (Claude copy → canvas PNG → Storage →
 * admin_upsert_signage_asset) as a future enhancement on signage_assets.
 * The old kiosk_content / tv_playlist_items AI banner pipeline is not wired here.
 */

interface Props {
  shopId: string
}

export default function DigitalSignageStaffPanel({ shopId }: Props) {
  const managerUrl = `/admin/signage-manager/${encodeURIComponent(shopId)}`
  const displayUrl = `/signage/${encodeURIComponent(shopId)}`

  return (
    <div
      style={{
        maxWidth: 560,
        padding: '16px 4px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>Digital Signage</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#57534e', lineHeight: 1.45 }}>
        Manage Fire Stick / Fully Kiosk clips and rotation in the Signage Manager.
        The old TV playlist UI has been retired.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <a
          href={managerUrl}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 8,
            background: '#0f6e56',
            color: '#fff',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Open Signage Manager
        </a>
        <a
          href={displayUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 8,
            background: '#fff',
            color: '#111',
            border: '1px solid #d6d3d1',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Open TV display
        </a>
      </div>
    </div>
  )
}
