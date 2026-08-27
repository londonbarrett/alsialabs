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
import type { ProductWithStore } from "@/lib/actions/products"
import type { StoreOption } from "@/lib/actions/stores"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useOptimisticAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

interface ProductListViewProps {
  products: ProductWithStore[]
  stores: StoreOption[]
  permissions?: string[]
}

export function ProductListView({
  products,
  stores,
  permissions = [],
}: ProductListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const translateError = useActionError()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<
    ProductWithStore | undefined
  >()

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
    setEditingProduct(undefined)
  }

  function openNew() {
    setEditingProduct(undefined)
    setDialogOpen(true)
  }

  function openEdit(product: ProductWithStore) {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingProduct(undefined)
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
                        canDelete={permissions.includes(
                          "products:delete"
                        )}
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
        product={editingProduct}
        stores={stores}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
