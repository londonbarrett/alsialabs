"use client"

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
import { useDebounced } from "@/hooks/use-debounced"
import { searchUsers } from "@/actions/users"
import type { UserOptionDTO } from "@/actions/schemas/user"
import { UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"

interface UserInviteInputProps {
  onSelect: (user: UserOptionDTO) => void
  placeholder?: string
  excludedIds?: string[]
}

export function UserInviteInput({
  onSelect,
  placeholder,
  excludedIds,
}: UserInviteInputProps) {
  const t = useTranslations()
  const [searchResults, setSearchResults] = useState<UserOptionDTO[]>(
    []
  )
  const [selectedValue, setSelectedValue] =
    useState<UserOptionDTO | null>(null)
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
      const results = result.data ?? []
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
      onSelect(selectedValue)
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
          placeholder={placeholder ?? t("projects.searchUser")}
          showTrigger={false}
          className="h-10 w-56"
        />
        <ComboboxContent sideOffset={12}>
          {isSearching && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t("common.searching")}
              </span>
            </div>
          )}
          <ComboboxEmpty>{t("projects.noUsersFound")}</ComboboxEmpty>
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
        {t("common.invite")}
      </Button>
    </div>
  )
}
