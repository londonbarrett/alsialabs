import { ProductListView } from "@/components/products/product-list-view"
import { getProducts } from "@/lib/actions/products"
import { getUserStores } from "@/lib/actions/stores"
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

  const [productsResult, stores] = await Promise.all([
    getProducts(),
    getUserStores(),
  ])

  const products = unwrapResponse(productsResult)

  return (
    <ProductListView
      products={products}
      stores={stores}
    />
  )
}
