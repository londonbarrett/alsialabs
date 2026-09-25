"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { ProductDialog } from "@/components/products/product-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteProduct } from "@/lib/actions/products"
import { useActionError } from "@/lib/util/action-errors"
import type { ProductWithStore } from "@/lib/types"
import type { StoreOption } from "@/lib/actions/stores"
import { useHasPermission } from "@/stores/permissions-store"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useOptimisticAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface ProductListViewProps {
  products: ProductWithStore[]
  stores: StoreOption[]
}

export function ProductListView({
  products,
  stores,
}: ProductListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const translateError = useActionError()
  const canDelete = useHasPermission("products:delete")
  const [dialog, setDialog] = useState<{
    open: boolean
    product?: ProductWithStore
  }>({ open: false })

  const { executeAsync, optimisticState } = useOptimisticAction(
    deleteProduct,
    {
      currentState: products,
      updateFn: (currentProducts, { id }) => {
        return currentProducts.filter((p) => p.id !== id)
      },
      onSuccess: () => {
        toast.success(t("products.productDeleted"))
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(translateError(error.serverError.code))
        }
        router.refresh()
      },
    }
  )

  function handleSuccess() {
    router.refresh()
    setDialog({ open: false })
  }

  function openNew() {
    setDialog({ open: true })
  }

  function openEdit(product: ProductWithStore) {
    setDialog({ open: true, product })
  }

  function handleOpenChange(open: boolean) {
    setDialog((s) => (open ? s : { open: false }))
  }

  return (
    <>
      {optimisticState.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">
            {t("products.noProducts")}
          </p>
          <Button
            onClick={openNew}
            aria-label={t("products.addProduct")}
          >
            <Plus />
            {t("products.addProduct")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("products.title")}
            </h1>
            <Button
              onClick={openNew}
              aria-label={t("products.addProduct")}
            >
              <Plus />
              {t("products.addProduct")}
            </Button>
          </div>

          <div
            className="max-h-[calc(100vh-10rem)] overflow-auto rounded-md border"
            role="region"
            aria-label={t("products.title")}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    {t("products.name")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("products.store")}
                  </TableHead>
                  <TableHead scope="col">{t("products.sku")}</TableHead>
                  <TableHead scope="col">
                    {t("products.unit")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("products.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimisticState.map((product) => (
                  <TableRow
                    key={product.id}
                    className="select-none"
                    onDoubleClick={() => openEdit(product)}
                  >
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.store_name ?? "—"}</TableCell>
                    <TableCell>{product.sku ?? "—"}</TableCell>
                    <TableCell>{product.unit ?? "—"}</TableCell>
                    <TableCell>
                      <ActionMenu
                        entityName={product.name}
                        onEdit={() => openEdit(product)}
                        onDelete={async () => {
                          await executeAsync({ id: product.id })
                        }}
                        canDelete={canDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <ProductDialog
        product={dialog.product}
        stores={stores}
        open={dialog.open}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
