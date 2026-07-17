"use client"

import { useState, useRef, useCallback, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
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
import { UserPlus } from "lucide-react"
import { searchUsers } from "@/lib/actions/users"
import type { UserOption } from "@/lib/actions/users"

interface UserInviteInputProps {
  onSelect: (userId: string) => Promise<void> | void
  placeholder?: string
}

export function UserInviteInput({
  onSelect,
  placeholder,
}: UserInviteInputProps) {
  const t = useTranslations("projects")
  const [searchResults, setSearchResults] = useState<UserOption[]>([])
  const [selectedValue, setSelectedValue] = useState<UserOption | null>(
    null
  )
  const [isSearching, startSearchTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      startSearchTransition(async () => {
        const results = await searchUsers(query)
        if (!controller.signal.aborted) {
          setSearchResults(results)
        }
      })
    }, 300)
  }, [])

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
        onOpenChangeComplete={(open) => {
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
            <ComboboxStatus>
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                {t("searching")}
              </span>
            </ComboboxStatus>
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
