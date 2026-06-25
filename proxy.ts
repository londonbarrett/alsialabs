export { auth as proxy } from '@/lib/auth'

export const proxyConfig = {
  matcher: ['/dashboard/:path*'],
}
