/**
 * Adaptive Smooth Scroll Engine
 *
 * - Trackpads / touchpads: Yields directly to native OS 60–120Hz pixel-level inertia
 *   for zero latency and natural speed.
 * - Discrete notched mouse wheels: Smoothly interpolates stepped wheel ticks with
 *   responsive exponential damping.
 * - Programmatic jumps (anchors, TOC, chapter rail): Silky animated glide.
 */

export interface SmoothScrollOptions {
  /** Exponential damping factor for discrete wheel smoothing. Default: 13.5 */
  damping?: number
  /** Wheel delta multiplier for discrete mouse wheels. Default: 1.1 */
  wheelMultiplier?: number
}

const TOUCH_OR_REDUCED = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  window.matchMedia('(pointer: coarse)').matches ||
  ('ontouchstart' in window &&
    navigator.maxTouchPoints > 0 &&
    window.matchMedia('(hover: none)').matches)

function findScrollableAncestor(el: HTMLElement | null, deltaY: number): HTMLElement | null {
  let node: HTMLElement | null = el
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const overflowY = style.overflowY
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2
    if (canScroll) {
      const atTop = node.scrollTop <= 0 && deltaY < 0
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1 && deltaY > 0
      if (!atTop && !atBottom) return node
    }
    node = node.parentElement
  }
  return null
}

function normalizeWheelDelta(e: WheelEvent): number {
  let dy = e.deltaY
  if (e.deltaMode === 1) dy *= 36 // DOM_DELTA_LINE
  else if (e.deltaMode === 2) dy *= window.innerHeight // DOM_DELTA_PAGE
  return dy
}

export class SmoothScrollEngine {
  private damping: number
  private wheelMultiplier: number
  private currentY = 0
  private targetY = 0
  private lastWrittenY = 0
  private prevWrittenY = 0
  private rafId = 0
  private lastTime = 0
  private running = false
  private destroyed = false

  // Trackpad detection state
  private trackpadLockUntil = 0
  private lastWheelTime = 0

  constructor(options: SmoothScrollOptions = {}) {
    this.damping = options.damping ?? 13.5
    this.wheelMultiplier = options.wheelMultiplier ?? 1.1
    this.currentY = window.scrollY
    this.targetY = window.scrollY

    if (!TOUCH_OR_REDUCED()) {
      this.bind()
    }
  }

  private maxScroll(): number {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  }

  private clamp(y: number): number {
    return Math.max(0, Math.min(this.maxScroll(), y))
  }

  /**
   * Heuristic distinguishing smooth high-frequency trackpads from discrete notched mouse wheels.
   * Trackpads emit pixel-mode events with small/variable deltas, fractional deltas,
   * horizontal components, or rapid sub-30ms inertial tails.
   */
  private isTrackpadEvent(e: WheelEvent, now: number): boolean {
    if (e.deltaMode !== 0) return false

    const absY = Math.abs(e.deltaY)
    const absX = Math.abs(e.deltaX)
    const dt = now - this.lastWheelTime
    const isFractional = !Number.isInteger(e.deltaY)
    const hasHorizontal = absX > 0

    // Classic trackpad signatures: small pixel increments, fractional pixels, or 2D scroll
    if (absY < 48 || isFractional || hasHorizontal) {
      this.trackpadLockUntil = now + 450
      return true
    }

    // Standard notched mouse wheels typically emit clean multiples of 100 / 120 / 53
    const looksLikeMouseStep =
      absY >= 50 && (absY % 100 === 0 || absY % 120 === 0 || absY % 40 === 0)
    if (!looksLikeMouseStep && dt < 32) {
      this.trackpadLockUntil = now + 450
      return true
    }

    // Keep yielding during a trackpad momentum tail even if a fast flick exceeds 48px
    if (now < this.trackpadLockUntil && !looksLikeMouseStep) {
      this.trackpadLockUntil = now + 350
      return true
    }

    return false
  }

