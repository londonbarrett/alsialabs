import { getUserStores } from "@/actions/not-safe/stores"
import { getProducts } from "@/actions/products"
import { ProductListView } from "@/components/products/product-list-view"
import { auth, hasPermission } from "@/lib/auth"
import { unwrapResponse } from "@/lib/util/unwrap"
import { forbidden } from "next/navigation"

export default async function ProductsPage() {
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "products", "view"))
  ) {
    forbidden()
  }

  const [productsResult, storesResult] = await Promise.all([
    getProducts(),
    getUserStores(),
  ])

  const products = unwrapResponse(productsResult)
  const stores = storesResult.data ?? []

  return <ProductListView products={products} stores={stores} />
}
