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
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import type { InvoiceStatus } from "@/lib/drizzle/schema"
import { Search, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState, type ReactNode } from "react"

const invoiceStatuses: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
]

interface InvoiceFiltersProps {
  invoices: InvoiceWithClientName[]
  children?: (filteredInvoices: InvoiceWithClientName[]) => ReactNode
}

export function InvoiceFilters({
  invoices,
  children,
}: InvoiceFiltersProps) {
  const t = useTranslations()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (
        query &&
        !inv.invoiceNumber.toLowerCase().includes(query) &&
        !(inv.clientName ?? "").toLowerCase().includes(query)
      ) {
        return false
      }
      if (statusFilter !== "all" && inv.status !== statusFilter) {
        return false
      }
      if (dateFrom && inv.issueDate < dateFrom) return false
      if (dateTo && inv.issueDate > dateTo) return false
      return true
    })
  }, [invoices, searchQuery, statusFilter, dateFrom, dateTo])

  const isFiltered =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== ""

  function clearFilters() {
    setSearchQuery("")
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-end gap-3">
        <p
          className="mr-auto self-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          {t("sales.resultCount", { count: filteredInvoices.length })}
        </p>
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              if (value !== null) setStatusFilter(value)
            }}
            items={{
              all: t("sales.allStatuses"),
              ...Object.fromEntries(
                invoiceStatuses.map((s) => [s, t(`sales.statuses.${s}`)])
              ),
            }}
          >
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
            onChange={(e) => setDateFrom(e.target.value)}
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
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>
      {children?.(filteredInvoices)}
    </>
  )
}