  private stopAnimation() {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  private onWheel = (e: WheelEvent) => {
    if (this.destroyed || e.ctrlKey || e.metaKey || e.defaultPrevented) return

    const target = e.target as HTMLElement | null
    if (target?.closest('[data-smooth-scroll-ignore]')) return

    const now = performance.now()
    const isTrackpad = this.isTrackpadEvent(e, now)
    this.lastWheelTime = now

    // Let trackpads use native hardware-accelerated OS inertia at full speed
    if (isTrackpad) {
      if (this.running) {
        this.stopAnimation()
        this.currentY = window.scrollY
        this.targetY = window.scrollY
      }
      return
    }

    const dy = normalizeWheelDelta(e)
    if (Math.abs(dy) < 0.01) return

    // Yield cleanly to scrollable nested panels (TOC sidebar, code blocks, drawers)
    if (findScrollableAncestor(target, dy)) return

    e.preventDefault()

    if (!this.running) {
      this.currentY = window.scrollY
      this.targetY = window.scrollY
      this.lastWrittenY = this.currentY
      this.prevWrittenY = this.currentY
    }

    this.targetY = this.clamp(this.targetY + dy * this.wheelMultiplier)
    this.startLoop()
  }

  private onNativeScroll = () => {
    const sy = window.scrollY
    if (!this.running) {
      this.currentY = sy
      this.targetY = sy
      this.lastWrittenY = sy
      this.prevWrittenY = sy
    } else if (Math.abs(sy - this.lastWrittenY) > 4 && Math.abs(sy - this.prevWrittenY) > 4) {
      // External scroll jump (e.g. scrollbar drag or keyboard) overrides current animation
      this.stopAnimation()
      this.currentY = sy
      this.targetY = sy
      this.lastWrittenY = sy
      this.prevWrittenY = sy
    }
  }

  private onAnchorClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement | null)?.closest('a[href^="#"]') as HTMLAnchorElement | null
    if (!link) return
    const hash = link.getAttribute('href')
    if (!hash || hash === '#') return
    const dest = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (!dest) return
    e.preventDefault()
    history.pushState(null, '', hash)
    const top = dest.getBoundingClientRect().top + window.scrollY - 88
    this.scrollTo(top)
  }

  private startLoop() {
    if (this.running || this.destroyed) return
    this.running = true
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    if (this.destroyed || !this.running) return
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000))
    this.lastTime = now

    const alpha = 1 - Math.exp(-this.damping * dt)
    this.currentY += (this.targetY - this.currentY) * alpha

    if (Math.abs(this.targetY - this.currentY) < 0.5) {
      this.currentY = this.targetY
      this.running = false
    }

    const nextY = Math.round(this.currentY)
    this.prevWrittenY = this.lastWrittenY
    this.lastWrittenY = nextY
    window.scrollTo(0, nextY)

    if (this.running) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  public scrollTo(y: number, immediate = false) {
    const dest = this.clamp(y)
    if (immediate || TOUCH_OR_REDUCED()) {
      this.stopAnimation()
      this.currentY = dest
      this.targetY = dest
      window.scrollTo({ top: dest, behavior: immediate ? 'auto' : 'smooth' })
      return
    }
    if (!this.running) {
      this.currentY = window.scrollY
      this.lastWrittenY = this.currentY
      this.prevWrittenY = this.currentY
    }
    this.targetY = dest
    this.startLoop()
  }

  private bind() {
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('scroll', this.onNativeScroll, { passive: true })
    document.addEventListener('click', this.onAnchorClick)
  }

  public destroy() {
    this.destroyed = true
    this.stopAnimation()
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('scroll', this.onNativeScroll)
    document.removeEventListener('click', this.onAnchorClick)
  }
}

declare global {
  interface Window {
    __norbSmoothScroll?: SmoothScrollEngine | null
  }
}

export function initSmoothScroll(options?: SmoothScrollOptions): SmoothScrollEngine | null {
  destroySmoothScroll()
  if (document.body.dataset.smoothScroll === 'off') return null
  const engine = new SmoothScrollEngine(options)
  window.__norbSmoothScroll = engine
  return engine
}

export function destroySmoothScroll() {
  if (window.__norbSmoothScroll) {
    window.__norbSmoothScroll.destroy()
    window.__norbSmoothScroll = null
  }
}

export function smoothScrollTo(y: number, immediate = false) {
  if (window.__norbSmoothScroll) {
    window.__norbSmoothScroll.scrollTo(y, immediate)
  } else {
    window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
  }
}
