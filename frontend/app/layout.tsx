import type React from "react"
import "@/app/globals.css"
import "@/styles/enhanced-styles.css"
import { Poppins, Inter } from "next/font/google"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { SuiWalletProvider } from "@/components/wallet-provider";

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: '--font-poppins',
})

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
})

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
      <body className={`${poppins.variable} ${inter.variable} min-h-screen bg-background font-sans antialiased`}>
      <SuiWalletProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="relative flex min-h-screen flex-col">
              <AppHeader />
              <main className="flex-1 w-full animate-fade-in-up">{children}</main>
              <AppFooter />
              <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-gray-950 bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#303030_1px,transparent_1px),linear-gradient(to_bottom,#303030_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]">
              </div>
            </div>
            <Toaster />
        </ThemeProvider>
        </SuiWalletProvider>
      </body>
    </html>
  )
}
