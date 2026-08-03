"use client"

import {
  Dialog as UIDialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DialogProps {
  title: string
  description: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
  onInteractOutside?: (event: Event) => void
}

export function Dialog({
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
  onInteractOutside,
}: DialogProps) {
  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className ?? "sm:max-w-md"}
        onInteractOutside={onInteractOutside}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </UIDialog>
  )
}
