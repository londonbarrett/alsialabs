'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductDialog } from '@/components/products/product-dialog'
import { ActionMenu } from '@/components/products/action-menu'
import { useRouter } from 'next/navigation'
import type { ProductWithProvider } from '@/lib/actions/products'
import type { ProviderOption } from '@/lib/actions/providers'

interface ProductListViewProps {
  products: ProductWithProvider[]
  providers: ProviderOption[]
  permissions?: string[]
}

export function ProductListView({ products, providers, permissions = [] }: ProductListViewProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithProvider | undefined>()

  function handleSuccess() {
    router.refresh()
    setEditingProduct(undefined)
  }

  function openNew() {
    setEditingProduct(undefined)
    setDialogOpen(true)
  }

  function openEdit(product: ProductWithProvider) {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingProduct(undefined)
  }

  return (
    <>
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">No products yet</p>
          <Button onClick={openNew} aria-label="Add product">
            <Plus />
            Add Product
          </Button>
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <Button onClick={openNew} aria-label="Add product">
              <Plus />
              Add Product
            </Button>
          </div>

          <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label="Products table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">Provider</TableHead>
                  <TableHead scope="col">SKU</TableHead>
                  <TableHead scope="col">Unit</TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="select-none" onDoubleClick={() => openEdit(product)}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.provider_name ?? '—'}</TableCell>
                    <TableCell>{product.sku ?? '—'}</TableCell>
                    <TableCell>{product.unit ?? '—'}</TableCell>
                    <TableCell>
                      <ActionMenu
                        productId={product.id}
                        productName={product.name}
                        onEdit={() => openEdit(product)}
                        canDelete={permissions.includes('products:delete')}
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
        providers={providers}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
