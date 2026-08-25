"use client"

import { Label } from "@/components/ui/label"
import {
  PROJECT_COLORS,
  PROJECT_COLOR_NAME_KEYS,
} from "@/components/projects/colors"
import { cn } from "@/lib/util/utils"
import { useTranslations } from "next-intl"

interface ProjectColorFieldProps {
  value: string | undefined
  onChange: (color: string) => void
  error?: string
}

export function ProjectColorField({
  value,
  onChange,
  error,
}: ProjectColorFieldProps) {
  const t = useTranslations()
  return (
    <div
      className="flex flex-col gap-2"
      data-invalid={!!error || undefined}
    >
      <Label id="color-label">{t("projects.color")}</Label>
      <div
        role="radiogroup"
        aria-labelledby="color-label"
        className="flex flex-wrap gap-2"
      >
        {PROJECT_COLORS.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={t(
              `projects.colors.${PROJECT_COLOR_NAME_KEYS[i]}`
            )}
            onClick={() => onChange(c)}
            style={{ backgroundColor: c }}
            className={cn(
              "size-8 rounded-full border border-border/50 transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
              value === c &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          />
        ))}
      </div>
      {error && (
        <p
          id="color-error"
          className="text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
