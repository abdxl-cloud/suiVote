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
}

export function ShareDialog({ open, onOpenChange, title, url }: ShareDialogProps) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this vote</DialogTitle>
          <DialogDescription>Share this vote with your friends and colleagues</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-4 justify-between">
            <div className="grid grid-cols-3 gap-2 w-full">
              {shareLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${link.color} text-white rounded-md p-3 flex items-center justify-center transition-colors`}
                  title={link.name}
                >
                  <link.icon className="h-5 w-5" />
                  <span className="sr-only">{link.name}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={url}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 h-10 w-10"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Copy</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
