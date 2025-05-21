"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, FileImage, FileCheck, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface MediaFileUploaderProps {
  onFileSelect: (file: File | null) => void
  disabled?: boolean
  acceptedTypes?: string
  maxSize?: number // In megabytes
}

export function MediaFileUploader({
  onFileSelect,
  disabled = false,
  acceptedTypes = "image/*",
  maxSize = 5, // Default 5MB
}: MediaFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Convert maxSize to bytes
  const maxSizeBytes = maxSize * 1024 * 1024

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxSizeBytes) {
      setError(`File size exceeds the ${maxSize}MB limit`)
      return false
    }

    // Check file type
    if (acceptedTypes !== "*") {
      const fileType = file.type
      const acceptedTypeArray = acceptedTypes.split(",")
      
      const isAccepted = acceptedTypeArray.some(type => {
        // Handle wildcards, e.g., image/*
        if (type.endsWith("/*")) {
          const mainType = type.split("/")[0]
          return fileType.startsWith(`${mainType}/`)
        }
        return type === fileType
      })

      if (!isAccepted) {
        setError(`File type not accepted. Please upload ${acceptedTypes.replace("image/*", "an image")}`)
        return false
      }
    }

    return true
  }

  const processFile = (file: File) => {
    if (!validateFile(file)) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Create a preview URL for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = () => {
          setPreviewUrl(reader.result as string)
          setIsProcessing(false)
          onFileSelect(file)
        }
        reader.onerror = () => {
          setError("Failed to read file")
          setIsProcessing(false)
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files, just pass the file
        setIsProcessing(false)
        onFileSelect(file)
      }
    } catch (err) {
      console.error("File processing error:", err)
      setError("Failed to process file")
      setIsProcessing(false)
      toast.error("Failed to process file")
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      processFile(file)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      processFile(file)
    }
  }

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const clearFile = () => {
    setPreviewUrl(null)
    onFileSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {previewUrl ? (
        <div className="flex items-center gap-3">
          <MediaPreview 
            mediaUrl={previewUrl} 
            onRemove={handleRemoveFile} 
            size="md" 
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => !disabled && fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="h-9 text-xs"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Processing...
              </>
            ) : (
              <>Change Media</>
            )}
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            disabled && "opacity-50 cursor-not-allowed",
            "relative"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleFileInputChange}
            disabled={disabled}
            className="sr-only"
          />

          <div className="flex flex-col items-center justify-center space-y-2 py-3 text-center">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="rounded-full bg-primary/10 p-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {disabled ? "Upload disabled" : buttonText}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {acceptedTypes === "image/*"
                      ? `Images up to ${maxSize}MB`
                      : `Files up to ${maxSize}MB`}
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground p-2 text-xs">
              <div className="flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>{error}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}