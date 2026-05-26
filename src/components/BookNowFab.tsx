const MESSENGER_URL = 'https://m.me/TriptoTalk'

export default function BookNowFab() {
  return (
    <a
      href={MESSENGER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="book-now-fab"
      aria-label="Book a trip on Facebook Messenger"
    >
      <span className="book-now-fab__pulse" aria-hidden />
      <span className="book-now-fab__label">💬 จองทริป / Book Now</span>
    </a>
  )
}
