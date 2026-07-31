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
}

export function Dialog({
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
}: DialogProps) {
  return (
    <UIDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className ?? "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </UIDialog>
  )
}
