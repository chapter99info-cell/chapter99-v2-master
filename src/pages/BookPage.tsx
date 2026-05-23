import { useShopContext } from '../contexts/ShopContext'
import MassageBookingView from './booking/MassageBookingView'
import RestaurantOrderView from './booking/RestaurantOrderView'
import './PublicSite.css'

export default function BookPage() {
  const { loading, error, businessType } = useShopContext()

  if (loading) {
    return (
      <div className="public-page">
        <p className="public-page-lead">Loading booking…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-page">
        <h1 className="public-page-title">Booking unavailable</h1>
        <p className="public-page-lead">{error}</p>
      </div>
    )
  }

  if (businessType === 'restaurant') {
    return <RestaurantOrderView />
  }

  return <MassageBookingView />
}
