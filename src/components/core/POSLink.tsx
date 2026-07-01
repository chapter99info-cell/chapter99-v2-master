import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'

const CORE_BRAND = '#2D5016'

const linkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  border: `2px solid ${CORE_BRAND}`,
  color: CORE_BRAND,
  borderRadius: '8px',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: '14px',
}

export default function POSLink() {
  const { withShopQuery } = useShopContext()

  return (
    <Link to={withShopQuery('/cashier')} style={linkStyle}>
      POS / ระบบขายหน้าร้าน
    </Link>
  )
}
