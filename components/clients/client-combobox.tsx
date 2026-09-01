"use client"

import { useState, useRef, useTransition } from "react"
import { useDebounced } from "@/hooks/use-debounced"
import { useTranslations } from "next-intl"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
} from "@/components/ui/combobox"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import {
  getClientByClientId,
  searchClients,
} from "@/lib/actions/clients"
import type { ClientOption } from "@/lib/actions/clients"

interface ClientComboboxProps {
  value?: string
  onValueChange: (clientId: string | null) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

export function ClientCombobox({
  value,
  onValueChange,
  error,
  disabled,
  placeholder,
}: ClientComboboxProps) {
  const t = useTranslations("clients")
  const [searchResults, setSearchResults] = useState<ClientOption[]>([])
  const [selectedValue, setSelectedValue] =
    useState<ClientOption | null>(null)
  const [isPending, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useDebounced((query: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    startTransition(async () => {
      const result = await searchClients({ query })
      if (!controller.signal.aborted) {
        setSearchResults(result.data ?? [])
      }
    })
  }, 300)

  const handleOpenChange = async (open: boolean) => {
    if (open && value && !selectedValue) {
      const result = await getClientByClientId({ id: value })
      if (result.data) {
        setSelectedValue({
          id: result.data.id,
          name: result.data.name,
          phone: result.data.phone,
        })
      }
    }
  }

  const items =
    selectedValue &&
    !searchResults.some((c) => c.id === selectedValue.id)
      ? [selectedValue, ...searchResults]
      : searchResults

  return (
    <div>
      <Combobox
        items={items}
        value={selectedValue}
        onValueChange={(client) => {
          setSelectedValue(client ?? null)
          onValueChange(client?.id ?? null)
        }}
        itemToStringValue={(client) => client?.name ?? ""}
        itemToStringLabel={(client) => client?.name ?? ""}
        onInputValueChange={(inputValue, { reason }) => {
          if (reason === "item-press") return
          handleSearch(inputValue)
        }}
        onOpenChange={(open) => {
          handleOpenChange(open)
          if (!open && selectedValue) {
            setSearchResults([])
          }
        }}
        filter={null}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={placeholder ?? t("selectClient")}
          aria-invalid={!!error || undefined}
          showClear
        />
        <ComboboxContent>
          {isPending && (
            <ComboboxStatus>
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t("searching")}
              </span>
            </ComboboxStatus>
          )}
          <ComboboxEmpty>{t("noClientsFound")}</ComboboxEmpty>
          <ComboboxList>
            {(client) => (
              <ComboboxItem key={client.id} value={client}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {client.name}
                    </ItemTitle>
                    <ItemDescription>{client.phone}</ItemDescription>
                  </ItemContent>
                </Item>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
