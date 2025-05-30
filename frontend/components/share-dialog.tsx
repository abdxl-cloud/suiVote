"use client"

import { useState } from "react"
import { Check, Copy, Facebook, Twitter, Send, QrCode, X, Link, Users, Clock, Info } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
  description?: string
  endDate?: string
  participantCount?: number
  className?: string
}

export function ShareDialog({ 
  open, 
  onOpenChange, 
  title, 
  url, 
  description,
  endDate,
  participantCount,
  className 
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const [qrVisible, setQrVisible] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy: ", err)
      toast.error("Failed to copy link")
    }
  }

  const toggleQrCode = () => {
    setQrVisible(!qrVisible)
  }

  // Generate share text for social media
  const getShareText = (platform: string) => {
    const baseText = `Vote on "${title}" 🗳️`
    const callToAction = "Cast your vote now!"
    const hashtags = platform === 'twitter' ? ' #Vote #Blockchain #SuiVote' : ''
    
    return `${baseText} - ${callToAction}${hashtags}`
  }

  const shareLinks = [
    {
      name: "X (Twitter)",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText('twitter'))}&url=${encodeURIComponent(url)}`,
      color: "bg-black hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700",
    },
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(getShareText('facebook'))}`,
      color: "bg-blue-600 hover:bg-blue-700",
    },
    {
      name: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(getShareText('telegram'))}`,
      color: "bg-blue-500 hover:bg-blue-600",
    },
  ]

  // Format end date
  const formatEndDate = (dateString?: string) => {
    if (!dateString) return null
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-lg max-h-[90vh] flex flex-col ${className || ''}`}>
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Share Vote
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Share this vote with participants to collect responses
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-1 -mr-1">
          {/* Vote Info Card */}
          <div className="bg-muted/30 rounded-lg p-4 border">
            <h3 className="font-medium text-base mb-2 line-clamp-2">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
            )}
            
            <div className="flex flex-wrap gap-2">
              {participantCount !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {participantCount} participants
                </Badge>
              )}
              {endDate && formatEndDate(endDate) && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Ends {formatEndDate(endDate)}
                </Badge>
              )}
            </div>
          </div>

          {/* Share Link Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Share Link</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleQrCode}
                className="h-8 px-2 gap-1.5"
              >
                <QrCode className="h-4 w-4" />
                <span className="text-xs">QR Code</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={url}
                readOnly
                className="font-mono text-sm"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="flex-shrink-0 gap-1.5 transition-all duration-200"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            {/* QR Code Section */}
            <AnimatePresence>
              {qrVisible && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white dark:bg-gray-50 p-6 rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center">
                    <QRCodeSVG
                      value={url}
                      size={160}
                      level="H"
                      includeMargin={true}
                      className="mb-3"
                    />
                    <p className="text-xs text-center text-muted-foreground">
                      Scan with camera to open vote
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator />

          {/* Social Media Sharing */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Share on Social Media</Label>
            <div className="grid grid-cols-3 gap-3">
              {shareLinks.map((link) => (
                <Button
                  key={link.name}
                  asChild
                  variant="outline"
                  className={`${link.color} text-white border-0 hover:scale-105 transition-all duration-200 h-12 flex-col gap-1`}
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center"
                  >
                    <link.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{link.name.split(' ')[0]}</span>
                  </a>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tips Section */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full p-1 flex-shrink-0 mt-0.5">
                <Info className="h-3 w-3 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Sharing Tips
                </h4>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Share the link directly for easy access</li>
                  <li>• Use QR codes for in-person events</li>
                  <li>• Post on social media to reach more people</li>
                  {endDate && <li>• Remind participants about the deadline</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t flex-shrink-0 mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>SuiVote • Secure Blockchain Voting</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}