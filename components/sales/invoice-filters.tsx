"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { InvoiceStatus } from "@/lib/drizzle/schema"
import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"

const invoiceStatuses: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]

interface InvoiceFiltersProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  dateFrom: string
  onDateFromChange: (value: string) => void
  dateTo: string
  onDateToChange: (value: string) => void
  isFiltered: boolean
  onClearFilters: () => void
  resultCount: number
}

export function InvoiceFilters({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  isFiltered,
  onClearFilters,
  resultCount,
}: InvoiceFiltersProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <p
        className="mr-auto self-center text-sm text-muted-foreground"
        aria-live="polite"
      >
        {t("sales.resultCount", { count: resultCount })}
      </p>
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          aria-label={t("sales.clearFilters")}
        >
          <X />
          {t("sales.clearFilters")}
        </Button>
      )}
      <div className="grid gap-2">
        <Label htmlFor="invoice-search" className="text-xs text-muted-foreground">
          {t("common.search")}
        </Label>
        <InputGroup className="w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id="invoice-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
        </InputGroup>
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor="status-filter"
          className="text-xs text-muted-foreground"
        >
          {t("sales.status")}
        </Label>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger
            id="status-filter"
            className="w-44"
            aria-label={t("sales.status")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sales.allStatuses")}</SelectItem>
            {invoiceStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`sales.statuses.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="date-from" className="text-xs text-muted-foreground">
          {t("sales.dateFrom")}
        </Label>
        <Input
          id="date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="date-to" className="text-xs text-muted-foreground">
          {t("sales.dateTo")}
        </Label>
        <Input
          id="date-to"
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-40"
        />
      </div>
    </div>
  )
}
