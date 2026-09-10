"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,

} from "@/components/ui/combobox"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import { useDebounced } from "@/hooks/use-debounced"
import type { ClientOption } from "@/lib/actions/clients"
import { searchClients } from "@/lib/actions/clients"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"

interface ClientComboboxProps {
  value?: ClientOption | null
  onValueChange: (client: ClientOption | null) => void
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

  const items =
    value && !searchResults.some((c) => c.id === value.id)
      ? [value, ...searchResults]
      : searchResults

  return (
    <div>
      <Combobox
        items={items}
        value={value ?? null}
        onValueChange={onValueChange}
        itemToStringValue={(client) => client?.name ?? ""}
        itemToStringLabel={(client) => client?.name ?? ""}
        onInputValueChange={(inputValue, { reason }) => {
          if (reason === "item-press") return
          handleSearch(inputValue)
        }}
        onOpenChange={(open) => {
          if (!open) {
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
          disabled={disabled}
        />
        <ComboboxContent>
          {isPending && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t("searching")}
              </span>
            </div>
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
