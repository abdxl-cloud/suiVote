/**
 * Enhanced Token Service for Sui Blockchain using BlockVision v2 API
 * 
 * This service provides comprehensive token information using:
 * - BlockVision v2 API for enhanced coin details with real-time market data
 * - BlockVision RPC API for on-chain metadata fallback
 * - Comprehensive token validation and caching
 */

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { SUI_CONFIG } from "@/config/sui-config"

export interface TokenInfo {
  id: string
  name: string
  symbol: string
  decimals: number
  iconUrl?: string
  verified: boolean
  price?: number
  priceChange24h?: number
  marketCap?: number
  description?: string
  holders?: number
  totalSupply?: string
  volume24H?: number
  website?: string
  createdTime?: number
}

interface BlockVisionApiResponse {
  code: number
  message: string
  result: BlockVisionCoinDetail
}

interface BlockVisionCoinDetail {
  name: string
  symbol: string
  decimals: number
  logo: string
  price: string
  priceChangePercentage24H: string
  totalSupply: string
  holders: number
  marketCap: string
  packageID: string
  coinType: string
  objectType: string
  website: string
  creator: string
  volume24H: string
  createdTime: number
  verified: boolean
  circulating: string
  scamFlag: number
  birdeyeLink: string
}

interface SuiCoinMetadata {
  decimals: number
  name: string
  symbol: string
  description?: string
  iconUrl?: string | null
  id?: string
}

export class TokenService {
  private client: SuiClient
  private isInitialized = false
  private tokenCache = new Map<string, TokenInfo>()
  private blockVisionRpcUrl: string
  private blockVisionApiKey: string

  // Only SUI as the common token
  private readonly COMMON_TOKENS: Record<string, Partial<TokenInfo>> = {
    "0x2::sui::SUI": {
      id: "0x2::sui::SUI",
      name: "Sui",
      symbol: "SUI",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg",
      verified: true,
    }
  }

