"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"

function LoadingBar({ className }: { className?: string }) {
  const { isLoading } = useLoadingIndicator()
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const styleId = "loading-bar-keyframes"
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style")
      style.id = styleId
      style.textContent = `
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  return (
    <div
      role="progressbar"
      aria-busy={isLoading}
      aria-label="Loading"
      data-slot="loading-bar"
      data-loading={isLoading || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 opacity-0 transition-opacity duration-300",
        isLoading && "opacity-100",
        className
      )}
    >
      <div
        ref={barRef}
        className="h-full w-full bg-gradient-to-r from-primary via-chart-2 to-primary"
        style={{
          animation: isLoading
            ? "loading-slide 1.5s ease-in-out infinite"
            : "none",
        }}
      />
    </div>
  )
}

export { LoadingBar }
