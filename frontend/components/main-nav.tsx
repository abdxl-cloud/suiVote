"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Plus, BarChart2, Vote } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

export function MainNav() {
  const pathname = usePathname()

  return (
    <TooltipProvider>
      <nav className="flex items-center gap-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted",
                    isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                  )}
                  aria-label={item.name}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{item.name}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
