"use client"

import { useState, useEffect } from "react"
import { X, Image as ImageIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MediaPreviewProps {
  mediaUrl: string | null
  onRemove: () => void
  className?: string
  size?: "sm" | "md" | "lg"
}

export function MediaPreview({
  mediaUrl,
  onRemove,
  className,
  size = "md",
}: MediaPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Reset loading state when mediaUrl changes
  useEffect(() => {
    if (mediaUrl) {
      setLoading(true)
      setError(false)
    }
  }, [mediaUrl])

  // Size classes
  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  }

  if (!mediaUrl) return null

  return (
    <div
      className={cn(
        "relative group overflow-hidden rounded-md border bg-background",
        sizeClasses[size],
        className
      )}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="relative h-5 w-5">
            <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <img
        src={mediaUrl}
        alt="Media preview"
        className={cn(
          "h-full w-full object-cover transition-opacity",
          loading ? "opacity-0" : "opacity-100",
          error ? "hidden" : "block"
        )}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />

      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}