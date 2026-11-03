"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "next-intl"
import { useCallback } from "react"

type Props = {
  tables: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function TableSelection({ tables, selected, onChange }: Props) {
  const t = useTranslations()

  const allChecked =
    tables.length > 0 &&
    tables.every((table) => selected.includes(table))

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      onChange(checked ? [...tables] : [])
    },
    [onChange, tables]
  )

  const handleToggle = useCallback(
    (table: string) => {
      if (selected.includes(table)) {
        onChange(selected.filter((name) => name !== table))
      } else {
        onChange([...selected, table])
      }
    },
    [onChange, selected]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Switch
          id="backups-select-all"
          checked={allChecked}
          onCheckedChange={handleToggleAll}
        />
        <Label htmlFor="backups-select-all">
          {t("backups.selectAll")}
        </Label>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => {
          const id = `backups-table-${table}`
          return (
            <div key={table} className="flex items-center gap-2">
              <Switch
                id={id}
                checked={selected.includes(table)}
                onCheckedChange={() => handleToggle(table)}
              />
              <Label htmlFor={id} className="font-normal">
                {table}
              </Label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
