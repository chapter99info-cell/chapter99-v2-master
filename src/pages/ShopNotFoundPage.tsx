import { CHAPTER99_WHATSAPP } from '../lib/featureGate'

export default function ShopNotFoundPage() {
  const whatsappUrl = `https://wa.me/${CHAPTER99_WHATSAPP}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F5F0] p-6 text-center">
      <h1 className="text-2xl font-serif text-[#1A1A1A] mb-4">This site is being configured.</h1>
      <p className="text-[#6B7280] max-w-md mb-6">
        Contact Chapter99:{' '}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2D5016] font-semibold no-underline hover:underline"
        >
          wa.me/{CHAPTER99_WHATSAPP}
        </a>
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-lg bg-[#2D5016] px-6 py-3 text-white font-semibold no-underline"
      >
        Contact Chapter99 on WhatsApp
      </a>
    </div>
  )
}
