"use client"

import { useState, useRef, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
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
import { UserPlus } from "lucide-react"
import { useDebounced } from "@/hooks/use-debounced"
import { searchUsers } from "@/lib/actions/users"
import type { UserOption } from "@/lib/actions/users"

interface UserInviteInputProps {
  onSelect: (userId: string) => Promise<void> | void
  placeholder?: string
  excludedIds?: string[]
}

export function UserInviteInput({
  onSelect,
  placeholder,
  excludedIds,
}: UserInviteInputProps) {
  const t = useTranslations("projects")
  const [searchResults, setSearchResults] = useState<UserOption[]>([])
  const [selectedValue, setSelectedValue] = useState<UserOption | null>(
    null
  )
  const [isSearching, startSearchTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useDebounced((query: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    startSearchTransition(async () => {
      const result = await searchUsers({ query, excludedIds })
      const results = (result.data ?? []) as UserOption[]
      const filtered = excludedIds?.length
        ? results.filter((u) => !excludedIds.includes(u.id))
        : results
      if (!controller.signal.aborted) {
        setSearchResults(filtered)
      }
    })
  }, 300)

  const items =
    selectedValue &&
    !searchResults.some((u) => u.id === selectedValue.id)
      ? [selectedValue, ...searchResults]
      : searchResults

  const handleInvite = () => {
    if (selectedValue) {
      onSelect(selectedValue.id)
      setSelectedValue(null)
      setSearchResults([])
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Combobox
        items={items}
        value={selectedValue}
        onValueChange={(user) => {
          setSelectedValue(user)
        }}
        itemToStringValue={(user) => user?.name ?? ""}
        itemToStringLabel={(user) => user?.name ?? ""}
        onInputValueChange={(inputValue, { reason }) => {
          if (reason === "item-press") return
          handleSearch(inputValue)
        }}
        onOpenChange={(open) => {
          if (!open && selectedValue) {
            setSearchResults([])
          }
        }}
        filter={null}
      >
        <ComboboxInput
          placeholder={placeholder ?? t("searchUser")}
          showTrigger={false}
          className="h-10 w-56"
        />
        <ComboboxContent sideOffset={12}>
          {isSearching && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t("searching")}
              </span>
            </div>
          )}
          <ComboboxEmpty>{t("noUsersFound")}</ComboboxEmpty>
          <ComboboxList>
            {(user) => (
              <ComboboxItem key={user.id} value={user}>
                <Item size="xs" className="p-0">
                  <ItemContent>
                    <ItemTitle className="whitespace-nowrap">
                      {user.name}
                    </ItemTitle>
                    <ItemDescription>{user.email}</ItemDescription>
                  </ItemContent>
                </Item>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <Button
        size="lg"
        onClick={handleInvite}
        disabled={!selectedValue}
      >
        <UserPlus className="size-4" />
        {t("invite")}
      </Button>
    </div>
  )
}
