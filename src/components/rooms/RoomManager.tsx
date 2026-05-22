// Chapter99 V4 — Room management (owner)

import { useState, useEffect } from 'react'
import { addRoom, deleteRoom, fetchRooms } from '../../lib/roomService'
import { supabase, SHOP_ID } from '../../lib/supabase'
import type { Room } from '../../types/room'
import Toast, { type ToastType } from '../ui/Toast'
import './RoomManager.css'

interface RoomManagerProps {
  shopId?: string
}

export default function RoomManager({ shopId = SHOP_ID }: RoomManagerProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Room | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  useEffect(() => {
    loadRooms()
  }, [shopId])

  async function loadRooms() {
    setLoading(true)
    setError('')
    try {
      setRooms(await fetchRooms(supabase, shopId, { activeOnly: false }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rooms')
      setRooms([])
    }
    setLoading(false)
  }

  function startAdd() {
    setNewName('')
    setShowForm(true)
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSaving(true)
    const result = await addRoom(supabase, shopId, trimmed)
    setSaving(false)
    if (result.error) {
      setToast({ message: result.error, type: 'error' })
      return
    }
    setShowForm(false)
    setNewName('')
    setToast({ message: 'Room added', type: 'success' })
    await loadRooms()
  }

  async function handleDelete(room: Room) {
    const result = await deleteRoom(supabase, shopId, room.id)
    setConfirmDelete(null)
    if (!result.ok) {
      setToast({ message: result.error ?? 'Delete failed', type: 'error' })
      return
    }
    setToast({ message: 'Room removed', type: 'success' })
    await loadRooms()
  }

  return (
    <div className="rooms-manager">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="rooms-header">
        <h2 className="rooms-title">Rooms</h2>
        <button type="button" className="add-room-btn" onClick={startAdd}>
          + Add room
        </button>
      </div>

      <p className="rooms-hint">
        Treatment rooms for queue assignment and walk-in bookings (e.g. Room 1, 4444).
      </p>

      {error && <div className="rooms-error">{error}</div>}
      {loading && <div className="rooms-loading">Loading rooms…</div>}

      {!loading && (
        <div className="rooms-list">
          {rooms.length === 0 && (
            <p className="rooms-empty">No rooms yet. Add your first room.</p>
          )}
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-card-main">
                <div className="room-name">{room.name}</div>
                <div className="room-actions">
                  <button
                    type="button"
                    className="room-btn danger"
                    onClick={() => setConfirmDelete(room)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box rooms-modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">Add room</div>
            <input
              className="form-input"
              placeholder="Room name or number"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={saving}
              autoFocus
            />
            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn primary"
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
              >
                {saving ? 'Adding…' : 'Add room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-title">Remove room?</div>
            <p className="rooms-delete-msg">
              Remove &quot;{confirmDelete.name}&quot;? Bookings using this room will be
              unassigned.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn danger"
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
