import { onUnmounted, shallowRef, watch } from 'vue'

/**
 * A template ref on <IonContent> hands back the Vue wrapper, not the custom
 * element, so unwrap $el before measuring anything.
 */
function toElement(value: unknown): HTMLElement | null {
  if (value == null) return null
  if (value instanceof HTMLElement) return value
  const host = (value as { $el?: unknown }).$el
  return host instanceof HTMLElement ? host : null
}

/**
 * How tall the board is allowed to be, measured rather than guessed.
 *
 * The board used to size itself from `calc(100dvh - 22rem)`, where 22rem was a
 * hand-counted stand-in for the header + status row + pinned pad + tab bar. It
 * under-counted the real furniture by ~30px, so on a 360x640 phone the bottom
 * row of the grid sat behind the pad and had to be scrolled into view — and the
 * `max(17rem, ...)` floor guaranteed the board could never shrink to compensate,
 * turning an overflow into a clip.
 *
 * Measuring IonContent's own box needs to know nothing about any of that
 * furniture, and re-measures when the keyboard opens, the header changes height
 * or the device rotates.
 */

function px(value: string): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useBoardFit() {
  /** The <ion-content> element — its box IS the space the board has to live in. */
  const contentEl = shallowRef<HTMLElement | null>(null)
  /** The status row above the board, which eats into that space. */
  const reserveEl = shallowRef<HTMLElement | null>(null)

  const available = shallowRef(0)

  function measure(): void {
    const content = contentEl.value
    if (!content) return

    const styles = getComputedStyle(content)
    // IonContent applies `ion-padding` to .inner-scroll inside its shadow root
    // via custom properties, so the host element's own paddingTop is 0 and
    // reading it silently under-counted the used space by 32px.
    const padding =
      px(styles.getPropertyValue('--padding-top')) + px(styles.getPropertyValue('--padding-bottom'))
    const gap = reserveEl.value
      ? px(getComputedStyle(reserveEl.value.parentElement ?? content).rowGap)
      : 0

    // The content's own bottom padding is the board's breathing room, so
    // nothing extra is reserved below it.
    const used = (reserveEl.value?.offsetHeight ?? 0) + gap
    available.value = Math.max(0, content.clientHeight - padding - used)
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null

  // Both refs are filled by template refs after mount, and the reserve row comes
  // and goes with the generating spinner, so watch rather than measure once.
  watch([contentEl, reserveEl], ([content, reserve], [prevContent, prevReserve]) => {
    if (prevContent) observer?.unobserve(prevContent)
    if (prevReserve) observer?.unobserve(prevReserve)
    if (content) observer?.observe(content)
    if (reserve) observer?.observe(reserve)
    measure()
  })

  onUnmounted(() => observer?.disconnect())

  return {
    available,
    measure,
    setContent: (value: unknown) => void (contentEl.value = toElement(value)),
    setReserve: (value: unknown) => void (reserveEl.value = toElement(value)),
  }
}
