"use client"

import React, {createContext, useCallback, useContext, useState} from "react"
import {Transaction} from "@mysten/sui/transactions"
import {useSuiVote} from "@/hooks/use-suivote"
import {toast} from "sonner"

// Define the environment variables for Walrus service
// In a real implementation, these would come from environment variables
const WALRUS_PUBLISHER_URL = process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || "https://publisher.testnet.walrus.xyz"
const WALRUS_AGGREGATOR_URL = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL || "https://aggregator.testnet.walrus.xyz"
const WALRUS_STORAGE_EPOCHS = process.env.NEXT_PUBLIC_WALRUS_STORAGE_EPOCHS || "10"

// Media file type definition
interface MediaFile {
  id: string
  file: File
  dataUrl: string
  contentType: string
  status: 'pending' | 'uploading' | 'complete' | 'error'
  blobId?: string // Added for Walrus blob ID
  suiObjectId?: string // Added for Sui object reference
}

// Media handlers context interface
interface MediaHandlersContextType {
  mediaFiles: MediaFile[]
  uploadProgress: Record<string, number>
  loading: boolean
  addMediaFile: (file: File) => string // Returns the file ID
  removeMediaFile: (fileId: string) => void
  getMediaFileById: (fileId: string) => MediaFile | undefined
  createVoteWithMedia: (params: {
    voteTitle: string
    voteDescription: string
    startDate?: Date
    endDate?: Date
    requiredToken?: string
    requiredAmount?: string
    paymentAmount?: string
    requireAllPolls?: boolean,
    showLiveStats?: boolean,
    isTokenWeighted?: boolean
    tokenWeight?: string
    enableWhitelist?: boolean
    whitelistAddresses?: string[]
    polls: any[]
    onSuccess?: (voteId: string) => void
  }) => Promise<{ transaction: Transaction, execute: () => Promise<any> }>
  reset: () => void
}

