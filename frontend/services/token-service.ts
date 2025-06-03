/**
 * Enhanced Token Service for Sui Blockchain
 * 
 * This service provides comprehensive token information using:
 * - Sui SDK for on-chain metadata
 * - CoinGecko API for market data and verification
 * - SuiVision API for holder count
 * - Comprehensive token validation and caching
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'
import { SUI_CONFIG } from '@/config/sui-config'

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

export class TokenService {
  private client: SuiClient
  private isInitialized = false
  private tokenCache = new Map<string, TokenInfo>()

  // Common tokens with their CoinGecko IDs
  private readonly COMMON_TOKENS: Record<string, { coingeckoId: string; info: Partial<TokenInfo> }> = {
    "0x2::sui::SUI": {
      coingeckoId: "sui",
      info: {
        id: "0x2::sui::SUI",
        name: "Sui",
        symbol: "SUI",
        decimals: 9,
        iconUrl: "https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg",
        verified: true,
      }
    }
  }

  constructor(network: 'mainnet' | 'testnet' | 'devnet' = 'mainnet') {
    try {
      this.client = new SuiClient({ url: getFullnodeUrl(network) })
      this.isInitialized = true
      
      console.log(`✅ TokenService initialized for ${network}`)

      // Pre-populate cache with common tokens
      Object.entries(this.COMMON_TOKENS).forEach(([coinType, { info }]) => {
        if (info.name && info.symbol && info.decimals !== undefined) {
          this.tokenCache.set(coinType, {
            id: coinType,
            name: info.name,
            symbol: info.symbol,
            decimals: info.decimals,
            iconUrl: info.iconUrl,
            verified: info.verified || false,
          })
        }
      })

    } catch (error) {
      console.error(`❌ Failed to initialize TokenService:`, error)
      throw new Error(`TokenService initialization failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private checkInitialization() {
    if (!this.isInitialized) {
      throw new Error("TokenService is not properly initialized")
    }
  }

  /**
   * Heuristic to determine if CoinGecko token is verified
   */
  private isCoinGeckoVerified(cg: any): boolean {
    return !!cg?.market_cap_rank
  }

  /**
   * Verify token exists on SUI blockchain
   */
  private async isValidSuiToken(coinType: string): Promise<boolean> {
    try {
      const metadata = await this.client.getCoinMetadata({ coinType })
      return metadata !== null
    } catch (err) {
      console.warn(`Token validation failed for ${coinType}:`, err instanceof Error ? err.message : String(err))
      return false
    }
  }

  /**
   * Get holder count from SuiVision
   */
  private async getHoldersFromSuiVision(coinType: string): Promise<number | null> {
    try {
      const res = await fetch(`https://api.suivision.xyz/token/${coinType}`)
      const data = await res.json()
      return data?.holders ?? null
    } catch (err) {
      console.warn(`SuiVision holders fetch failed for ${coinType}:`, err instanceof Error ? err.message : String(err))
      return null
    }
  }

  /**
   * Get extended coin metadata from multiple sources
   */
  private async getExtendedCoinMetadata(coinType: string, coingeckoId?: string): Promise<TokenInfo | null> {
    try {
      // 1. First validate that the token exists on SUI blockchain
      const isValidToken = await this.isValidSuiToken(coinType)
      if (!isValidToken) {
        console.error(`Token ${coinType} not found on SUI blockchain`)
        return null
      }

      // 2. Fetch from Sui SDK (we know this will work since validation passed)
      const metadata = await this.client.getCoinMetadata({ coinType })
      const supplyData = await this.client.getTotalSupply({ coinType })

      let cg: any = null
      let holders: number | null = null

      // 3. Fetch from CoinGecko if ID is provided
      if (coingeckoId) {
        try {
          const cgRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coingeckoId}`)
          if (cgRes.ok) {
            cg = await cgRes.json()
          }
        } catch (err) {
          console.warn(`CoinGecko fetch failed for ${coingeckoId}:`, err instanceof Error ? err.message : String(err))
        }
      }

      // 4. Fetch holders from SuiVision
      holders = await this.getHoldersFromSuiVision(coinType)

      // 5. Construct response
      return {
        id: coinType,
        name: metadata?.name ?? cg?.name ?? null,
        symbol: metadata?.symbol ?? cg?.symbol?.toUpperCase() ?? null,
        decimals: metadata?.decimals ?? null,
        iconUrl: metadata?.iconUrl ?? cg?.image?.large ?? null,
        verified: cg ? this.isCoinGeckoVerified(cg) : false,
        price: cg?.market_data?.current_price?.usd ?? null,
        priceChange24h: cg?.market_data?.price_change_percentage_24h ?? null,
        marketCap: cg?.market_data?.market_cap?.usd ?? null,
        description: metadata?.description ?? cg?.description?.en ?? null,
        holders,
        totalSupply: supplyData?.totalSupply ?? null,
        volume24H: cg?.market_data?.total_volume?.usd ?? null,
        website: cg?.links?.homepage?.[0] ?? null,
        createdTime: cg?.genesis_date ? new Date(cg.genesis_date).getTime() : null,
      }
    } catch (err) {
      console.error('Error fetching extended metadata:', err)
      return null
    }
  }

  /**
   * Get basic token metadata from Sui SDK only
   */
  private async getBasicTokenMetadata(coinType: string): Promise<TokenInfo | null> {
    try {
      const metadata = await this.client.getCoinMetadata({ coinType })
      if (!metadata) {
        return null
      }

      return {
        id: coinType,
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || 'UNKNOWN',
        decimals: metadata.decimals || 9,
        iconUrl: metadata.iconUrl || undefined,
        verified: false,
        description: metadata.description || undefined,
      }
    } catch (error) {
      console.error(`Failed to fetch basic metadata for ${coinType}:`, error)
      return null
    }
  }

  /**
   * Get token information with caching
   */
  async getTokenInfo(coinType: string): Promise<TokenInfo | null> {
    this.checkInitialization()

    // Check cache first
    if (this.tokenCache.has(coinType)) {
      return this.tokenCache.get(coinType)!
    }

    try {
      let tokenInfo: TokenInfo | null = null

      // Check if it's a common token with CoinGecko ID
      const commonToken = this.COMMON_TOKENS[coinType]
      if (commonToken) {
        tokenInfo = await this.getExtendedCoinMetadata(coinType, commonToken.coingeckoId)
      } else {
        // For unknown tokens, try basic metadata first
        tokenInfo = await this.getBasicTokenMetadata(coinType)
      }

      if (tokenInfo) {
        // Cache the result
        this.tokenCache.set(coinType, tokenInfo)
        console.log(`✅ Token info cached for ${coinType}: ${tokenInfo.name} (${tokenInfo.symbol})`)
      } else {
        console.warn(`⚠️ No token info found for ${coinType}`)
      }

      return tokenInfo
    } catch (error) {
      console.error(`❌ Error fetching token info for ${coinType}:`, error)
      return null
    }
  }

  /**
   * Get multiple token information
   */
  async getMultipleTokenInfo(coinTypes: string[]): Promise<Record<string, TokenInfo | null>> {
    this.checkInitialization()

    const results: Record<string, TokenInfo | null> = {}
    
    // Process tokens in parallel
    const promises = coinTypes.map(async (coinType) => {
      const info = await this.getTokenInfo(coinType)
      return { coinType, info }
    })

    const resolvedPromises = await Promise.allSettled(promises)
    
    resolvedPromises.forEach((result, index) => {
      const coinType = coinTypes[index]
      if (result.status === 'fulfilled') {
        results[coinType] = result.value.info
      } else {
        console.error(`Failed to fetch info for ${coinType}:`, result.reason)
        results[coinType] = null
      }
    })

    return results
  }

  /**
   * Search for tokens by symbol or name
   */
  async searchTokens(query: string, limit: number = 10): Promise<TokenInfo[]> {
    this.checkInitialization()

    const results: TokenInfo[] = []
    const lowerQuery = query.toLowerCase()

    // Search in cache first
    for (const [coinType, tokenInfo] of this.tokenCache.entries()) {
      if (
        tokenInfo.symbol.toLowerCase().includes(lowerQuery) ||
        tokenInfo.name.toLowerCase().includes(lowerQuery)
      ) {
        results.push(tokenInfo)
        if (results.length >= limit) break
      }
    }

    return results
  }

  /**
   * Get popular tokens (commonly used tokens)
   */
  async getPopularTokens(limit: number = 5): Promise<TokenInfo[]> {
    this.checkInitialization()

    const popularCoinTypes = Object.keys(this.COMMON_TOKENS).slice(0, limit)
    const results: TokenInfo[] = []

    for (const coinType of popularCoinTypes) {
      const tokenInfo = await this.getTokenInfo(coinType)
      if (tokenInfo) {
        results.push(tokenInfo)
      }
    }

    return results
  }

  /**
   * Validate token address and return validation result
   */
  async validateTokenAddress(coinType: string): Promise<{
    isValid: boolean
    error?: string
    tokenInfo?: TokenInfo
  }> {
    this.checkInitialization()

    try {
      // Basic format validation
      if (!TokenService.isValidCoinType(coinType)) {
        return {
          isValid: false,
          error: "Invalid coin type format. Expected format: 0x...::module::struct"
        }
      }

      // Check if token exists on blockchain
      const isValid = await this.isValidSuiToken(coinType)
      if (!isValid) {
        return {
          isValid: false,
          error: "Token not found on Sui blockchain"
        }
      }

      // Get token info
      const tokenInfo = await this.getTokenInfo(coinType)
      if (!tokenInfo) {
        return {
          isValid: false,
          error: "Unable to fetch token metadata"
        }
      }

      return {
        isValid: true,
        tokenInfo
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : "Validation failed"
      }
    }
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.tokenCache.clear()
    console.log('🧹 Token cache cleared')
    
    // Re-populate with common tokens
    Object.entries(this.COMMON_TOKENS).forEach(([coinType, { info }]) => {
      if (info.name && info.symbol && info.decimals !== undefined) {
        this.tokenCache.set(coinType, {
          id: coinType,
          name: info.name,
          symbol: info.symbol,
          decimals: info.decimals,
          iconUrl: info.iconUrl,
          verified: info.verified || false,
        })
      }
    })
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; tokens: string[] } {
    return {
      size: this.tokenCache.size,
      tokens: Array.from(this.tokenCache.keys())
    }
  }

  /**
   * Add a custom token with CoinGecko ID for enhanced data
   */
  addCustomToken(coinType: string, coingeckoId: string, basicInfo?: Partial<TokenInfo>): void {
    this.COMMON_TOKENS[coinType] = {
      coingeckoId,
      info: basicInfo || {}
    }
    
    // Remove from cache to force refresh
    this.tokenCache.delete(coinType)
    console.log(`📝 Custom token added: ${coinType} -> ${coingeckoId}`)
  }

  /**
   * Validate if a coin type string is properly formatted
   */
  static isValidCoinType(coinType: string): boolean {
    // Basic validation for Sui coin type format
    const coinTypeRegex = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/
    return coinTypeRegex.test(coinType)
  }

  /**
   * Get the native SUI token info
   */
  getSuiTokenInfo(): TokenInfo {
    return this.tokenCache.get("0x2::sui::SUI")!
  }
}

// Export a default instance
export const tokenService = new TokenService(SUI_CONFIG.NETWORK as 'mainnet' | 'testnet' | 'devnet')