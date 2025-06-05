import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { WalrusClient } from '@mysten/walrus'

// Initialize Sui client
const suiClient = new SuiClient({
  url: getFullnodeUrl('testnet'),
})

// Initialize Walrus client
const walrusClient = new WalrusClient({
  network: 'testnet',
  suiClient,
  storageNodeClientOptions: {
    timeout: 120_000, // Increased timeout
    retries: 3, // Add retry attempts
  },
})

export interface WalrusUploadResult {
  blobId: string
  url: string
}

export interface WalrusUploadOptions {
  epochs?: number
}

export class WalrusService {
  private client: WalrusClient

  constructor() {
    this.client = walrusClient
  }

  /**
   * Upload a file to Walrus storage
   * @param file The file to upload
   * @param options Upload options
   * @returns Promise with upload result
   */
  async uploadFile(
    file: File,
    options: WalrusUploadOptions = {}
  ): Promise<WalrusUploadResult> {
    try {
      const { epochs = 5 } = options
      
      // Convert file to blob
      const blob = new Blob([file], { type: file.type })
      
      // Upload to Walrus
      const result = await this.client.store(blob, epochs)
      
      if (!result.blobId) {
        throw new Error('Failed to get blob ID from upload result')
      }

      return {
        blobId: result.blobId,
        url: this.getBlobUrl(result.blobId)
      }
    } catch (error) {
      console.error('Error uploading file to Walrus:', error)
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get the URL for a blob stored in Walrus
   * @param blobId The blob ID
   * @returns The URL to access the blob
   */
  getBlobUrl(blobId: string): string {
    return `https://walrus-testnet-publisher.nodes.guru/v1/${blobId}`
  }

  /**
   * Check if a blob exists in Walrus storage
   * @param blobId The blob ID to check
   * @returns Promise<boolean> indicating if the blob exists
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      const response = await fetch(this.getBlobUrl(blobId), {
        method: 'HEAD'
      })
      return response.ok
    } catch (error) {
      console.error('Error checking blob existence:', error)
      return false
    }
  }

  /**
   * Download a blob from Walrus storage
   * @param blobId The blob ID to download
   * @returns Promise<Blob> with the blob data
   */
  async downloadBlob(blobId: string): Promise<Blob> {
    try {
      const response = await fetch(this.getBlobUrl(blobId))
      
      if (!response.ok) {
        throw new Error(`Failed to download blob: ${response.statusText}`)
      }
      
      return await response.blob()
    } catch (error) {
      console.error('Error downloading blob from Walrus:', error)
      throw new Error(
        `Failed to download blob: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

// Export singleton instance
export const walrusService = new WalrusService()
export default walrusService