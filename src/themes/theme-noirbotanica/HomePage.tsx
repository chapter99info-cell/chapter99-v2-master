import { useEffect, useRef } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

// Original theme built for Chapter99 — dark botanical color direction (deep teal +
// lime accent) paired with an original scroll-driven "cinematic stage" parallax
// engine (pinned stage, mouse parallax, scroll-segment fade/scale, infinite card
// slider). Inspired by common scroll-rig techniques (lerp/smoothstep easing,
// sticky-stage scrubbing, cloned-set infinite carousels) — not a copy of any
// specific site's exact code, copy, or hotlinked assets. All imagery below is
// royalty-free Unsplash, matching the rest of this theme system.

const FLOAT_A = 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=900&q=80'
const FLOAT_B = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'
const FLOAT_C = 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80'

const TREATMENTS = [
  { kicker: 'Signature', name: 'Signature Oil Massage', desc: 'A full-body ritual built around slow, deliberate pressure.' },
  { kicker: 'Traditional', name: 'Traditional Thai Massage', desc: 'Assisted stretching and acupressure along the sen lines.' },
  { kicker: 'Recovery', name: 'Deep Tissue Massage', desc: 'Firm, focused work for tension held deep in the muscle.' },
  { kicker: 'Herbal', name: 'Herbal Compress', desc: 'Steamed herbal pouches pressed over warmed muscle.' },
  { kicker: 'Grounding', name: 'Foot Reflexology', desc: 'A grounding close-out for tired feet and lower legs.' },
]

const SCROLL_LEN = 2200

