/** Trip2Talk brand mark — circular crop, white backing for transparent PNGs */

export const TRIP2TALK_LOGO_SRC = '/trip2talk-logo.png'

export type Trip2TalkLogoSize = 'pin' | 'nav' | number

const SIZE_PX: Record<'pin' | 'nav', number> = {
  pin: 80,
  nav: 40,
}

type Trip2TalkLogoProps = {
  size?: Trip2TalkLogoSize
  className?: string
  alt?: string
}

export default function Trip2TalkLogo({
  size = 'nav',
  className = '',
  alt = 'Trip2Talk',
}: Trip2TalkLogoProps) {
  const px = typeof size === 'number' ? size : SIZE_PX[size]

  return (
    <img
      src={TRIP2TALK_LOGO_SRC}
      alt={alt}
      width={px}
      height={px}
      className={`trip2talk-logo ${className}`.trim()}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        objectFit: 'cover',
        background: '#ffffff',
        flexShrink: 0,
      }}
    />
  )
}
