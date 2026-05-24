export interface ServiceAddon {
  id: string
  shopId: string
  name: string
  price: number
  active: boolean
  createdAt?: string
}

export interface ServiceAddonRow {
  id: string
  shop_id: string
  name: string
  price: number | string
  active: boolean
  created_at?: string
}
