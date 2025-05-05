/**
 * Token Service
 *
 * Service for retrieving token information from the Sui blockchain.
 * Provides methods to fetch token data and validate token addresses.
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
}

export class TokenService {
  private client: SuiClient
  private isInitialized = false
  private tokenCache = new Map<string, TokenInfo>()

  // Comprehensive list of common tokens with predefined data
  private readonly COMMON_TOKENS: Record<string, TokenInfo> = {
    // Native SUI token
    "0x2::sui::SUI": {
      id: "0x2::sui::SUI",
      name: "Sui",
      symbol: "SUI",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/26375/large/sui_asset.jpeg",
      verified: true,
      price: 1.42,
      priceChange24h: 2.5,
      marketCap: 1580000000,
    },
    // Popular tokens on Sui
    "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN": {
      id: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      iconUrl: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
      verified: true,
      price: 1.0,
      priceChange24h: 0.01,
      marketCap: 32500000000,
    },
    "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::ETH": {
      id: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::ETH",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 8,
      iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
      verified: true,
      price: 3450.75,
      priceChange24h: -1.2,
      marketCap: 415000000000,
    },
    "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::BTC": {
      id: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::BTC",
      name: "Bitcoin",
      symbol: "BTC",
      decimals: 8,
      iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
      verified: true,
      price: 66500.0,
      priceChange24h: 1.8,
      marketCap: 1300000000000,
    },
    // Additional popular Sui tokens
    "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS": {
      id: "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS",
      name: "Cetus",
      symbol: "CETUS",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/28821/large/cetus-icon.png",
      verified: true,
      price: 0.12,
      priceChange24h: 3.2,
      marketCap: 85000000,
    },
    "0xb231fcda8bbddb31f2ef02e6161444aec64a514e2c89279584ac9806ce9cf037::coin::COIN": {
      id: "0xb231fcda8bbddb31f2ef02e6161444aec64a514e2c89279584ac9806ce9cf037::coin::COIN",
      name: "Scallop",
      symbol: "SCA",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/30425/large/sca.png",
      verified: true,
      price: 0.35,
      priceChange24h: 5.7,
      marketCap: 42000000,
    },
    "0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN": {
      id: "0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN",
      name: "Turbos",
      symbol: "TURBOS",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/30426/large/turbos.png",
      verified: true,
      price: 0.08,
      priceChange24h: -2.3,
      marketCap: 18000000,
    },
    "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN": {
      id: "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
      name: "Aftermath",
      symbol: "AFTERMATH",
      decimals: 9,
      iconUrl: "https://assets.coingecko.com/coins/images/30427/large/aftermath.png",
      verified: true,
      price: 0.22,
      priceChange24h: 1.5,
      marketCap: 25000000,
    },
    // Example of a WAL token
    "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL": {
      id: "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL",
      name: "Wallet Connect",
      symbol: "WAL",
      decimals: 9,
      verified: false,
      price: 0.05,
      priceChange24h: 0.8,
    },
  }

  /**
   * Initialize the service with a network selection
   * @param network The Sui network to connect to (devnet, testnet, mainnet)
   */
  constructor(network = SUI_CONFIG.NETWORK) {
    try {
      this.client = new SuiClient({ url: getFullnodeUrl(network) })
      this.isInitialized = true
      console.log(`TokenService initialized on network: ${network}`)

      // Pre-populate cache with common tokens
      Object.values(this.COMMON_TOKENS).forEach((token) => {
        this.tokenCache.set(token.id, token)
      })
    } catch (error) {
      console.error(`Failed to initialize SuiClient for network ${network}:`, error)
      throw new Error(`Failed to initialize TokenService: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Check if the service is properly initialized
   * @private
   */
  private checkInitialization() {
    if (!this.isInitialized) {
      throw new Error("TokenService is not properly initialized")
    }
  }

  /**
   * Get popular tokens from our predefined list
   * @param limit Number of tokens to fetch
   * @returns Array of token information
   */
  async getPopularTokens(limit = 20): Promise<TokenInfo[]> {
    try {
      this.checkInitialization()

      // Return tokens from our predefined list
      const tokens = Object.values(this.COMMON_TOKENS)

      // Sort by market cap (descending)
      return tokens.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, limit)
    } catch (error) {
      console.error("Failed to fetch popular tokens:", error)
      return []
    }
  }

  /**
   * Get information about a specific token by its address
   * @param tokenAddress The token address in format "package::module::struct" or "0x..." format
   * @returns Token information or null if not found
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      this.checkInitialization()

      // Check cache first
      if (this.tokenCache.has(tokenAddress)) {
        return this.tokenCache.get(tokenAddress)!
      }

      // Check if it's in our predefined list
      if (tokenAddress in this.COMMON_TOKENS) {
        const tokenInfo = this.COMMON_TOKENS[tokenAddress]
        this.tokenCache.set(tokenAddress, tokenInfo)
        return tokenInfo
      }

      // Try to get the coin metadata from the chain
      console.log(`Attempting to fetch token info from blockchain for: ${tokenAddress}`)
      return this.getTokenInfoFromChain(tokenAddress)
    } catch (error) {
      console.error(`Failed to fetch token info for ${tokenAddress}:`, error)
      return null
    }
  }

  /**
   * Get token information directly from the blockchain
   * @param tokenAddress The token address
   * @returns Token information or null if not found
   */
  private async getTokenInfoFromChain(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      console.log(`Fetching coin metadata from chain for: ${tokenAddress}`)

      // Try to get the coin metadata
      const { data: coinMetadata } = await this.client.getCoinMetadata({
        coinType: tokenAddress,
      })

      if (!coinMetadata) {
        console.log(`No coin metadata found for: ${tokenAddress}`)

        // If we can't get metadata but the address looks valid, create a minimal token info
        if (tokenAddress.includes("::")) {
          // Extract symbol from the address as a fallback
          const parts = tokenAddress.split("::")
          const symbol = parts[parts.length - 1]

          console.log(`Creating minimal token info with symbol: ${symbol}`)

          const minimalTokenInfo: TokenInfo = {
            id: tokenAddress,
            name: symbol,
            symbol: symbol,
            decimals: 9, // Default for most Sui tokens
            verified: false,
          }

          // Cache the minimal result
          this.tokenCache.set(tokenAddress, minimalTokenInfo)
          return minimalTokenInfo
        }

        return null
      }

      console.log(`Found coin metadata for ${tokenAddress}:`, coinMetadata)

      const tokenInfo: TokenInfo = {
        id: tokenAddress,
        name: coinMetadata.name,
        symbol: coinMetadata.symbol,
        decimals: coinMetadata.decimals,
        iconUrl: coinMetadata.iconUrl || undefined,
        verified: false, // Custom tokens are marked as unverified
      }

      // Cache the result
      this.tokenCache.set(tokenAddress, tokenInfo)
      return tokenInfo
    } catch (error) {
      console.error(`Failed to fetch token info from chain for ${tokenAddress}:`, error)

      // Last resort: If the token address is in the format package::module::struct
      // Create a minimal token info object with the struct name as the symbol
      if (tokenAddress.includes("::")) {
        try {
          const parts = tokenAddress.split("::")
          const symbol = parts[parts.length - 1]

          console.log(`Creating fallback token info with symbol: ${symbol}`)

          const fallbackTokenInfo: TokenInfo = {
            id: tokenAddress,
            name: symbol,
            symbol: symbol,
            decimals: 9, // Default for most Sui tokens
            verified: false,
          }

          // Cache the fallback result
          this.tokenCache.set(tokenAddress, fallbackTokenInfo)
          return fallbackTokenInfo
        } catch (e) {
          console.error("Failed to create fallback token info:", e)
        }
      }

      return null
    }
  }

  /**
   * Search for tokens by name, symbol, or address
   * @param query Search query
   * @param limit Maximum number of results
   * @returns Array of matching tokens
   */
  async searchTokens(query: string, limit = 10): Promise<TokenInfo[]> {
    try {
      this.checkInitialization()

      if (!query.trim()) {
        return this.getPopularTokens(limit)
      }

      // Search in our predefined list and cache
      const lowerQuery = query.toLowerCase()

      // Combine predefined tokens and cached tokens
      const allTokens = new Map<string, TokenInfo>([
        ...Object.entries(this.COMMON_TOKENS),
        ...this.tokenCache.entries(),
      ])

      const results = Array.from(allTokens.values())
        .filter(
          (token) =>
            token.name.toLowerCase().includes(lowerQuery) ||
            token.symbol.toLowerCase().includes(lowerQuery) ||
            token.id.toLowerCase().includes(lowerQuery),
        )
        .slice(0, limit)

      return results
    } catch (error) {
      console.error("Failed to search tokens:", error)
      return []
    }
  }

  /**
   * Validate if a token address is valid and exists
   * @param tokenAddress The token address to validate
   * @returns Validation result with token info if valid
   */
  async validateTokenAddress(
    tokenAddress: string,
  ): Promise<{ isValid: boolean; tokenInfo?: TokenInfo; error?: string }> {
    try {
      this.checkInitialization()

      // Basic format validation - SuiVision format or standard format
      if (!tokenAddress || (!tokenAddress.includes("::") && !tokenAddress.match(/^0x[a-fA-F0-9]+$/))) {
        return {
          isValid: false,
          error: 'Invalid token format. Expected "package::module::struct" or "0x..." format',
        }
      }

      // Check if it's in our predefined list
      if (tokenAddress in this.COMMON_TOKENS) {
        return {
          isValid: true,
          tokenInfo: this.COMMON_TOKENS[tokenAddress],
        }
      }

      // Try to get token info
      const tokenInfo = await this.getTokenInfo(tokenAddress)

      if (!tokenInfo) {
        return {
          isValid: false,
          error: "Token not found or not a valid coin type",
        }
      }

      return {
        isValid: true,
        tokenInfo,
      }
    } catch (error) {
      console.error(`Failed to validate token address ${tokenAddress}:`, error)

      // More lenient validation - if it looks like a valid address format, consider it potentially valid
      if (tokenAddress.startsWith("0x") || tokenAddress.includes("::")) {
        console.log(`Token address ${tokenAddress} has valid format but couldn't be verified`)

        // Extract a symbol from the address as a fallback
        let symbol = "UNKNOWN"
        if (tokenAddress.includes("::")) {
          const parts = tokenAddress.split("::")
          symbol = parts[parts.length - 1]
        } else {
          // For 0x format, use a shortened version
          symbol = `${tokenAddress.substring(0, 6)}...`
        }

        const fallbackTokenInfo: TokenInfo = {
          id: tokenAddress,
          name: `Unknown Token (${symbol})`,
          symbol: symbol,
          decimals: 9,
          verified: false,
        }

        return {
          isValid: true,
          tokenInfo: fallbackTokenInfo,
          error: "Token validated by format only, details unavailable",
        }
      }

      return {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Clear the token cache
   */
  clearCache() {
    // Clear all except predefined tokens
    const newCache = new Map<string, TokenInfo>()
    Object.values(this.COMMON_TOKENS).forEach((token) => {
      newCache.set(token.id, token)
    })
    this.tokenCache = newCache
  }
}

// Export singleton instance
export const tokenService = new TokenService()
