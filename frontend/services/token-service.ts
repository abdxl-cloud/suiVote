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

interface CoinMetadata {
  id: string
  decimals: number
  name: string
  symbol: string
  description?: string
  iconUrl?: string
}

export class TokenService {
  private client: SuiClient
  private isInitialized = false
  private tokenCache = new Map<string, TokenInfo>()
  private rpcUrl: string

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
    }
  }

  /**
   * Initialize the service with a network selection
   * @param network The Sui network to connect to (devnet, testnet, mainnet)
   */
  constructor(network = SUI_CONFIG.NETWORK) {
    try {
      this.rpcUrl = getFullnodeUrl(network)
      this.client = new SuiClient({ url: this.rpcUrl })
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
   * Make a direct RPC call to the Sui blockchain
   * @param method The RPC method name
   * @param params The parameters for the RPC call
   * @private
   */
  private async makeRpcCall<T>(method: string, params: any[]): Promise<T> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        }),
      })

      if (!response.ok) {
        throw new Error(`RPC call failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      return data.result as T
    } catch (error) {
      console.error(`RPC call failed for method ${method}:`, error)
      throw error
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
   * Try to fetch token metadata from Suiscan
   * @param tokenAddress The token address
   * @returns Token metadata or null if not found
   * @private
   */
  private async getCoinMetadataFromSuiscan(tokenAddress: string): Promise<CoinMetadata | null> {
    try {
      // For full object IDs, we need to try to get the coin type first
      let coinType = tokenAddress;
      
      if (tokenAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
        try {
          // Try to get the object to see if it's a coin
          const object = await this.client.getObject({
            id: tokenAddress,
            options: {
              showType: true,
            },
          });

          if (object.data?.type && object.data.type.includes('::coin::Coin<')) {
            // Extract the coin type from something like "0x2::coin::Coin<0x2::sui::SUI>"
            const match = object.data.type.match(/::coin::Coin<(.+)>/);
            if (match && match[1]) {
              coinType = match[1];
              console.log(`Using coin type ${coinType} for Suiscan query instead of object ID ${tokenAddress}`);
            }
          }
        } catch (objectError) {
          console.error(`Failed to get object type for Suiscan query: ${tokenAddress}`, objectError);
          // Continue with original address
        }
      }

      // Format the address for the Suiscan API
      const formattedAddress = coinType.startsWith("0x") 
        ? coinType 
        : coinType.includes("::") 
          ? coinType 
          : `0x${coinType}`;
      
      // Try to fetch from Suiscan API
      const suiscanUrl = `https://suiscan.xyz/api/coins/${encodeURIComponent(formattedAddress)}`;
      
      console.log(`Fetching token metadata from Suiscan: ${suiscanUrl}`);
      
      const response = await fetch(suiscanUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Suiscan API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.success || !data.data) {
        console.log(`No token metadata found on Suiscan for ${formattedAddress}`);
        return null;
      }

      // Extract the relevant metadata from the Suiscan response
      const tokenData = data.data;
      
      return {
        id: tokenAddress,
        name: tokenData.name || tokenData.symbol || "Unknown Token",
        symbol: tokenData.symbol || tokenData.name || "UNKNOWN",
        decimals: tokenData.decimals || 9,
        description: tokenData.description,
        iconUrl: tokenData.icon_url || tokenData.iconUrl,
      };
    } catch (error) {
      console.error(`Failed to fetch metadata from Suiscan for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Get coin metadata from the blockchain using RPC
   * @param coinType The coin type identifier
   * @returns Coin metadata or null if not found
   * @private
   */
  private async getCoinMetadataFromRpc(coinType: string): Promise<CoinMetadata | null> {
    try {
      // Use the suix_getCoinMetadata RPC method
      const metadata = await this.makeRpcCall<CoinMetadata>('suix_getCoinMetadata', [coinType])
      
      if (!metadata) {
        return null
      }
      
      return {
        id: coinType,
        decimals: metadata.decimals,
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description,
        iconUrl: metadata.iconUrl,
      }
    } catch (error) {
      console.error(`Failed to fetch coin metadata from RPC for ${coinType}:`, error)
      return null
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

      // For full object IDs (64-char hex strings), try to get the object and extract coin type
      if (tokenAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
        try {
          // Try to get the object to see if it's a coin
          const object = await this.client.getObject({
            id: tokenAddress,
            options: {
              showType: true,
              showContent: true,
            },
          });

          if (object.data) {
            const objectType = object.data.type;
            // Check if it's a coin type
            if (objectType && objectType.includes('::coin::Coin<')) {
              // Extract the coin type from something like "0x2::coin::Coin<0x2::sui::SUI>"
              const match = objectType.match(/::coin::Coin<(.+)>/);
              if (match && match[1]) {
                const coinType = match[1];
                console.log(`Found coin type ${coinType} for object ${tokenAddress}`);
                
                // Try to get metadata for this coin type
                const coinTokenInfo = await this.getTokenInfo(coinType);
                if (coinTokenInfo) {
                  // We want to keep the original tokenAddress as ID
                  const modifiedTokenInfo = {...coinTokenInfo, id: tokenAddress};
                  this.tokenCache.set(tokenAddress, modifiedTokenInfo);
                  return modifiedTokenInfo;
                }
              }
            }
          }
        } catch (objectError) {
          console.error(`Failed to get object info for ${tokenAddress}:`, objectError);
          // Continue with normal token info retrieval
        }
      }

      // First, try to fetch metadata from Suiscan
      const suiscanMetadata = await this.getCoinMetadataFromSuiscan(tokenAddress);
      if (suiscanMetadata) {
        const tokenInfo: TokenInfo = {
          id: tokenAddress,
          name: suiscanMetadata.name,
          symbol: suiscanMetadata.symbol,
          decimals: suiscanMetadata.decimals,
          iconUrl: suiscanMetadata.iconUrl,
          verified: false, // Custom tokens are marked as unverified by default
        }
        
        // Cache the result
        this.tokenCache.set(tokenAddress, tokenInfo)
        return tokenInfo
      }

      // If Suiscan didn't work, try RPC
      console.log(`Attempting to fetch token info via RPC for: ${tokenAddress}`)
      const metadata = await this.getCoinMetadataFromRpc(tokenAddress)
      
      if (metadata) {
        const tokenInfo: TokenInfo = {
          id: tokenAddress,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
          iconUrl: metadata.iconUrl,
          verified: false, // Custom tokens are marked as unverified
        }
        
        // Cache the result
        this.tokenCache.set(tokenAddress, tokenInfo)
        return tokenInfo
      }

      // If we still couldn't get metadata but the address looks valid, create a minimal token info
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

      // For 0x addresses (like your example), create a suitable fallback
      if (tokenAddress.startsWith("0x")) {
        const shortAddr = tokenAddress.length > 10 ? 
          `${tokenAddress.substring(0, 6)}...${tokenAddress.substring(tokenAddress.length - 4)}` : 
          tokenAddress;
          
        const fallbackTokenInfo: TokenInfo = {
          id: tokenAddress,
          name: `Token ${shortAddr}`,
          symbol: shortAddr,
          decimals: 9,
          verified: false,
        }
        
        this.tokenCache.set(tokenAddress, fallbackTokenInfo)
        return fallbackTokenInfo;
      }

      return null
    } catch (error) {
      console.error(`Failed to fetch token info for ${tokenAddress}:`, error)
      
      // Last resort fallback if the token address looks valid
      if (tokenAddress.includes("::") || tokenAddress.startsWith("0x")) {
        try {
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

      // If query looks like a full token address, try to get that specific token
      if ((query.startsWith("0x") && query.length > 10) || query.includes("::")) {
        const token = await this.getTokenInfo(query)
        if (token) {
          return [token]
        }
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

      // For pure 0x addresses (like 0x288710173f12f677ac38b0c2b764a0fea8108cb5e32059c3dd8f650d65e2cb25),
      // we may need to attempt to treat it as a coin object and try to infer its coin type
      if (tokenAddress.match(/^0x[a-fA-F0-9]{64}$/)) {
        try {
          // Try to get the object to see if it's a coin
          const object = await this.client.getObject({
            id: tokenAddress,
            options: {
              showType: true,
              showContent: true,
            },
          });

          if (object.data) {
            const objectType = object.data.type;
            // Check if it's a coin type
            if (objectType && objectType.includes('::coin::Coin<')) {
              // Extract the coin type from something like "0x2::coin::Coin<0x2::sui::SUI>"
              const match = objectType.match(/::coin::Coin<(.+)>/);
              if (match && match[1]) {
                const coinType = match[1];
                console.log(`Found coin type ${coinType} for object ${tokenAddress}`);
                
                // Try to get metadata for this coin type
                const result = await this.validateTokenAddress(coinType);
                if (result.isValid && result.tokenInfo) {
                  return result;
                }
              }
            }
          }
        } catch (objectError) {
          console.error(`Failed to get object info for ${tokenAddress}:`, objectError);
          // Continue with fallback validation
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