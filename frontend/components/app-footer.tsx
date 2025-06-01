"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Github, Twitter, ExternalLink } from "lucide-react"

export function AppFooter() {
  const pathname = usePathname()

  // Don't render the footer on the landing page or vote pages
  if (pathname === "/" || pathname.startsWith("/vote/")) return null

  return (
    <footer className="w-full py-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t transition-all duration-300 animate-fade-in">
      <div className="container flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col items-center md:items-start">
          <div className="flex items-center gap-2 mb-2">
            <img src="/logo.svg" alt="SuiVote Logo" className="h-6 w-6 dark:invert-[0.15]" />
            <span className="text-sm font-semibold">SuiVote</span>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SuiVote. All rights reserved.</p>
          <p className="text-xs text-muted-foreground mt-1">Built with ❤️ by Abdul</p>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/abdxl-cloud/suiVote"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub Repository"
          >
            <Github className="h-5 w-5" />
          </Link>
          <Link
            href="https://twitter.com/suivote"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Twitter Profile"
          >
            <Twitter className="h-5 w-5" />
          </Link>
          <Link
            href="https://docs.suivote.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sui Blockchain"
          >
            <ExternalLink className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </footer>
  )
}
