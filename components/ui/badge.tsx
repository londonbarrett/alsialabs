import * as React from "react"

import { cn } from "@/lib/utils"

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: "default" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-foreground/10",
        variant === "outline" && "ring-1 ring-inset ring-foreground/10",
        className,
      )}
      {...props}
    />
  )
}

export { Badge }
