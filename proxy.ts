import { auth } from "@/lib/auth"

export const proxy = auth((request) => {
  const isAuthenticated = !!request.auth
  const pathname = request.nextUrl.pathname

  if (isAuthenticated && (pathname === "/login" || pathname === "/")) {
    return Response.redirect(new URL("/app", request.url))
  }

  if (!isAuthenticated && pathname.startsWith("/app")) {
    return Response.redirect(new URL("/login", request.url))
  }

  return undefined
})

export const proxyConfig = {
  matcher: ["/", "/login", "/app/:path*"],
}
