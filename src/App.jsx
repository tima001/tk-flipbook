import {
  useRef, useState, useEffect, useCallback, forwardRef, memo,
} from 'react'
import HTMLFlipBook from 'react-pageflip'
import './App.css'

const BASE = import.meta.env.BASE_URL
const TOTAL_PAGES = 38
const PAGE_RATIO = 1755 / 1240 // A4 render 1240x1755

const PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const n = String(i + 1).padStart(2, '0')
  return `${BASE}pages/page-${n}.png`
})

/* ------------------------------------------------------------------ */
/* Layout: spread always fits; portrait (single page) only when narrow */
function computeLayout() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const chromeH = 150
  const sideGap = vw < 720 ? 20 : 150
  const availH = Math.max(320, vh - chromeH)
  const availW = Math.max(280, vw - sideGap)

  const portrait = vw < 720
  const cols = portrait ? 1 : 2

  let pageW = Math.floor(Math.min(availW / cols, availH / PAGE_RATIO))
  pageW = Math.max(240, Math.min(pageW, 640))
  const pageH = Math.floor(pageW * PAGE_RATIO)
  return { portrait, pageW, pageH }
}

/* ------------------------------------------------------------------ */
/* Single sheet */
const Page = forwardRef(({ src, index }, ref) => (
  <div className="page" ref={ref}>
    <img
      className="page__img"
      src={src}
      alt={`Страница ${index + 1}`}
      draggable={false}
    />
  </div>
))
Page.displayName = 'Page'

/* ------------------------------------------------------------------ */
/* The book itself, fully memoized.
   CRITICAL: parent state changes (counter, drawers…) must NOT re-render
   this subtree — re-rendering 38 pages mid-flip is what tears the
   animation apart. Props only change on resize. */
const BookView = memo(function BookView({
  pageW, pageH, portrait, apiRef, onFlipEnd, onStateChange,
}) {
  return (
    <HTMLFlipBook
      ref={apiRef}
      className="book"
      width={pageW}
      height={pageH}
      size="fixed"
      minWidth={pageW}
      maxWidth={pageW}
      minHeight={pageH}
      maxHeight={pageH}
      usePortrait={portrait}
      drawShadow={true}
      maxShadowOpacity={0.55}
      showCover={true}
      mobileScrollSupport={true}
      flippingTime={850}
      startPage={0}
      showPageCorners={true}
      onFlip={onFlipEnd}
      onChangeState={onStateChange}
    >
      {PAGES.map((src, i) => (
        <Page key={i} src={src} index={i} />
      ))}
    </HTMLFlipBook>
  )
})

