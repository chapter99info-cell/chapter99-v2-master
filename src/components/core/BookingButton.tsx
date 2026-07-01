import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'

const CORE_BRAND = '#2D5016'

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 24px',
  backgroundColor: CORE_BRAND,
  color: '#FFFFFF',
  borderRadius: '8px',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: '16px',
}

export default function BookingButton() {
  const { withShopQuery, businessType, loading } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const label = loading ? '…' : isRestaurant ? 'Order now' : 'Book now'

  return (
    <Link to={withShopQuery('/book')} style={buttonStyle}>
      {label}
    </Link>
  )
}
