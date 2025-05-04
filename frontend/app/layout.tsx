import type React from "react"
import "@/app/globals.css"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { SuiWalletProvider } from "@/components/wallet-provider";

export const metadata = {
  title: "SuiVote",
  description: "Decentralized voting platform on Sui blockchain",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
      <SuiWalletProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="relative flex min-h-screen flex-col">
              <AppHeader />
              <div className="flex-1">{children}</div>
              <AppFooter />
            </div>
            <Toaster />
        </ThemeProvider>
        </SuiWalletProvider>
      </body>
    </html>
  )
}