  constructor(
    rpcUrl = process.env.NEXT_PUBLIC_BLOCKVISION_RPC_URL || "https://sui-testnet.blockvision.org/v1/2xo63eBBrjZ4n1FKbON8dht4ovo",
    apiKey = process.env.NEXT_PUBLIC_BLOCKVISION_API_KEY || "2xo63eBBrjZ4n1FKbON8dht4ovo"
  ) {
    try {
      this.blockVisionRpcUrl = rpcUrl
      this.blockVisionApiKey = apiKey

      // Initialize standard Sui client for fallback
      this.client = new SuiClient({ url: this.blockVisionRpcUrl })
      this.isInitialized = true
      
      console.log(`✅ BlockVision TokenService initialized`)
      console.log(`📡 RPC URL: ${this.blockVisionRpcUrl}`)
      console.log(`🔑 API Key: ${this.blockVisionApiKey.substring(0, 8)}...`)

      // Pre-populate cache with SUI token
      const suiToken = this.COMMON_TOKENS["0x2::sui::SUI"]
      if (suiToken.name && suiToken.symbol && suiToken.decimals !== undefined) {
        this.tokenCache.set("0x2::sui::SUI", {
          id: "0x2::sui::SUI",
          name: suiToken.name,
          symbol: suiToken.symbol,
          decimals: suiToken.decimals,
          iconUrl: suiToken.iconUrl,
          verified: suiToken.verified || false,
        })
      }

    } catch (error) {
      console.error(`❌ Failed to initialize BlockVision TokenService:`, error)
      throw new Error(`TokenService initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private checkInitialization() {
    if (!this.isInitialized) {
      throw new Error("TokenService is not properly initialized")
    }
  }

  /**
   * Get enhanced coin details from BlockVision v2 API
   */
  private async getCoinDetailFromBlockVision(coinType: string): Promise<BlockVisionCoinDetail | null> {
    try {
      const encodedCoinType = encodeURIComponent(coinType)
      const url = `https://api.blockvision.org/v2/sui/coin/detail?coinType=${encodedCoinType}`
      
      console.log(`🔍 Fetching coin detail from BlockVision v2: ${url}`)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': this.blockVisionApiKey,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`⚠️ Coin not found in BlockVision API: ${coinType}`)
          return null
        }
        throw new Error(`BlockVision API error: ${response.status} ${response.statusText}`)
      }

      const data: BlockVisionApiResponse = await response.json()
      
      if (!data || data.code !== 200) {
        console.warn(`⚠️ BlockVision API returned error for ${coinType}:`, data.message)
        return null
      }

      if (!data.result) {
        console.warn(`⚠️ No result in BlockVision response for ${coinType}`)
        return null
      }

      console.log(`✅ Got coin detail from BlockVision v2 for ${coinType}:`, data.result)
      return data.result

    } catch (error) {
      console.error(`❌ BlockVision v2 API failed for ${coinType}:`, error)
      return null
    }
  }

  /**
   * Get coin metadata using BlockVision RPC (standard Sui RPC)
   */
  private async getCoinMetadataFromBlockVisionRpc(coinType: string): Promise<SuiCoinMetadata | null> {
    try {
      const response = await fetch(this.blockVisionRpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getCoinMetadata',
          params: [coinType],
        }),
      })

      if (!response.ok) {
        throw new Error(`BlockVision RPC failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        console.warn(`BlockVision RPC error for ${coinType}:`, data.error.message)
        return null
      }

      if (!data.result) {
        console.warn(`No metadata found in BlockVision RPC for ${coinType}`)
        return null
      }

      console.log(`✅ Got metadata from BlockVision RPC for ${coinType}`)
      return data.result as SuiCoinMetadata

    } catch (error) {
      console.error(`❌ BlockVision RPC getCoinMetadata failed for ${coinType}:`, error)
      return null
    }
  }

  /**
   * Enhanced coin type validation
   */
  private validateCoinType(coinType: string): boolean {
    if (!coinType || typeof coinType !== 'string') return false
    
    // Standard Sui coin type format: 0xPACKAGE::MODULE::STRUCT
    const standardFormat = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/
    
    // 64-character object ID format
    const objectIdFormat = /^0x[a-fA-F0-9]{64}$/
    
    // Shorter package addresses (common in Sui)
    const shortFormat = /^0x[a-fA-F0-9]{1,40}::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/
    
    return standardFormat.test(coinType) || objectIdFormat.test(coinType) || shortFormat.test(coinType)
  }

  /**
   * Get comprehensive token information using BlockVision APIs
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      this.checkInitialization()

      // Check cache first
      if (this.tokenCache.has(tokenAddress)) {
        console.log(`📋 Retrieved from cache: ${tokenAddress}`)
        return this.tokenCache.get(tokenAddress)!
      }

      // Check predefined tokens
      if (this.COMMON_TOKENS[tokenAddress]) {
        const commonToken = this.COMMON_TOKENS[tokenAddress]
        if (commonToken.name && commonToken.symbol && commonToken.decimals !== undefined) {
          const tokenInfo: TokenInfo = {
            id: tokenAddress,
            name: commonToken.name,
            symbol: commonToken.symbol,
            decimals: commonToken.decimals,
            iconUrl: commonToken.iconUrl,
            verified: commonToken.verified || false,
          }
          this.tokenCache.set(tokenAddress, tokenInfo)
          return tokenInfo
        }
      }

      // Handle object IDs (try to extract coin type)
      if (tokenAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
        try {
          const object = await this.client.getObject({
            id: tokenAddress,
            options: { showType: true, showContent: true },
          })

          if (object.data?.type?.includes('::coin::Coin<')) {
            const match = object.data.type.match(/::coin::Coin<(.+)>/)
            if (match?.[1]) {
              const coinType = match[1]
              console.log(`🔍 Extracted coin type ${coinType} from object ${tokenAddress}`)
              
              const coinTokenInfo = await this.getTokenInfo(coinType)
              if (coinTokenInfo) {
                const modifiedTokenInfo = { ...coinTokenInfo, id: tokenAddress }
                this.tokenCache.set(tokenAddress, modifiedTokenInfo)
                return modifiedTokenInfo
              }
            }
          }
        } catch (objectError) {
          console.warn(`⚠️ Failed to get object info for ${tokenAddress}:`, objectError)
        }
      }

      // Try BlockVision v2 API first (provides enhanced data)
      const blockVisionDetail = await this.getCoinDetailFromBlockVision(tokenAddress)
      if (blockVisionDetail) {
        const tokenInfo: TokenInfo = {
          id: tokenAddress,
          name: blockVisionDetail.name,
          symbol: blockVisionDetail.symbol,
          decimals: blockVisionDetail.decimals,
          iconUrl: blockVisionDetail.logo,
          verified: blockVisionDetail.verified,
          description: `Website: ${blockVisionDetail.website}`,
          price: parseFloat(blockVisionDetail.price),
          priceChange24h: parseFloat(blockVisionDetail.priceChangePercentage24H),
          holders: blockVisionDetail.holders,
          totalSupply: blockVisionDetail.totalSupply,
          marketCap: parseFloat(blockVisionDetail.marketCap),
          volume24H: parseFloat(blockVisionDetail.volume24H),
          website: blockVisionDetail.website,
          createdTime: blockVisionDetail.createdTime,
        }
        
        this.tokenCache.set(tokenAddress, tokenInfo)
        console.log(`✅ Created token info from BlockVision v2 API for ${tokenAddress}`)
        return tokenInfo
      }

      // Fallback to BlockVision RPC (standard Sui RPC)
      const metadata = await this.getCoinMetadataFromBlockVisionRpc(tokenAddress)
      if (metadata) {
        const tokenInfo: TokenInfo = {
          id: tokenAddress,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          iconUrl: metadata.iconUrl || undefined,
          verified: false,
          description: metadata.description,
        }
        
        this.tokenCache.set(tokenAddress, tokenInfo)
        console.log(`✅ Created token info from BlockVision RPC for ${tokenAddress}`)
        return tokenInfo
      }

      // Create fallback token info for valid-looking addresses
      if (this.validateCoinType(tokenAddress)) {
        let symbol = "UNKNOWN"
        let name = "Unknown Token"
        
        if (tokenAddress.includes("::")) {
          const parts = tokenAddress.split("::")
          symbol = parts[parts.length - 1]?.toUpperCase() || "UNKNOWN"
          name = `Token (${symbol})`
        } else if (tokenAddress.startsWith("0x")) {
          const shortAddr = tokenAddress.length > 10 ? 
            `${tokenAddress.substring(0, 6)}...${tokenAddress.substring(tokenAddress.length - 4)}` : 
            tokenAddress
          symbol = shortAddr
          name = `Token ${shortAddr}`
        }

        const fallbackTokenInfo: TokenInfo = {
          id: tokenAddress,
          name,
          symbol,
          decimals: 9, // Default for Sui
          verified: false,
        }

        this.tokenCache.set(tokenAddress, fallbackTokenInfo)
        console.log(`⚠️ Created fallback token info for ${tokenAddress}`)
        return fallbackTokenInfo
      }

      return null

    } catch (error) {
      console.error(`❌ Failed to get token info for ${tokenAddress}:`, error)
      return null
    }
  }

  /**
   * Get popular tokens - SUI only per user request
   */
  async getPopularTokens(limit = 10): Promise<TokenInfo[]> {
    try {
      this.checkInitialization()

      // Return only SUI token as requested by user
      const suiTokenInfo = await this.getTokenInfo("0x2::sui::SUI")
      if (suiTokenInfo) {
        console.log('✅ Returning SUI token only')
        return [suiTokenInfo]
      }

      return []

    } catch (error) {
      console.error('❌ Failed to get popular tokens:', error)
      return []
    }
  }

  /**
   * Enhanced token search using BlockVision v2 API
   */
  async searchTokens(query: string, limit = 10): Promise<TokenInfo[]> {
    try {
      this.checkInitialization()

      if (!query.trim()) {
        return this.getPopularTokens(limit)
      }

      // If query looks like a token address, try to get that specific token
      if (this.validateCoinType(query.trim())) {
        const token = await this.getTokenInfo(query.trim())
        return token ? [token] : []
      }

      // Search in cache
      const lowerQuery = query.toLowerCase()
      const allCachedTokens = Array.from(this.tokenCache.values())
      
      const results = allCachedTokens
        .filter(token =>
          token.name.toLowerCase().includes(lowerQuery) ||
          token.symbol.toLowerCase().includes(lowerQuery) ||
          token.id.toLowerCase().includes(lowerQuery)
        )
        .slice(0, limit)

      console.log(`🔍 Search for "${query}" returned ${results.length} results`)
      return results

    } catch (error) {
      console.error('❌ Token search failed:', error)
      return []
    }
  }

  /**
   * Enhanced token address validation using BlockVision v2 API
   */
  async validateTokenAddress(tokenAddress: string): Promise<{
    isValid: boolean
    tokenInfo?: TokenInfo
    error?: string
  }> {
    try {
      this.checkInitialization()

      if (!tokenAddress?.trim()) {
        return {
          isValid: false,
          error: 'Token address is required'
        }
      }

      const trimmedAddress = tokenAddress.trim()

      // Basic format validation
      if (!this.validateCoinType(trimmedAddress)) {
        return {
          isValid: false,
          error: 'Invalid token format. Expected "0xPACKAGE::MODULE::STRUCT" or "0x..." format'
        }
      }

      // Try to get token info using BlockVision v2 API
      const tokenInfo = await this.getTokenInfo(trimmedAddress)

      if (!tokenInfo) {
        return {
          isValid: false,
          error: 'Token not found or metadata unavailable'
        }
      }

      return {
        isValid: true,
        tokenInfo,
      }

    } catch (error) {
      console.error(`❌ Token validation failed for ${tokenAddress}:`, error)
      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    const commonTokensOnly = new Map<string, TokenInfo>()
    const suiToken = this.COMMON_TOKENS["0x2::sui::SUI"]
    if (suiToken.name && suiToken.symbol && suiToken.decimals !== undefined) {
      commonTokensOnly.set("0x2::sui::SUI", {
        id: "0x2::sui::SUI",
        name: suiToken.name,
        symbol: suiToken.symbol,
        decimals: suiToken.decimals,
        iconUrl: suiToken.iconUrl,
        verified: suiToken.verified || false,
      })
    }
    this.tokenCache = commonTokensOnly
    console.log('🧹 Token cache cleared, kept SUI token')
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean
    rpcUrl: string
    apiKey: string
    cacheSize: number
  } {
    return {
      initialized: this.isInitialized,
      rpcUrl: this.blockVisionRpcUrl,
      apiKey: this.blockVisionApiKey.substring(0, 8) + '...',
      cacheSize: this.tokenCache.size,
    }
  }
}

// Export singleton instance using environment variables
export const tokenService = new TokenService()