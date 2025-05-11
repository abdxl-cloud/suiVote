"use client"

import { useState } from "react"
import { Check, Copy, Facebook, Twitter, Send } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
  className?: string
}

export function ShareDialog({ open, onOpenChange, title, url, className }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy: ", err)
    }
  }

  const shareLinks = [
    {
      name: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      name: "X",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      color: "bg-black hover:bg-gray-800",
    },
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      color: "bg-blue-600 hover:bg-blue-700",
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md ${className || ''}`}>
        <DialogHeader className="pb-2 sm:pb-4">
          <DialogTitle className="text-lg sm:text-xl">Share this vote</DialogTitle>
          <DialogDescription className="text-sm">Share this vote with your friends and colleagues</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 sm:gap-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${link.color} text-white rounded-md p-2 sm:p-3 flex items-center justify-center transition-colors`}
                  title={link.name}
                >
                  <link.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sr-only">{link.name}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="relative flex items-center mt-1">
            <input
              type="text"
              readOnly
              value={url}
              className="flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-9 sm:pr-10 truncate"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 h-9 sm:h-10 w-9 sm:w-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              <span className="sr-only">Copy</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
