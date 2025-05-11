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
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-muted/30",
          error ? "border-red-500/50" : ""
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={disabled ? undefined : triggerFileInput}
      >
        <Input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={handleFileInputChange}
          disabled={disabled}
        />

        <div className="py-4 flex flex-col items-center gap-2">
          {isProcessing ? (
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
          ) : previewUrl ? (
            <div className="flex flex-col items-center">
              <div className="relative mb-2">
                <img src={previewUrl} alt="Preview" className="w-auto h-32 object-contain rounded-md" />
              </div>
              <FileCheck className="h-6 w-6 text-green-500" />
              <span className="text-sm text-muted-foreground mt-1">File ready for Walrus storage</span>
            </div>
          ) : (
            <>
              {error ? (
                <AlertCircle className="h-10 w-10 text-red-500" />
              ) : (
                <>
                  {acceptedTypes === "image/*" || acceptedTypes.includes("image/") ? (
                    <FileImage className="h-10 w-10 text-muted-foreground" />
                  ) : (
                    <Upload className="h-10 w-10 text-muted-foreground" />
                  )}
                </>
              )}
              <div className="mt-2 space-y-1">
                {error ? (
                  <p className="text-sm font-medium text-red-500">{error}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      {acceptedTypes === "image/*"
                        ? "Drag & drop an image or click to browse"
                        : "Drag & drop a file or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Files will be stored on Walrus decentralized storage
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {`Maximum file size: ${maxSize}MB`}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {previewUrl && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              clearFile()
            }}
            disabled={disabled}
          >
            Remove File
          </Button>
        </div>
      )}
    </div>
  )
}