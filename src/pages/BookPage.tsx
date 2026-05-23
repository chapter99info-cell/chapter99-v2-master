import { useEffect, useState } from 'react'
import BookingWizard from '../components/booking/BookingWizard'
import { fetchShop } from '../lib/shopService'
import { SHOP_ID } from '../lib/supabase'
import './PublicSite.css'

export default function BookPage() {
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    fetchShop(SHOP_ID).then(shop => setShopName(shop.name))
  }, [])

  return (
    <div className="public-page public-book-wrap">
      <p className="public-eyebrow">Online booking</p>
      <h1 className="public-page-title">{shopName || 'Book your appointment'}</h1>
      <p className="public-page-lead">
        Choose your treatment, preferred time, and therapist. Confirmation by email — no account
        needed.
      </p>
      <BookingWizard shopId={SHOP_ID} variant="public" />
    </div>
  )
}
