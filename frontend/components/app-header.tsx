"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Moon, Sun, LayoutDashboard, Plus, BarChart2, Vote, MoreVertical, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useMediaQuery } from "@/hooks/use-media-query"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { WalletConnectButton } from "@/components/wallet-connect-button"

export function AppHeader() {
  const { setTheme, theme } = useTheme()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const isTablet = useMediaQuery("(max-width: 1024px)")
  const pathname = usePathname()
  const [isLandingPage, setIsLandingPage] = useState(pathname === "/")

  // Check if we're on the landing page or voting page
  useEffect(() => {
    setIsLandingPage(pathname === "/" || pathname.includes("/vote/"))
  }, [pathname])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    // Store theme preference in localStorage
    localStorage.setItem("theme-preference", newTheme)
  }

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
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

  const handleCheckStoredTheme = useCallback(() => {
    // Check for stored theme preference
    const storedTheme = localStorage.getItem("theme-preference")
    if (storedTheme) {
      setTheme(storedTheme)
    } else {
      // Default to system theme
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark")
      } else {
        setTheme("light")
      }
    }
  }, [setTheme])

  useEffect(() => {
    handleCheckStoredTheme()
  }, [handleCheckStoredTheme])

  // Don't render the header on the landing page
  if (isLandingPage) return null

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        isScrolled && "shadow-lg border-border/50",
        isLandingPage && "bg-transparent border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between px-6">
        <div className="flex items-center">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="h-9 w-9 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12">
              <img 
                src="/logo.svg" 
                alt="SuiVote Logo" 
                className="h-full w-full drop-shadow-sm" 
              />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-primary via-blue-600 to-purple-600 bg-clip-text text-transparent">
              SuiVote
            </span>
          </Link>
        </div>

        {/* Desktop Navigation - Centered */}
        <div className="hidden md:flex justify-center absolute left-1/2 transform -translate-x-1/2">
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <TooltipProvider key={item.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-accent hover:text-accent-foreground group relative",
                          isTablet ? "px-3" : "px-4 space-x-2",
                          isActive
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn(
                          "h-4 w-4 transition-all duration-200",
                          isActive ? "text-blue-600 dark:text-blue-400" : "group-hover:scale-110"
                        )} />
                        {!isTablet && <span>{item.name}</span>}
                        {isActive && (
                          <div className="absolute inset-0 rounded-lg bg-blue-500/5 -z-10" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9 hover:bg-accent/80 transition-all duration-200"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <WalletConnectButton variant="default" size="sm" className="shadow-sm" />

          {/* Mobile Menu Button */}
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(true)}>
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 left-0 right-0 z-50 md:hidden"
            >
              <div className="bg-background/95 backdrop-blur-md p-4 border-b">
                <div className="flex items-center justify-between mb-6">
                  <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                    <div className="rounded-full bg-black p-1.5 dark:bg-white">
                      <div className="h-5 w-5 rounded-full bg-white dark:bg-black" />
                    </div>
                    <span className="text-xl font-extrabold tracking-tight">SuiVote</span>
                  </Link>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <nav className="grid grid-cols-2 gap-2">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg p-3 text-sm font-medium transition-colors",
                          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