export function VoteMediaHandler({ children }: { children: (handlers: MediaHandlersContextType) => React.ReactNode }) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const { createCompleteVoteTransaction, executeTransaction } = useSuiVote()

  // Add media file with preview
  const addMediaFile = useCallback((file: File): string => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    
    // Create a data URL for preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setMediaFiles(prev => [
        ...prev,
        {
          id: fileId,
          file,
          dataUrl: e.target?.result as string,
          contentType: file.type,
          status: 'pending'
        }
      ])
    }
    reader.readAsDataURL(file)
    
    // Initialize progress
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
    
    return fileId
  }, [])

  // Remove media file
  const removeMediaFile = useCallback((fileId: string) => {
    setMediaFiles(prev => prev.filter(media => media.id !== fileId))
    setUploadProgress(prev => {
      const newProgress = { ...prev }
      delete newProgress[fileId]
      return newProgress
    })
  }, [])

  // Get media file by ID
  const getMediaFileById = useCallback((fileId: string) => {
    return mediaFiles.find(media => media.id === fileId)
  }, [mediaFiles])

  // Function to upload a file to Walrus storage
  const uploadToWalrus = useCallback(async (file: File, fileId: string): Promise<{ blobId: string, suiObjectId: string }> => {
    try {
      // Update file status
      setMediaFiles(prev => prev.map(media => 
        media.id === fileId ? { ...media, status: 'uploading' } : media
      ))
      
      // Update progress to 10% - starting upload
      setUploadProgress(prev => ({ ...prev, [fileId]: 10 }))
      
      console.log(`Uploading file ${fileId} to Walrus...`)
      
      // Walrus API requires sending the file directly
      const uploadUrl = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${WALRUS_STORAGE_EPOCHS}`
      
      // Create upload request
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
      })
      
      // Update progress to 50% - upload completed
      setUploadProgress(prev => ({ ...prev, [fileId]: 50 }))
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`)
      }
      
      // Parse the response
      const responseData = await response.json()
      console.log("Walrus upload response:", responseData)
      
      let blobId = ""
      let suiObjectId = ""
      
      // Extract blob ID and Sui object ID from response based on response format
      if (responseData.newlyCreated) {
        // For newly created blobs
        blobId = responseData.newlyCreated.blobObject.blobId
        suiObjectId = responseData.newlyCreated.blobObject.id
      } else if (responseData.alreadyCertified) {
        // For blobs that already exist
        blobId = responseData.alreadyCertified.blobId
        suiObjectId = responseData.alreadyCertified.event.objectId || ""
      } else {
        throw new Error("Unexpected response format from Walrus")
      }
      
      // Update progress to 100% - processing completed
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
      
      // Update media file status and IDs
      setMediaFiles(prev => prev.map(media => 
        media.id === fileId ? { 
          ...media, 
          status: 'complete', 
          blobId, 
          suiObjectId 
        } : media
      ))
      
      return { blobId, suiObjectId }
    } catch (error) {
      console.error(`Error uploading file ${fileId} to Walrus:`, error)
      
      // Update media file status to error
      setMediaFiles(prev => prev.map(media => 
        media.id === fileId ? { ...media, status: 'error' } : media
      ))
      
      throw error
    }
  }, [])

  // This function creates a transaction that includes both the vote creation and media upload
  const createVoteWithMedia = useCallback(async (params: {
    voteTitle: string
    voteDescription: string
    startDate?: Date
    endDate?: Date
    requiredToken?: string
    requiredAmount?: string
    paymentAmount?: string
    requireAllPolls?: boolean
    showLiveStats?: boolean
    isTokenWeighted?: boolean       
    tokenWeight?: string            
    enableWhitelist?: boolean        
    whitelistAddresses?: string[]
    polls: any[]
    onSuccess?: (voteId: string) => void
  }) => {
    try {
      setLoading(true)
      
      // Collect used media files
      const usedMediaFiles = new Map<string, MediaFile>()
      
      params.polls.forEach(poll => {
        poll.options.forEach((option: any) => {
          if (option.fileId) {
            const mediaFile = getMediaFileById(option.fileId)
            if (mediaFile) {
              usedMediaFiles.set(option.fileId, mediaFile)
            }
          }
        })
      })
      
      // Upload all media files to Walrus first
      const uploadPromises = Array.from(usedMediaFiles.entries()).map(
        async ([fileId, mediaFile]) => {
          // Only upload files that haven't been uploaded yet
          if (!mediaFile.blobId) {
            const result = await uploadToWalrus(mediaFile.file, fileId)
            return { fileId, ...result }
          }
          return { fileId, blobId: mediaFile.blobId, suiObjectId: mediaFile.suiObjectId || "" }
        }
      )
      
      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises)
      
      // Create a map of fileId to Walrus blob URLs
      const blobUrlMap = new Map<string, string>()
      uploadResults.forEach(result => {
        blobUrlMap.set(result.fileId, `sui://blob/${result.blobId}`)
      })
      
      // Convert poll data to the format expected by the service
      const pollData = params.polls.map(poll => ({
        title: poll.title,
        description: poll.description,
        isMultiSelect: poll.isMultiSelect,
        maxSelections: poll.maxSelections,
        isRequired: poll.isRequired,
        options: poll.options.map((option: any) => {
          // Replace option.mediaUrl with Walrus blob URL if a fileId exists
          return {
            text: option.text,
            mediaUrl: option.fileId && blobUrlMap.has(option.fileId) 
              ? blobUrlMap.get(option.fileId) 
              : option.mediaUrl
          }
        })
      }))
      
      // Format the transaction parameters
      const startTimestamp = params.startDate ? params.startDate.getTime() : Date.now()
      const endTimestamp = params.endDate ? params.endDate.getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000
      const requiredToken = params.requiredToken !== "none" ? params.requiredToken : ""
      const requiredAmount = parseInt(params.requiredAmount || "0", 10)
      const paymentAmount = parseInt(params.paymentAmount || "0", 10)
      const requireAllPolls = params.requireAllPolls !== undefined ? params.requireAllPolls : true
      const showLiveStats = params.showLiveStats !== undefined ? params.showLiveStats : false

      console.log(pollData)
      // Create a transaction using the SuiVoteService

      console.log(params.whitelistAddresses)
      const transaction = createCompleteVoteTransaction(
        params.voteTitle,
        params.voteDescription,
        startTimestamp,
        endTimestamp,
        requiredToken,
        requiredAmount,
        paymentAmount,
        requireAllPolls,
        showLiveStats,
        pollData,
        params.isTokenWeighted || false,
        params.tokenWeight || "1",
        params.whitelistAddresses || []
      )
      
      // Wrap transaction for execution
      return {
        transaction,
        execute: async () => {
          try {
            const result = await executeTransaction(transaction)

            // Call success callback if provided
            if (result && params.onSuccess) {
              // Extract vote ID from result if available
              const voteId = result.objectChanges?.find((change: { type: string; objectType: string | string[] }) =>
                  change.type === 'created' &&
                  change.objectType.includes('::voting::Vote')
              )?.objectId

              if (voteId) {
                params.onSuccess(voteId)
              }
            }

            return result
          } catch (error) {
            console.error('Transaction execution error:', error)
            throw error
          }
        }
      }
    } catch (error) {
      console.error('Create vote with media error:', error)
      toast.error('Failed to create vote transaction')
      throw error
    } finally {
      setLoading(false)
    }
  }, [mediaFiles, getMediaFileById, uploadToWalrus, createCompleteVoteTransaction, executeTransaction])

  // Reset all state
  const reset = useCallback(() => {
    setMediaFiles([])
    setUploadProgress({})
    setLoading(false)
  }, [])

  // Create handler object
  const handlers: MediaHandlersContextType = {
    mediaFiles,
    uploadProgress,
    loading,
    addMediaFile,
    removeMediaFile,
    getMediaFileById,
    createVoteWithMedia,
    reset
  }

  return <>{children(handlers)}</>
}

// Export hook for accessing the media handlers
export function useMediaHandlers() {
  const context = useContext(MediaHandlersContext)
  if (!context) {
    throw new Error('useMediaHandlers must be used within a VoteMediaHandler')
  }
  return context
}

// Create context
const MediaHandlersContext = createContext<MediaHandlersContextType | undefined>(undefined)