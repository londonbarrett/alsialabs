import * as React from "react"

/**
 * Base UI's dialog locks `body`, but this app's scroll viewport is `html`, so
 * its scrollbar stays visible while the sheet is open. Lock the document
 * element as well and reserve the gutter width to avoid a layout shift.
 */
export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return

    const root = document.documentElement
    const previous = {
      overflow: root.style.overflow,
      scrollbarWidth: root.style.scrollbarWidth,
      paddingRight: root.style.paddingRight,
    }
    const gutter = window.innerWidth - root.clientWidth

    root.style.overflow = "hidden"
    root.style.scrollbarWidth = "none"
    if (gutter > 0) root.style.paddingRight = `${gutter}px`
    root.classList.add("scroll-lock")

    return () => {
      root.style.overflow = previous.overflow
      root.style.scrollbarWidth = previous.scrollbarWidth
      root.style.paddingRight = previous.paddingRight
      root.classList.remove("scroll-lock")
    }
  }, [active])
}
