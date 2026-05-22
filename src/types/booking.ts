// Chapter99 — booking records (dashboard / queue)

export interface BookingRoomRef {
  id: string
  name: string
}

export interface BookingRecord {
  id: string
  shopId: string
  clientId?: string | null
  serviceId?: string | null
  staffId?: string | null
  roomId?: string | null
  therapistName?: string | null
  startTime: string
  endTime: string
  status: string
  source?: string
  bookedBy?: string | null
  room?: BookingRoomRef | null
}