/* ------------------------------------------------------------------ */
export default function App() {
  const apiRef = useRef(null)
  const audioRef = useRef(null)
  const lastSoundAt = useRef(0)
  const currentRef = useRef(0)

  const [layout, setLayout] = useState(computeLayout)
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [thumbsOpen, setThumbsOpen] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  // shift: cover/back-cover are centered; the book slides when opening
  const [shift, setShift] = useState('cover') // 'cover' | 'open' | 'back'

  const soundOnRef = useRef(soundOn)
  soundOnRef.current = soundOn
  currentRef.current = current

  /* ---- assets ---- */
  useEffect(() => {
    const a = new Audio(`${BASE}flip.ogg`)
    a.preload = 'auto'
    a.volume = 0.65
    audioRef.current = a
  }, [])

  // Preload every page up-front (lazy loading caused blank pages mid-flip)
  useEffect(() => {
    let cancelled = false
    let i = 0
    const next = () => {
      if (cancelled || i >= PAGES.length) return
      const img = new Image()
      img.onload = img.onerror = () => { i += 1; next() }
      img.src = PAGES[i]
    }
    next()
    return () => { cancelled = true }
  }, [])

  /* ---- resize (debounced, remounts book at new size) ---- */
  useEffect(() => {
    let t
    const onResize = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const nextL = computeLayout()
        setLayout((prev) => {
          if (prev.portrait === nextL.portrait && Math.abs(prev.pageW - nextL.pageW) < 24) return prev
          setReady(false)
          return nextL
        })
      }, 250)
    }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize) }
  }, [])

  /* ---- flip plumbing ---- */
  const api = () => apiRef.current?.pageFlip()

  const playFlip = useCallback(() => {
    if (!soundOnRef.current) return
    const now = Date.now()
    if (now - lastSoundAt.current < 300) return
    lastSoundAt.current = now
    const a = audioRef.current
    if (!a) return
    try { a.currentTime = 0; a.play().catch(() => {}) } catch (_) {}
  }, [])

  const shiftFor = (page) => {
    if (page <= 0) return 'cover'
    if (page >= TOTAL_PAGES - 1) return 'back'
    return 'open'
  }

  const onFlipEnd = useCallback((e) => {
    setCurrent(e.data)
    setShift(shiftFor(e.data))
  }, [])

  const onStateChange = useCallback((e) => {
    // react-pageflip states: 'user_fold' (dragging with the mouse/finger),
    // 'fold_corner' (hovering the corner), 'flipping' (animating after a
    // click or a released drag), 'read' (settled). Sound must fire the
    // moment the page starts moving — for a click that's 'flipping', but
    // for a manual drag it's 'user_fold', which never becomes 'flipping'
    // if the drag itself carries the page all the way over.
    if (e.data === 'flipping' || e.data === 'user_fold') {
      playFlip()
      // Leaving the cover: start sliding to center WHILE the page turns
      if (currentRef.current === 0) setShift('open')
      if (currentRef.current >= TOTAL_PAGES - 1) setShift('open')
    }
  }, [playFlip])

  const onBookInit = useCallback(() => setReady(true), [])
  // react-pageflip has no onInit when size=fixed reliably → mark ready on mount
  useEffect(() => { const t = setTimeout(() => setReady(true), 400); return () => clearTimeout(t) }, [layout])

  const isFlipping = () => {
    try { return api()?.getState?.() === 'flipping' } catch (_) { return false }
  }

  const goNext = useCallback(() => { if (!isFlipping()) api()?.flipNext() }, [])
  const goPrev = useCallback(() => { if (!isFlipping()) api()?.flipPrev() }, [])
  // Jump to any page with a single animated flip transition — not an
  // instant swap (turnToPage) and not a sequential flip through every
  // page in between. The library's flip(page) method re-targets the
  // spread index and plays exactly one page-turn animation to get there.
  const jumpTo = useCallback((p) => {
    const a = api()
    if (!a) return
    a.flip(p)
  }, [])

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (zoomOpen && e.key === 'Escape') { setZoomOpen(false); return }
      if (thumbsOpen && e.key === 'Escape') { setThumbsOpen(false); return }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNext() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPrev() }
      else if (e.key === 'Home') { e.preventDefault(); jumpTo(0) }
      else if (e.key === 'End') { e.preventDefault(); jumpTo(TOTAL_PAGES - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, jumpTo, zoomOpen, thumbsOpen])

  const toggleFullscreen = () => {
    const el = document.documentElement
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }

  /* ---- derived ---- */
  const { portrait, pageW, pageH } = layout

  const counterText = (() => {
    if (current === 0) return `1/${TOTAL_PAGES}`
    if (portrait) return `${current + 1}/${TOTAL_PAGES}`
    const left = current % 2 === 1 ? current : current - 1
    const right = left + 1
    if (right >= TOTAL_PAGES - 1) return `${TOTAL_PAGES}/${TOTAL_PAGES}`
    return `${left + 1}-${right + 1}/${TOTAL_PAGES}`
  })()

  const shiftX = portrait ? 0 : shift === 'cover' ? -pageW / 2 : shift === 'back' ? pageW / 2 : 0

  // Current spread for zoom overlay
  const zoomPages = (() => {
    if (portrait || current === 0) return [current]
    const left = current % 2 === 1 ? current : current - 1
    const right = left + 1
    return right < TOTAL_PAGES ? [left, right] : [left]
  })()

  return (
    <div className="app">
      <div className="bg" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">TK</span>
          <span className="brand__sub">CREATIVE · Каталог библиотек 2026</span>
        </div>
      </header>

      <main className="stage">
        {!ready && (
          <div className="loader" aria-live="polite">
            <div className="loader__spin" />
          </div>
        )}

        <div className="book-outer" data-ready={ready}>
          <div
            className="book-slide"
            style={{
              width: portrait ? pageW : pageW * 2,
              height: pageH,
              transform: `translateX(${shiftX}px)`,
            }}
          >
            <div className="book-shadow" aria-hidden="true" />
            <BookView
              key={`${portrait ? 'p' : 'l'}-${pageW}`}
              pageW={pageW}
              pageH={pageH}
              portrait={portrait}
              apiRef={apiRef}
              onFlipEnd={onFlipEnd}
              onStateChange={onStateChange}
              onInit={onBookInit}
            />
          </div>
        </div>

        <button className="edge edge--left" onClick={goPrev} aria-label="Назад">
          <Chevron dir="left" />
        </button>
        <button className="edge edge--right" onClick={goNext} aria-label="Вперёд">
          <Chevron dir="right" />
        </button>
      </main>

      {/* ---------- bottom toolbar, flipbuilder-style ---------- */}
      <footer className="toolbar">
        <div className="toolbar__group">
          <IconBtn label="Миниатюры" active={thumbsOpen} onClick={() => setThumbsOpen(v => !v)}>
            <ThumbsIcon />
          </IconBtn>
          <IconBtn label="Увеличить" active={zoomOpen} onClick={() => setZoomOpen(v => !v)}>
            <ZoomIcon />
          </IconBtn>
          <IconBtn label={soundOn ? 'Звук включён' : 'Звук выключен'} active={soundOn} onClick={() => setSoundOn(s => !s)}>
            {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
          </IconBtn>
        </div>

        <div className="toolbar__group toolbar__group--center">
          <IconBtn label="В начало" onClick={() => jumpTo(0)}><FirstIcon /></IconBtn>
          <IconBtn label="Назад" onClick={goPrev}><PrevIcon /></IconBtn>
          <span className="counter">{counterText}</span>
          <IconBtn label="Вперёд" onClick={goNext}><NextIcon /></IconBtn>
          <IconBtn label="В конец" onClick={() => jumpTo(TOTAL_PAGES - 1)}><LastIcon /></IconBtn>
        </div>

        <div className="toolbar__group toolbar__group--right">
          <IconBtn label="Полный экран" onClick={toggleFullscreen}><FullIcon /></IconBtn>
        </div>
      </footer>

      {/* ---------- thumbnails drawer ---------- */}
      <div className={`thumbs ${thumbsOpen ? 'is-open' : ''}`} role="dialog" aria-label="Миниатюры страниц">
        <div className="thumbs__scroll">
          {PAGES.map((src, i) => (
            <button
              key={i}
              className={`thumb ${i === current || (i === current - (current % 2 === 0 ? 1 : 0) && current !== 0) ? 'is-current' : ''}`}
              onClick={() => { jumpTo(i); setThumbsOpen(false) }}
            >
              <img src={src} alt={`Страница ${i + 1}`} loading="lazy" />
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- zoom overlay ---------- */}
      {zoomOpen && (
        <div className="zoom" onClick={() => setZoomOpen(false)}>
          <div className="zoom__inner" onClick={(e) => e.stopPropagation()}>
            {zoomPages.map((p) => (
              <img key={p} src={PAGES[p]} alt={`Страница ${p + 1}`} />
            ))}
          </div>
          <button className="zoom__close" onClick={() => setZoomOpen(false)} aria-label="Закрыть">✕</button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function IconBtn({ children, label, onClick, active }) {
  return (
    <button
      className={`tbtn ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

const S = { w: 20, h: 20, vb: '0 0 24 24', st: 'currentColor', sw: 1.8 }
const P = ({ d }) => (
  <svg width={S.w} height={S.h} viewBox={S.vb} fill="none" aria-hidden="true">
    <path d={d} stroke={S.st} strokeWidth={S.sw} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const ThumbsIcon = () => (
  <svg width={S.w} height={S.h} viewBox={S.vb} fill="none" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={S.sw} />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={S.sw} />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={S.sw} />
    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth={S.sw} />
  </svg>
)
const ZoomIcon = () => (
  <svg width={S.w} height={S.h} viewBox={S.vb} fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={S.sw} />
    <path d="M16 16l4.5 4.5M8.5 11h5M11 8.5v5" stroke="currentColor" strokeWidth={S.sw} strokeLinecap="round" />
  </svg>
)
const SoundOnIcon = () => <P d="M4 9v6h3l4.5 4V5L7 9H4zM15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" />
const SoundOffIcon = () => <P d="M4 9v6h3l4.5 4V5L7 9H4zM16 9l5 6M21 9l-5 6" />
const PrevIcon = () => <P d="M14.5 5l-7 7 7 7" />
const NextIcon = () => <P d="M9.5 5l7 7-7 7" />
const FirstIcon = () => <P d="M17 5l-7 7 7 7M8 5v14" />
const LastIcon = () => <P d="M7 5l7 7-7 7M16 5v14" />
const FullIcon = () => <P d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />

function Chevron({ dir }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}
