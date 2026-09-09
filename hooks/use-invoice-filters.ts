"use client"

import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { useMemo, useState } from "react"

export function useInvoiceFilters(invoices: InvoiceWithClientName[]) {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
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

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filteredInvoices,
    isFiltered,
    clearFilters,
  }
}
