import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "next-themes"
import { SessionProvider } from "@/components/session-provider"
import { LoadingProvider } from "@/components/common/app-loading-indicator"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Alsia Labs CRM",
  description: "Spec-driven development dashboard",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        geistMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body className="flex min-h-full flex-col">
        <LoadingProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NextIntlClientProvider messages={messages}>
              <SessionProvider>
                <TooltipProvider delayDuration={0}>
                  {children}
                </TooltipProvider>
                <Toaster richColors />
              </SessionProvider>
            </NextIntlClientProvider>
          </ThemeProvider>
        </LoadingProvider>
      </body>
    </html>
  )
}
