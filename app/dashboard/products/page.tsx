import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getProducts } from '@/lib/actions/products'
import { getProviders } from '@/lib/actions/providers'
import { ProductListView } from '@/components/products/product-list-view'

export default async function ProductsPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'products', 'view'))) {
    forbidden()
  }

  const [products, providers, permissions] = await Promise.all([
    getProducts(),
    getProviders(),
    getUserPermissions(session.user.id),
  ])

  return <ProductListView products={products} providers={providers} permissions={permissions} />
}
