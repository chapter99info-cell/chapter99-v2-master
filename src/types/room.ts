// Chapter99 — treatment rooms

export interface Room {
  id: string
  shopId: string
  name: string
  active: boolean
  createdAt?: string
}

export interface RoomRow {
  id: string
  shop_id: string
  name: string
  active: boolean
  created_at: string
}

export function mapRowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    active: row.active ?? true,
    createdAt: row.created_at,
  }
}
