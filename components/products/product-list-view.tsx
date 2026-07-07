'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { ActionMenu } from '@/components/common/action-menu'
import { deleteProduct } from '@/lib/actions/products'
import { toast } from 'sonner'
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
  const t = useTranslations()
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
          <p className="text-muted-foreground">{t('products.noProducts')}</p>
          <Button onClick={openNew} aria-label={t('products.addProduct')}>
            <Plus />
            {t('products.addProduct')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{t('products.title')}</h1>
            <Button onClick={openNew} aria-label={t('products.addProduct')}>
              <Plus />
              {t('products.addProduct')}
            </Button>
          </div>

            <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label={t('products.title')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('products.name')}</TableHead>
                  <TableHead scope="col">{t('products.provider')}</TableHead>
                  <TableHead scope="col">{t('products.sku')}</TableHead>
                  <TableHead scope="col">{t('products.unit')}</TableHead>
                  <TableHead scope="col">{t('products.actions')}</TableHead>
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
                        entityName={product.name}
                        onEdit={() => openEdit(product)}
                        onDelete={async () => {
                          const result = await deleteProduct(product.id)
                          if (!result.success) toast.error(result.error || t('products.failedToDelete'))
                          else toast.success(t('products.productDeleted'))
                        }}
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
