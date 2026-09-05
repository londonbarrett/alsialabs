import { Suspense } from "react"
import { LoadingDispatcher } from "@/components/common/app-loading-indicator"

export function Page({
  children,
  header,
  fallback,
}: {
  children: React.ReactNode
  header?: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <div className="@container flex flex-1 flex-col gap-6 p-6">
      {header}
      <Suspense
        fallback={
          <>
            <LoadingDispatcher />
            {fallback ?? (
              <div className="h-96 animate-pulse rounded-xl border bg-muted/30" />
            )}
          </>
        }
      >
        {children}
      </Suspense>
    </div>
  )
}
