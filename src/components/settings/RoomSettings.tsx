// Owner — manage treatment rooms

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { addRoom, deleteRoom, fetchRooms } from '../../lib/roomService'
import type { Room } from '../../types/room'
import Toast, { type ToastType } from '../ui/Toast'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

interface RoomSettingsProps {
  shopId: string
}

export default function RoomSettings({ shopId }: RoomSettingsProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRooms(await fetchRooms(supabase, shopId, { activeOnly: false }))
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Could not load rooms',
        type: 'error',
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [shopId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const result = await addRoom(supabase, shopId, newName)
    setSaving(false)
    if (result.error) {
      setToast({ message: result.error, type: 'error' })
      return
    }
    setNewName('')
    setToast({ message: 'Room added', type: 'success' })
    await load()
  }

  async function handleDelete(room: Room) {
    if (!confirm(`Remove "${room.name}"? Bookings using this room will be unassigned.`)) return
    const result = await deleteRoom(supabase, shopId, room.id)
    if (!result.ok) {
      setToast({ message: result.error ?? 'Delete failed', type: 'error' })
      return
    }
    setToast({ message: 'Room removed', type: 'success' })
    await load()
  }

  return (
    <section className="ss-section">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <h2 className="ss-section-title">Rooms</h2>
      <p className="ss-hint" style={{ marginTop: 0 }}>
        Add rooms for queue assignment and walk-in bookings (e.g. Room 1, 4444).
      </p>

      <form className="ss-room-add" onSubmit={handleAdd}>
        <input
          className="ss-input"
          placeholder="Room name or number"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          disabled={saving}
        />
        <button type="submit" className="ss-btn primary" disabled={saving || !newName.trim()}>
          {saving ? 'Adding…' : '+ Add room'}
        </button>
      </form>

      {loading ? (
        <p className="ss-hint">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="ss-hint">No rooms yet — add your first room above.</p>
      ) : (
        <ul className="ss-room-list">
          {rooms.map(room => (
            <li key={room.id} className="ss-room-item">
              <span className="ss-room-name">{room.name}</span>
              <button
                type="button"
                className="ss-btn secondary ss-room-delete"
                onClick={() => handleDelete(room)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
