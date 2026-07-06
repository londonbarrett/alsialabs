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
  ItemTitle,
} from "@/components/ui/item"
import type { ClientOption } from "@/lib/actions/clients"

interface ClientComboboxProps {
  clients: ClientOption[]
  value?: string
  onValueChange: (clientId: string | null) => void
  error?: string
  disabled?: boolean
  placeholder?: string
}

export function ClientCombobox({
  clients,
  value,
  onValueChange,
  error,
  disabled,
  placeholder = "Select a client",
}: ClientComboboxProps) {
  const selected = clients.find((c) => c.id === value) ?? null

  return (
    <div>
      <Combobox
        items={clients}
        value={selected}
        onValueChange={(client) => onValueChange(client?.id ?? null)}
        itemToStringValue={(client) => client?.name ?? ""}
        itemToStringLabel={(client) => client?.name ?? ""}
        disabled={disabled}
      >
        <ComboboxInput
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
        />
        <ComboboxContent>
          <ComboboxEmpty>No clients found.</ComboboxEmpty>
          <ComboboxList>
            {(client) => (
              <ComboboxItem key={client.id} value={client}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {client.name}
                    </ItemTitle>
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
