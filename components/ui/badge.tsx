import * as React from "react"

import { cn } from "@/lib/util/utils"

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: "default" | "outline"
}

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-foreground/10 ring-inset",
        variant === "outline" && "ring-1 ring-foreground/10 ring-inset",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
