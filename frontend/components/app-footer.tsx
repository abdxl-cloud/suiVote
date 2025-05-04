"use client"

import { usePathname } from "next/navigation"

export function AppFooter() {
  const pathname = usePathname()

  // Don't render the footer on the landing page
  if (pathname === "/") return null

  return (
    <footer className="w-full py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex justify-center items-center">
        <p className="text-sm text-muted-foreground">with ❤️ by Abdul</p>
      </div>
    </footer>
  )
}