function clamp(v: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v))
}
function smoothstep(e0: number, e1: number, v: number) {
  const x = clamp((v - e0) / (e1 - e0))
  return x * x * (3 - 2 * x)
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function segment(s: number, a: number, b: number, c: number, d: number) {
  const enter = smoothstep(a, b, s)
  const exit = smoothstep(c, d, s)
  return { enter, exit, active: enter * (1 - exit) }
}

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const rootRef = useRef<HTMLDivElement>(null)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const shopName = loading ? '…' : shop?.name || 'Noir Botanica'
  const titleWord = (loading ? 'STILLNESS' : shop?.name || 'STILLNESS').toUpperCase()

  // Infinite-loop treatments slider: 3 cloned sets so prev/next never hits an edge.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const originalCount = TREATMENTS.length
    let active = originalCount
    let cardWidth = 0

    function render() {
      track!.innerHTML = ''
      for (let setIndex = 0; setIndex < 3; setIndex++) {
        TREATMENTS.forEach((t, i) => {
          const card = document.createElement('div')
          card.className = 'nb-card'
          card.innerHTML = `
            <span class="nb-card-kicker">${t.kicker}</span>
            <h3>${t.name}</h3>
            <p>${t.desc}</p>
          `
          card.dataset.index = String(setIndex * originalCount + i)
          card.addEventListener('click', () => {
            active = Number(card.dataset.index)
            update(false)
          })
          track!.appendChild(card)
        })
      }
      cardWidth = (track!.firstElementChild as HTMLElement)?.offsetWidth ?? 260
      update(true)
    }

    function update(jump: boolean) {
      const gap = 18
      track!.style.transition = jump ? 'none' : 'transform 560ms cubic-bezier(.22,1,.36,1)'
      track!.style.transform = `translate3d(${-(cardWidth + gap) * active}px, 0, 0)`
    }

    function normalize() {
      if (active >= originalCount * 2) active -= originalCount
      else if (active < originalCount) active += originalCount
      else return
      update(true)
    }

    function move(dir: number) {
      active += dir
      update(false)
    }

    render()
    track.addEventListener('transitionend', normalize)
    const onResize = () => render()
    window.addEventListener('resize', onResize)

    const prevBtn = rootRef.current?.querySelector('.nb-prev')
    const nextBtn = rootRef.current?.querySelector('.nb-next')
    const onPrev = () => move(-1)
    const onNext = () => move(1)
    prevBtn?.addEventListener('click', onPrev)
    nextBtn?.addEventListener('click', onNext)

    return () => {
      track.removeEventListener('transitionend', normalize)
      window.removeEventListener('resize', onResize)
      prevBtn?.removeEventListener('click', onPrev)
      nextBtn?.removeEventListener('click', onNext)
    }
  }, [])

  // Scroll + pointer driven "cinematic stage": pins for SCROLL_LEN px while a giant
  // title fades out, two story panels fade in/out in sequence, and the treatments
  // slider flies in — all values written straight to CSS custom properties each
  // frame to keep this off React's render cycle.
  useEffect(() => {
    const root = rootRef.current
    const stageWrap = stageWrapRef.current
    if (!root || !stageWrap) return

    let targetMouseX = 0
    let targetMouseY = 0
    let mouseX = 0
    let mouseY = 0
    let smoothScroll = 0
    let initialized = false
    let rafPending = false
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    function getScrollDistance() {
      const rect = stageWrap!.getBoundingClientRect()
      return clamp(-rect.top, 0, rect.height - window.innerHeight)
    }

    function update() {
      rafPending = false
      const target = getScrollDistance()
      if (!initialized || reduceMotion.matches) {
        smoothScroll = target
        initialized = true
      } else {
        smoothScroll = lerp(smoothScroll, target, 0.14)
      }
      if (Math.abs(smoothScroll - target) < 0.08) smoothScroll = target

      mouseX = lerp(mouseX, targetMouseX, 0.12)
      mouseY = lerp(mouseY, targetMouseY, 0.12)

      const s = smoothScroll
      const titleExit = smoothstep(0, 480, s)
      const panel1 = segment(s, 520, 680, 980, 1150)
      const panel2 = segment(s, 1150, 1330, 1680, 1850)
      const sliderEnter = Math.pow(smoothstep(1850, 2150, s), 1.4)

      const mx = reduceMotion.matches ? 0 : mouseX
      const my = reduceMotion.matches ? 0 : mouseY

      const set = (k: string, v: string) => root!.style.setProperty(k, v)
      set('--nb-mx', mx.toFixed(4))
      set('--nb-my', my.toFixed(4))
      set('--nb-title-y', `${titleExit * -140}px`)
      set('--nb-title-scale', `${1 - titleExit * 0.14}`)
      set('--nb-title-opacity', `${1 - titleExit}`)
      set('--nb-intro-y', `${titleExit * 60}px`)
      set('--nb-intro-opacity', `${1 - titleExit}`)
      set('--nb-panel1-opacity', `${panel1.active}`)
      set('--nb-panel1-y', `calc(-50% + ${(1 - panel1.enter) * 40 - panel1.exit * 60}px)`)
      set('--nb-panel2-opacity', `${panel2.active}`)
      set('--nb-panel2-y', `calc(-50% + ${(1 - panel2.enter) * 40 - panel2.exit * 60}px)`)
      set('--nb-slider-opacity', `${sliderEnter}`)
      set('--nb-slider-x', `${(1 - sliderEnter) * 60}vw`)
      set('--nb-fa-y', `${-progressFor(s) * 60}px`)
      set('--nb-fb-y', `${progressFor(s) * 40}px`)
      set('--nb-fc-y', `${-progressFor(s) * 30}px`)
      set('--nb-shade', `${0.55 + panel1.active * 0.15 + panel2.active * 0.15}`)

      if (
        Math.abs(smoothScroll - target) > 0.08 ||
        Math.abs(mouseX - targetMouseX) > 0.001 ||
        Math.abs(mouseY - targetMouseY) > 0.001
      ) {
        requestTick()
      }
    }

    function progressFor(s: number) {
      return clamp(s / SCROLL_LEN)
    }

    function requestTick() {
      if (rafPending) return
      rafPending = true
      requestAnimationFrame(update)
    }

    function onScroll() {
      requestTick()
    }
    function onPointerMove(e: PointerEvent) {
      targetMouseX = e.clientX / window.innerWidth - 0.5
      targetMouseY = e.clientY / window.innerHeight - 0.5
      requestTick()
    }
    function onResize() {
      requestTick()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    requestTick()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <div ref={rootRef} className="nb-root" style={{ background: '#0B1710', color: '#F3F1E6' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;600&display=swap');
        .nb-root { font-family: 'Inter', sans-serif; }
        .nb-serif { font-family: 'Fraunces', serif; }

        .nb-nav {
          position: sticky; top: 0; z-index: 30;
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 40px; background: rgba(11,23,16,0.55); backdrop-filter: blur(10px);
        }
        .nb-nav a { color: #F3F1E6; text-decoration: none; font-size: 14px; opacity: .82; }
        .nb-nav a:hover { opacity: 1; }

        .nb-stage-wrap { position: relative; height: calc(100vh + ${SCROLL_LEN}px); }
        .nb-stage {
          position: sticky; top: 0; height: 100vh; min-height: 560px;
          overflow: hidden; isolation: isolate;
          background: radial-gradient(120% 90% at 20% 0%, #163a30 0%, #0B1710 55%, #0B1710 100%);
        }
        .nb-bg-glow {
          position: absolute; inset: -10%; pointer-events: none;
          background:
            radial-gradient(38% 34% at 26% 22%, rgba(201,232,92,0.14), transparent 70%),
            radial-gradient(34% 30% at 78% 68%, rgba(159,194,168,0.14), transparent 70%);
        }
        .nb-float {
          position: absolute; object-fit: cover; border-radius: 22px; pointer-events: none;
          user-select: none; box-shadow: 0 40px 90px rgba(0,0,0,0.5); will-change: transform;
        }
        .nb-float-a {
          width: min(30vw, 360px); height: min(36vw, 440px); left: 6%; top: 16%;
          transform: translate3d(calc(var(--nb-mx, 0) * -26px), calc(var(--nb-my, 0) * -18px + var(--nb-fa-y, 0px)), 0) rotate(-4deg);
        }
        .nb-float-b {
          width: min(22vw, 300px); height: min(28vw, 360px); right: 8%; top: 10%;
          transform: translate3d(calc(var(--nb-mx, 0) * 30px), calc(var(--nb-my, 0) * 20px + var(--nb-fb-y, 0px)), 0) rotate(5deg);
        }
        .nb-float-c {
          width: min(20vw, 280px); height: min(26vw, 320px); right: 12%; bottom: 12%;
          transform: translate3d(calc(var(--nb-mx, 0) * 18px), calc(var(--nb-my, 0) * -14px + var(--nb-fc-y, 0px)), 0) rotate(-3deg);
        }
        .nb-shade {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(11,23,16,0) 0%, rgba(11,23,16,0.4) 55%, rgba(11,23,16,0.94) 100%);
          opacity: var(--nb-shade, 0.55);
        }

        .nb-title {
          position: absolute; left: 50%; top: 36%; margin: 0; z-index: 4;
          width: 92vw; text-align: center; letter-spacing: -1px;
          font-weight: 500; line-height: 0.86; font-size: clamp(52px, 10vw, 160px);
          transform: translate3d(-50%, var(--nb-title-y, 0px), 0) scale(var(--nb-title-scale, 1));
          opacity: var(--nb-title-opacity, 1);
        }
        .nb-intro {
          position: absolute; left: 50%; bottom: 9vh; z-index: 4;
          width: min(560px, 90vw); text-align: center;
          transform: translate3d(-50%, var(--nb-intro-y, 0px), 0);
          opacity: var(--nb-intro-opacity, 1);
        }
        .nb-intro p { margin: 0 0 20px; font-size: 17px; line-height: 1.5; color: rgba(243,241,230,0.88); }
        .nb-tags { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .nb-tags span {
          padding: 8px 18px; border-radius: 999px; font-size: 13px;
          background: rgba(243,241,230,0.1); border: 1px solid rgba(243,241,230,0.2);
        }

        .nb-panel {
          position: absolute; left: 50%; top: 50%; width: min(640px, 88vw); text-align: center;
          pointer-events: none;
        }
        .nb-panel-1 { opacity: var(--nb-panel1-opacity, 0); transform: translate3d(-50%, var(--nb-panel1-y, -40%), 0); }
        .nb-panel-2 { opacity: var(--nb-panel2-opacity, 0); transform: translate3d(-50%, var(--nb-panel2-y, -60%), 0); }
        .nb-panel h2 { font-size: clamp(30px, 4vw, 48px); font-weight: 500; margin: 0 0 16px; line-height: 1.05; }
        .nb-panel p { font-size: 16px; line-height: 1.5; color: rgba(243,241,230,0.85); margin: 0; }
        .nb-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 36px; }
        .nb-facts dt { font-size: clamp(32px, 4vw, 52px); font-weight: 500; margin: 0; color: ${themeConfig.primaryColor}; }
        .nb-facts dd { margin: 8px 0 0; font-size: 14px; color: rgba(243,241,230,0.75); }
        .nb-note {
          margin-top: 22px; display: inline-flex; align-items: center; gap: 10px;
          padding: 12px 26px; border-radius: 999px; background: ${themeConfig.primaryColor};
          color: #0B1710; font-weight: 600; pointer-events: auto; cursor: pointer; border: none;
        }

        .nb-slider-wrap {
          position: absolute; left: 0; right: 0; bottom: 6vh; z-index: 5;
          opacity: var(--nb-slider-opacity, 0);
          transform: translate3d(var(--nb-slider-x, 60vw), 0, 0);
        }
        .nb-track { display: flex; gap: 18px; padding: 0 40px; will-change: transform; }
        .nb-card {
          flex: 0 0 240px; background: rgba(243,241,230,0.96); color: #12332C;
          border-radius: 18px; padding: 20px; cursor: pointer;
        }
        .nb-card-kicker { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: .6; margin-bottom: 34px; }
        .nb-card h3 { font-size: 18px; margin: 0 0 8px; font-family: 'Fraunces', serif; }
        .nb-card p { font-size: 13px; line-height: 1.4; margin: 0; opacity: .75; }

        .nb-slider-controls { position: absolute; left: 40px; bottom: calc(6vh - 64px); z-index: 6; display: flex; gap: 10px; }
        .nb-slider-controls button {
          width: 44px; height: 44px; border-radius: 999px; border: none; cursor: pointer;
          background: rgba(243,241,230,0.9); color: #12332C; font-size: 16px;
        }

        .nb-about { padding: 90px 40px; max-width: 900px; margin: 0 auto; text-align: center; }
        .nb-about h2 { font-size: clamp(28px, 4vw, 42px); margin: 0 0 18px; }
        .nb-about p { font-size: 16px; line-height: 1.6; color: rgba(243,241,230,0.85); }

        .nb-footer { padding: 56px 40px; border-top: 1px solid rgba(243,241,230,0.12); display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }

        @media (max-width: 720px) {
          .nb-facts { gap: 20px; }
          .nb-panel { width: 92vw; }
        }
      `}</style>

      <nav className="nb-nav">
        <span className="nb-serif" style={{ fontSize: '18px' }}>{shopName}</span>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <a href="#treatments">Treatments</a>
          <a href="#about">About</a>
        </div>
      </nav>

      <div ref={stageWrapRef} className="nb-stage-wrap">
        <div className="nb-stage">
          <div className="nb-bg-glow" />
          <img className="nb-float nb-float-a" src={FLOAT_A} alt="" />
          <img className="nb-float nb-float-b" src={FLOAT_B} alt="" />
          <img className="nb-float nb-float-c" src={FLOAT_C} alt="" />
          <div className="nb-shade" />

          <h1 className="nb-serif nb-title">{titleWord}</h1>

          <div className="nb-intro">
            <p>{shopName} pairs traditional Thai technique with a calm, considered space — built for real recovery, not just relaxation.</p>
            <div className="nb-tags">
              <span>Traditional Thai</span>
              <span>Deep Tissue</span>
              <span>Herbal Compress</span>
            </div>
          </div>

          <div className="nb-panel nb-panel-1">
            <h2 className="nb-serif">Pressure, considered — not just applied.</h2>
            <p>Every therapist works from years of trained technique, adjusting pace and depth to what your body actually needs that day.</p>
            <div className="nb-facts">
              <div>
                <dt>10+</dt>
                <dd>Years of combined therapist training</dd>
              </div>
              <div>
                <dt>60min</dt>
                <dd>Average session, no rushed slots</dd>
              </div>
            </div>
          </div>

          <div className="nb-panel nb-panel-2" id="treatments">
            <h2 className="nb-serif">A short, deliberate menu.</h2>
            <p>Five treatments, each done properly — rather than fifteen done in a hurry.</p>
            <button className="nb-note" onClick={() => document.getElementById('booking-cta')?.scrollIntoView({ behavior: 'smooth' })}>
              See booking options ↓
            </button>
          </div>

          <div className="nb-slider-wrap">
            <div ref={trackRef} className="nb-track" />
          </div>
          <div className="nb-slider-controls">
            <button className="nb-prev" aria-label="Previous treatment">←</button>
            <button className="nb-next" aria-label="Next treatment">→</button>
          </div>
        </div>
      </div>

      <section id="about" className="nb-about">
        <h2 className="nb-serif">Considered, not rushed.</h2>
        <p>
          {shopName} was built around one idea: give every guest the full session they booked, at a pace that actually
          lets the body reset — no upsells, no clock-watching.
        </p>
        <div id="booking-cta" style={{ marginTop: '28px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <BookingButton />
        </div>
      </section>

      <footer className="nb-footer">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && (
          <p style={{ fontSize: '13px', color: 'rgba(243,241,230,0.6)' }}>{shop.address} · {shop.phone}</p>
        )}
      </footer>
    </div>
  )
}
