import { useShopContext } from '../../contexts/ShopContext'

/**
 * Restaurant ordering UI shell — replace with menu/GP/cart flow.
 * Must never load massage booking wizard (business context isolation).
 */
export default function RestaurantOrderView() {
  const { shop } = useShopContext()

  return (
    <div className="public-page public-book-wrap">
      <p className="public-eyebrow">Order online</p>
      <h1 className="public-page-title">{shop?.name || 'Order food'}</h1>
      <p className="public-page-lead">
        Browse the menu by category, add items to your order, and pay at checkout. Table booking
        and kitchen routing will connect here — separate from massage appointment scheduling.
      </p>
      <div className="public-card" style={{ maxWidth: 560, margin: '2rem auto 0' }}>
        <h2 style={{ marginTop: 0 }}>Restaurant module</h2>
        <p>
          This shop is configured as <strong>restaurant</strong>. Implement menu categories (mains /
          snacks / drinks), GP pricing, and cart checkout in{' '}
          <code>src/components/restaurant/</code> — do not reuse BookingWizard.
        </p>
      </div>
    </div>
  )
}
