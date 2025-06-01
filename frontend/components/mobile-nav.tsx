"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Home, Plus, BarChart2, Vote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const navItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Create",
    href: "/create",
    icon: Plus,
  },
  {
    name: "Polls",
    href: "/polls",
    icon: BarChart2,
  },
  {
    name: "Vote",
    href: "/vote",
    icon: Vote,
  },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-4 right-4 z-50 md:hidden"
            >
              <div className="flex flex-col items-center gap-4 rounded-xl bg-black/80 backdrop-blur-md p-4 shadow-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  className="self-end rounded-full text-white hover:bg-white/20"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>

                <div className="grid grid-cols-2 gap-4 p-2">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-lg p-3 text-sm font-medium transition-colors",
                          isActive ? "bg-white text-black" : "text-white hover:bg-white/20",
                        )}
                      >
                        <item.icon className="h-6 w-6 mb-1" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
