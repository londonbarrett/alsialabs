"use client"

import { useState, useRef, useCallback, useEffect, useTransition } from "react"
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
import { searchClients, getClientByClientId } from "@/lib/actions/clients"
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
  const t = useTranslations('clients')
  const [searchResults, setSearchResults] = useState<ClientOption[]>([])
  const [selectedValue, setSelectedValue] = useState<ClientOption | null>(null)
  const [isPending, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (!value || resolvedRef.current) return
    resolvedRef.current = true
    getClientByClientId(value).then((client) => {
      if (client) {
        setSelectedValue({ id: client.id, name: client.name, phone: client.phone })
      }
    })
  }, [value])

  const handleSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (!query.trim()) {
        setSearchResults([])
        return
      }

      startTransition(async () => {
        const results = await searchClients(query)
        if (!controller.signal.aborted) {
          setSearchResults(results)
        }
      })
    }, 300)
  }, [])

  const items = selectedValue && !searchResults.some((c) => c.id === selectedValue.id)
    ? [selectedValue, ...searchResults]
    : searchResults

  return (
    <div>
      <Combobox
        items={items}
        value={selectedValue}
        onValueChange={(client) => {
          setSelectedValue(client)
          onValueChange(client?.id ?? null)
        }}
        itemToStringValue={(client) => client?.name ?? ""}
        itemToStringLabel={(client) => client?.name ?? ""}
        onInputValueChange={(inputValue, { reason }) => {
          if (reason === "item-press") return
          handleSearch(inputValue)
        }}
        onOpenChangeComplete={(open) => {
          if (!open && selectedValue) {
            setSearchResults([])
          }
        }}
        filter={null}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={placeholder ?? t('selectClient')}
          aria-invalid={!!error || undefined}
        />
        <ComboboxContent>
          {isPending && (
            <ComboboxStatus>
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t('searching')}
              </span>
            </ComboboxStatus>
          )}
          <ComboboxEmpty>{t('noClientsFound')}</ComboboxEmpty>
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
