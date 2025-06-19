import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { Transaction } from "@mysten/sui/transactions"
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils"
import { SuiHTTPTransport } from "@mysten/sui/client"
import SUI_CONFIG from "@/config/sui-config"
import { toDecimalUnits, fromDecimalUnits } from "@/utils/token-utils"
import { tokenService } from "@/services/token-service"
import { requestQueue } from './request-queue'

// Enhanced coin conversion utilities for consistent handling
class CoinConverter {
  private static instance: CoinConverter
  private tokenCache = new Map<string, { decimals: number; symbol: string }>()
  
  static getInstance(): CoinConverter {
    if (!CoinConverter.instance) {
      CoinConverter.instance = new CoinConverter()
    }
    return CoinConverter.instance
  }
  
  /**
   * Convert human-readable amount to contract decimal units
   * @param amount Human-readable amount
   * @param tokenType Token type identifier
   * @returns Converted amount in decimal units
   */
  async toContractUnits(amount: number | string, tokenType?: string): Promise<string> {
    if (!amount || amount === 0 || amount === "0") return "0"
    
    try {
      const decimals = await this.getTokenDecimals(tokenType)
      const result = toDecimalUnits(amount.toString(), decimals)
      console.log(`[CoinConverter] ${amount} ${tokenType || 'SUI'} -> ${result} (decimals: ${decimals})`)
      return result
    } catch (error) {
      console.error(`[CoinConverter] Failed to convert ${amount} ${tokenType}:`, error)
      throw new Error(`Failed to convert token amount: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * Convert contract decimal units to human-readable amount
   * @param decimalAmount Amount in contract decimal units
   * @param tokenType Token type identifier
   * @returns Human-readable amount
   */
  async fromContractUnits(decimalAmount: number | string, tokenType?: string): Promise<string> {
    if (!decimalAmount || decimalAmount === 0 || decimalAmount === "0") return "0"
    
    try {
      const decimals = await this.getTokenDecimals(tokenType)
      const result = fromDecimalUnits(decimalAmount.toString(), decimals)
      console.log(`[CoinConverter] ${decimalAmount} (decimals: ${decimals}) -> ${result} ${tokenType || 'SUI'}`)
      return result
    } catch (error) {
      console.error(`[CoinConverter] Failed to convert ${decimalAmount} from ${tokenType}:`, error)
      throw new Error(`Failed to convert from contract units: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * Get token decimals with caching
   * @param tokenType Token type identifier
   * @returns Number of decimals for the token
   */
  private async getTokenDecimals(tokenType?: string): Promise<number> {
    // Default to SUI if no token type specified
    if (!tokenType || tokenType === "" || tokenType === "none") {
      return tokenService.getSuiTokenInfo().decimals
    }
    
    // Check cache first
    if (this.tokenCache.has(tokenType)) {
      return this.tokenCache.get(tokenType)!.decimals
    }
    
    try {
      const tokenInfo = await tokenService.getTokenInfo(tokenType)
      if (tokenInfo && tokenInfo.decimals !== undefined) {
        this.tokenCache.set(tokenType, { decimals: tokenInfo.decimals, symbol: tokenInfo.symbol })
        return tokenInfo.decimals
      }
    } catch (error) {
      console.warn(`[CoinConverter] Failed to get token info for ${tokenType}, defaulting to SUI:`, error)
    }
    
    // Fallback to SUI decimals
    const suiDecimals = tokenService.getSuiTokenInfo().decimals
    this.tokenCache.set(tokenType, { decimals: suiDecimals, symbol: 'SUI' })
    return suiDecimals
  }
  
  /**
   * Clear token cache (useful for testing or when token info changes)
   */
  clearCache(): void {
    this.tokenCache.clear()
  }
}

// Enhanced vote configuration interface for better type safety
export interface VoteConfiguration {
  title: string
  description: string
  startTimestamp: number
  endTimestamp: number
  paymentAmount: number | string  // Human-readable amount
  requireAllPolls: boolean
  tokenRequirement?: string
  tokenAmount?: number | string   // Human-readable amount
  showLiveStats: boolean
  useTokenWeighting: boolean
  tokensPerVote: number | string  // Human-readable amount
  usePaymentWeighting: boolean
  paymentTokenWeight: number | string  // Human-readable amount
  whitelistAddresses: string[]
  voterWeights: number[]
}

// Enhanced voting parameters interface
export interface VotingParameters {
  voteId: string
  pollIndex: number
  optionIndices: number[]
  tokenBalance: number | string   // Human-readable amount
  payment: number | string        // Human-readable amount
}

// Constants from configuration
const PACKAGE_ID = SUI_CONFIG.PACKAGE_ID
const ADMIN_ID = SUI_CONFIG.ADMIN_ID

/**
 * Vote details interface with enhanced coin handling
 */
export interface VoteDetails {
  id: string
  creator: string
  creatorName?: string
  title: string
  description: string
  startTimestamp: number
  endTimestamp: number
  paymentAmount: string        // Human-readable amount
  requireAllPolls: boolean
  pollsCount: number
  totalVotes: number
  isCancelled: boolean
  status: "active" | "pending" | "upcoming" | "closed" | "voted"
  tokenRequirement?: string    
  tokenAmount?: string         // Human-readable amount
  hasWhitelist: boolean        
  showLiveStats: boolean
  useTokenWeighting: boolean 
  tokensPerVote: string        // Human-readable amount
  paymentTokenWeight?: string  // Human-readable amount
  // Security and audit fields
  usePaymentWeighting: boolean
  version: number
  isLocked: boolean
  creationTimestamp: number
  // Security indicators (computed)
  securityLevel: "basic" | "enhanced" | "maximum"
  hasReentrancyProtection: boolean
  hasInputValidation: boolean
  
  // Raw contract values (for internal use)
  _rawPaymentAmount?: string
  _rawTokenAmount?: string
  _rawTokensPerVote?: string
  _rawPaymentTokenWeight?: string
}

/**
 * Poll details interface
 */
export interface PollDetails {
  id: string
  title: string
  description: string
  isMultiSelect: boolean
  maxSelections: number
  minSelections?: number
  isRequired: boolean
  optionsCount: number
  totalResponses: number
  options?: PollOptionDetails[]
}

/**
 * Poll option details interface
 */
export interface PollOptionDetails {
  id: string
  text: string
  mediaUrl?: string
  votes: number
  percentage?: number
}

/**
 * Vote cast event interface with enhanced coin handling
 */
export interface VoteCastEvent {
  vote_id: string
  poll_id: string
  voter: string
  option_indices: number[]
  token_balance: string    // Human-readable amount
  vote_weight: string      // Human-readable amount
  payment_amount?: string  // Human-readable amount
  
  // Raw contract values (for internal use)
  _rawTokenBalance?: string
  _rawVoteWeight?: string
  _rawPaymentAmount?: string
}

/**
 * Vote created event interface with enhanced coin handling
 */
export interface VoteCreatedEvent {
  vote_id: string
  creator: string
  title: string
  start_timestamp: number
  end_timestamp: number
  polls_count: number
  token_requirement?: string    
  token_amount?: string         // Human-readable amount
  has_whitelist: boolean        
  show_live_stats: boolean
  use_token_weighting: boolean
  tokens_per_vote: string       // Human-readable amount
  payment_amount?: string       // Human-readable amount
  payment_token_weight?: string // Human-readable amount
  
  // Raw contract values (for internal use)
  _rawTokenAmount?: string
  _rawTokensPerVote?: string
  _rawPaymentAmount?: string
  _rawPaymentTokenWeight?: string
}

/**
 * New interface: Voter whitelisted event
 */
export interface VoterWhitelistedEvent {
  vote_id: string
  voter_address: string
}

/**
 * Poll data interface for creating votes
 */
export interface PollData {
  title: string
  description: string
  isMultiSelect: boolean
  maxSelections: number
  isRequired: boolean
  options: {
    text: string
    mediaUrl?: string
  }[]
}

/**
 * Vote list interface for display with enhanced coin handling
 */
export interface VoteList {
  id: string
  title: string
  description: string
  status: "active" | "pending" | "upcoming" | "closed" | "voted"
  created: string
  votes: number
  pollCount: number
  endTimestamp: number
  tokenRequirement?: string
  tokenAmount?: string         // Human-readable amount
  hasWhitelist: boolean
  isWhitelisted?: boolean  
  showLiveStats: boolean
  useTokenWeighting: boolean
  tokensPerVote: string        // Human-readable amount
  paymentAmount?: string       // Human-readable amount
  paymentTokenWeight?: string  // Human-readable amount
  
  // Raw contract values (for internal use)
  _rawTokenAmount?: string
  _rawTokensPerVote?: string
  _rawPaymentAmount?: string
  _rawPaymentTokenWeight?: string
}

/**
 * Voter information interface with enhanced coin handling
 */
export interface VoterInfo {
  voter: string;
  tokenBalance: string;        // Human-readable amount
  voteWeight: string;          // Human-readable amount
  paymentAmount?: string;      // Human-readable amount
  timestamp: number;
  polls: {
    pollId: string;
    optionIndices: number[];
  }[];
  
  // Raw contract values (for internal use)
  _rawTokenBalance?: string;
  _rawVoteWeight?: string;
  _rawPaymentAmount?: string;
}

export class SuiVoteService {
  private client: SuiClient
  private isInitialized = false
  private subscriptions: Map<string, () => void> = new Map()
  private coinConverter: CoinConverter
  
  // Performance optimization: Caching
  private voteStatusCache = new Map<string, { hasVoted: boolean; timestamp: number }>()
  private voteDetailsCache = new Map<string, { details: VoteDetails; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly VOTE_STATUS_CACHE_TTL = 2 * 60 * 1000 // 2 minutes for vote status

  constructor(network = SUI_CONFIG.NETWORK) {
    // Initialize coin converter
    this.coinConverter = CoinConverter.getInstance()
    try {
      // Initialize client with both HTTP and WebSocket transport
      const validNetwork = network as 'mainnet' | 'testnet' | 'devnet' | 'localnet'
      const transport = new SuiHTTPTransport({
        url: getFullnodeUrl(validNetwork),
        websocket: {
          reconnectTimeout: 1000,
          url: getFullnodeUrl(validNetwork).replace('http', 'ws'),
        }
      })
      
      this.client = new SuiClient({ transport })
      this.isInitialized = true
      
      // Set up periodic cache cleanup (every 10 minutes)
      setInterval(() => {
        this.clearExpiredCaches()
      }, 10 * 60 * 1000)
    } catch (error) {
      throw new Error(`Failed to initialize SuiVoteService: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Retry wrapper for network requests with exponential backoff
   * @private
   */
  private async retryRequest<T>(
    operation: () => Promise<T>,
    maxRetries: number = SUI_CONFIG.MAX_RETRIES,
    baseDelay: number = SUI_CONFIG.RETRY_DELAY_MS
  ): Promise<T> {
    return requestQueue.add(async () => {
      let lastError: Error
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on certain errors
        if (lastError.message.includes('CORS') || 
            lastError.message.includes('Access-Control-Allow-Origin')) {
          throw new Error('CORS error: Please ensure the application is served from a proper domain or configure CORS headers on the RPC endpoint.')
        }
        
        // For rate limiting, wait longer
        if (lastError.message.includes('429') || 
            lastError.message.includes('Too Many Requests') ||
            lastError.message.includes('rate limit') ||
            lastError.message.includes('Rate limit')) {
          if (attempt === maxRetries) {
            throw new Error('Rate limit exceeded: The Sui testnet RPC is currently rate limiting requests. Please try again later or consider using a different RPC endpoint.')
          }
          // More aggressive exponential backoff with jitter for rate limits
          const delay = Math.min(baseDelay * Math.pow(3, attempt) + Math.random() * 2000, 60000)
          console.warn(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // For other network errors, retry with shorter delay
        if (attempt < maxRetries && 
            (lastError.message.includes('fetch') || 
             lastError.message.includes('network') ||
             lastError.message.includes('ERR_FAILED'))) {
          const delay = baseDelay * Math.pow(1.5, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // Don't retry on other errors
        throw lastError
      }
    }
    
    throw lastError!
    })
  }

  /**
   * Check if the service is properly initialized
   * @private
   */
  private checkInitialization() {
    if (!this.isInitialized) {
      throw new Error("SuiVoteService is not properly initialized")
    }

    if (!PACKAGE_ID || PACKAGE_ID === "YOUR_PACKAGE_ID_HERE") {
      throw new Error("Package ID is not properly configured. Please set the correct PACKAGE_ID in your configuration.")
    }

    if (!ADMIN_ID || ADMIN_ID === "ADMIN_OBJECT_ID_FROM_PUBLISH_OUTPUT") {
      throw new Error("Admin ID is not properly configured. Please set the correct ADMIN_ID in your configuration.")
    }
  }

  /**
 * Get votes created by a specific address
 * @param address The creator's address
 * @param limit Maximum number of votes to return
 * @param cursor Pagination cursor
 * @returns Array of vote details with pagination cursor
 */
  async getVotesCreatedByAddress(
    address: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ data: VoteDetails[]; nextCursor?: string }> {
    try {
      this.checkInitialization()

      if (!address) {
        throw new Error("Address is required")
      }

      // Query for VoteCreated events using MoveEventType filter
      const eventsResponse = await this.retryRequest(async () => {
        return await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::voting::VoteCreated`
          },
          cursor: cursor as any,
          limit: 100, // Using a higher limit initially since we'll filter manually
          order: "descending", // Get most recent first
        })
      })

      // Process events to extract vote IDs
      const votes: VoteDetails[] = []
      const processedIds = new Set<string>()

      // Manually filter the events for creator = address
      const filteredEvents = eventsResponse.data.filter(event => {
        if (!event.parsedJson) return false
        const voteCreatedEvent = event.parsedJson as VoteCreatedEvent
        return voteCreatedEvent.creator === address
      })

      // Use Promise.all for parallel processing
      await Promise.all(
        filteredEvents.map(async (event) => {
          if (!event.parsedJson) return

          const voteCreatedEvent = event.parsedJson as VoteCreatedEvent

          // Avoid processing duplicates
          if (processedIds.has(voteCreatedEvent.vote_id)) return
          processedIds.add(voteCreatedEvent.vote_id)

          // Get detailed vote information
          const voteDetails = await this.getVoteDetails(voteCreatedEvent.vote_id)
          if (voteDetails) {
            votes.push(voteDetails)
          }
        }),
      )

      // Sort by most recent first
      votes.sort((a, b) => b.startTimestamp - a.startTimestamp)

      // Apply limit after filtering
      const limitedVotes = votes.slice(0, limit)
      return {
        data: limitedVotes,
        nextCursor: eventsResponse.nextCursor as string | undefined,
      }
    } catch (error) {
      throw new Error(`Failed to fetch votes: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get votes that a user has participated in
   * @param address The voter's address
   * @param limit Maximum number of votes to return
   * @param cursor Pagination cursor
   * @returns Array of vote details with pagination cursor
   */
  async getVotesParticipatedByAddress(
    address: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ data: VoteDetails[]; nextCursor?: string }> {
    try {
      this.checkInitialization()

      if (!address) {
        throw new Error("Address is required")
      }
      // Query for VoteCast events using MoveEventType filter
      const eventsResponse = await this.retryRequest(async () => {
        return await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
          },
          cursor: cursor as any,
          limit: 100, // Using a higher limit initially since we'll filter manually
          order: "descending", // Get most recent first
        })
      })

      // Manually filter the events for voter = address
      const filteredEvents = eventsResponse.data.filter(event => {
        if (!event.parsedJson) return false
        const voteCastEvent = event.parsedJson as VoteCastEvent
        return voteCastEvent.voter === address
      })
      // Process events to extract unique vote IDs
      const voteIds = new Set<string>()
      for (const event of filteredEvents) {
        if (!event.parsedJson) continue

        const voteCastEvent = event.parsedJson as VoteCastEvent
        voteIds.add(voteCastEvent.vote_id)
      }
      // Fetch details for each unique vote in parallel
      const votesPromises = Array.from(voteIds).map((voteId) => this.getVoteDetails(voteId))
      const votesResults = await Promise.all(votesPromises)

      // Filter out null results and respect the limit
      const votes = votesResults.filter(Boolean) as VoteDetails[]
      const limitedVotes = votes.slice(0, limit)

      return {
        data: limitedVotes,
        nextCursor: eventsResponse.nextCursor as string | undefined,
      }
    } catch (error) {
      console.error("Failed to fetch participated votes:", error)
      throw new Error(`Failed to fetch participated votes: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get all votes for a user (created, participated, and whitelisted)
   * @param address User address
   * @param limit Maximum number of votes to return
   * @returns Array of vote list objects
   */
  async getMyVotes(address: string, limit = 20): Promise<{ data: VoteList[] }> {
    try {
      this.checkInitialization()

      if (!address) {
        throw new Error("Address is required")
      }

      // Get votes created by the user
      const { data: createdVotes } = await this.getVotesCreatedByAddress(address, limit)

      // Get votes the user participated in
      const { data: participatedVotes } = await this.getVotesParticipatedByAddress(address, limit)

      // Get votes where the user is whitelisted
      const { data: whitelistedVotes } = await this.getVotesWhitelistedForAddress(address, limit)

      // Check which votes the user has already voted in (optimized batch check)
      const allVoteIds = Array.from(new Set([
        ...createdVotes.map(vote => vote.id),
        ...participatedVotes.map(vote => vote.id),
        ...whitelistedVotes.map(vote => vote.id)
      ]))

      const voteStatusMap = await this.batchCheckVoteStatus(address, allVoteIds)
      const votedVoteIds = new Set(
        Array.from(voteStatusMap.entries())
          .filter(([_, hasVoted]) => hasVoted)
          .map(([voteId, _]) => voteId)
      )

      // Combine and deduplicate votes
      const allVoteMap = new Map<string, VoteDetails>()

      // Add created votes to map
      createdVotes.forEach((vote) => {
        allVoteMap.set(vote.id, vote)
      })

      // Add participated votes to map (if not already added)
      participatedVotes.forEach((vote) => {
        if (!allVoteMap.has(vote.id)) {
          allVoteMap.set(vote.id, vote)
        }
      })

      // Add whitelisted votes to map (if not already added)
      whitelistedVotes.forEach((vote) => {
        if (!allVoteMap.has(vote.id)) {
          allVoteMap.set(vote.id, vote)
        }
      })

      // Create a Set of whitelisted vote IDs for easy lookups
      const whitelistedVoteIds = new Set(whitelistedVotes.map(vote => vote.id))

      // Get current time for status determination
      const currentTime = Date.now()

      // Convert to VoteList format with adjusted status
      const voteList: VoteList[] = Array.from(allVoteMap.values()).map((vote) => {
        // Determine the correct status based on the requirements
        let status: "active" | "pending" | "upcoming" | "closed" | "voted"

        // First, If it's a closed vote 
        if (currentTime > vote.endTimestamp || vote.isCancelled) {
          status = "closed"
        }
        // Then check if the user has already voted in this vote 
        else if (votedVoteIds.has(vote.id) ) {
          status = "voted"
        }
        // it's an upcoming vote
        else if (currentTime < vote.startTimestamp) {
          status = "upcoming"
        }
        // If the user's wallet is whitelisted for this vote and it's active
        else if (whitelistedVoteIds.has(vote.id)) {
          status = "pending"
        }
        // Otherwise, it's an active vote the user hasn't participated in yet
        else {
          status = "active"
        }

        return {
          id: vote.id,
          title: vote.title,
          description: vote.description,
          status,
          created: new Date(vote.startTimestamp).toLocaleDateString(),
          votes: vote.totalVotes,
          pollCount: vote.pollsCount,
          endTimestamp: vote.endTimestamp,
          tokenRequirement: vote.tokenRequirement,
          tokenAmount: vote.tokenAmount,
          hasWhitelist: vote.hasWhitelist,
          isWhitelisted: whitelistedVoteIds.has(vote.id),
          showLiveStats: vote.showLiveStats,
          useTokenWeighting: vote.useTokenWeighting,
          tokensPerVote: vote.tokensPerVote,
          paymentAmount: vote.paymentAmount,
          paymentTokenWeight: vote.paymentTokenWeight,
          // Raw contract values for internal use
          _rawTokenAmount: vote._rawTokenAmount,
          _rawTokensPerVote: vote._rawTokensPerVote,
          _rawPaymentAmount: vote._rawPaymentAmount,
          _rawPaymentTokenWeight: vote._rawPaymentTokenWeight
        }
      })

      // Sort by most recent first
      voteList.sort((a, b) => {
        return new Date(b.created).getTime() - new Date(a.created).getTime()
      })

      return {
        data: voteList.slice(0, limit),
      }
    } catch (error) {
      console.error("Failed to fetch user votes:", error)
      throw new Error(`Failed to fetch user votes: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Subscribe to vote events for real-time updates
   * @param voteId The vote object ID
   * @param onUpdate Callback function to handle updates
   * @returns Unsubscribe function
   */
  subscribeToVoteUpdates(voteId: string, onUpdate: (voteDetails: VoteDetails) => void, userAddress?: string): () => void {
    this.checkInitialization()
    
    // Check if we already have a subscription for this vote
    if (this.subscriptions.has(voteId)) {
      // Return the existing unsubscribe function
      return this.subscriptions.get(voteId)!
    }
    
    try {
      // Set up a polling mechanism for vote updates
      // Note: Ideally we would use WebSocket subscriptions, but they're being deprecated
      // This is a fallback using polling until the new streaming API is available
      const intervalId = setInterval(async () => {
        try {
          // Get the vote details
          const voteDetails = await this.getVoteDetails(voteId)
          if (voteDetails) {
            // Get polls and options data to ensure we have the latest vote counts
            try {
              // Get polls for the vote
              const pollsData = await this.getVotePolls(voteId)
              
              // Fetch options for each poll to get the latest vote counts
              await Promise.all(
                pollsData.map(async (poll, index) => {
                  // Get options for this poll (index + 1 because poll indices are 1-based)
                  await this.getPollOptions(voteId, index + 1)
                })
              )
            } catch (pollError) {
              console.error(`Error fetching poll data during subscription update for ${voteId}:`, pollError)
              // Continue with the vote details update even if poll data fetch fails
            }
            
            // If we have a user address, check if they have voted to provide accurate status
            if (userAddress && voteDetails.status === 'active') {
              try {
                const hasVoted = await this.hasVoted(userAddress, voteId)
                if (hasVoted) {
                  // Override status to 'voted' if user has voted
                  voteDetails.status = 'voted'
                }
              } catch (votingCheckError) {
                console.warn(`Could not check voting status for user ${userAddress} on vote ${voteId}:`, votingCheckError)
                // Continue with original status if voting check fails
              }
            }
            
            // Update with the latest vote details
            onUpdate(voteDetails)
          }
        } catch (error) {
          console.error(`Error polling vote updates for ${voteId}:`, error)
        }
      }, 10000) // Poll every 10 seconds (reduced from 3 seconds to prevent rate limiting)
      
      // Create unsubscribe function
      const unsubscribe = () => {
        clearInterval(intervalId)
        this.subscriptions.delete(voteId)
      }
      
      // Store the unsubscribe function
      this.subscriptions.set(voteId, unsubscribe)
      
      return unsubscribe
    } catch (error) {
      console.error(`Failed to subscribe to vote updates for ${voteId}:`, error)
      // Return a no-op function in case of error
      return () => {}
    }
  }
  
  /**
   * Get detailed information about a specific vote (with caching)
   * @param voteId The vote object ID
   * @returns Vote details
   * @throws Error if vote is not found or invalid
   */
  async getVoteDetails(voteId: string): Promise<VoteDetails> {
  try {
    this.checkInitialization()

    if (!voteId) {
      console.warn("Empty voteId provided to getVoteDetails")
      throw new Error("Vote ID is required")
    }

    // Check cache first
    const cached = this.voteDetailsCache.get(voteId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.details
    }
    console.log("Fetching vote details from Move function", cached)
    // Fetch the vote object with retry logic
    const { data } = await this.retryRequest(async () => {
      return await this.client.getObject({
        id: voteId,
        options: {
          showContent: true,
          showType: true,
        },
      })
    })

    if (!data || !data.content || data.content.dataType !== "moveObject") {
      const error = new Error(`Vote object not found or invalid: ${voteId}`);
      console.error(error instanceof Error ? error.message : String(error));
      throw error;
    }

    const objectType = data.type as string
    // Verify this is a Vote object from our package
    if (!objectType || !objectType.startsWith(`${PACKAGE_ID}::voting::Vote`)) {
      console.warn(`Object is not a Vote type: ${objectType}`)
      const error = new Error(`Invalid vote object type: ${objectType}. Expected a Vote object from package ${PACKAGE_ID}.`);
      console.error(error.message);
      throw error;
    }

    const fields = data.content.fields as Record<string, any>
    console.log("Fields", fields)
    // Get current time to determine vote status
    const currentTime = Date.now()
    const startTimestamp = Number(fields.start_timestamp)
    const endTimestamp = Number(fields.end_timestamp)
    const isCancelled = fields.is_cancelled

    // Default status - will be refined by the getMyVotes method
    let status: "active" | "pending" | "upcoming" | "closed" | "voted"
    if (isCancelled) {
      status = "closed"
    } else if (currentTime < startTimestamp) {
      status = "upcoming"
    } else if (currentTime <= endTimestamp) {
      status = "active" // Default to active, will be refined to "pending" or "voted" by getMyVotes if needed
    } else {
      status = "closed"
    }

    let tokenRequirement = fields.token_requirement;
    let tokenAmount = fields.token_amount;
    let useTokenWeighting = false;
    let tokensPerVote = 0;

    // Extract token weighting fields
    if ('use_token_weighting' in fields) {
      useTokenWeighting = !!fields.use_token_weighting;
    }

    if ('tokens_per_vote' in fields) {
      tokensPerVote = Number(fields.tokens_per_vote);
    }

    // Extract security fields early to avoid hoisting issues
    const usePaymentWeighting = !!fields.use_payment_weighting
    
    // Store raw contract values for internal use
    const rawTokenAmount = tokenAmount?.toString()
    const rawTokensPerVote = tokensPerVote?.toString()
    const rawPaymentAmount = fields.payment_amount?.toString()
    const rawPaymentTokenWeight = fields.payment_token_weight?.toString()
    
    // Convert token amounts from contract units to human-readable format using CoinConverter
    let convertedTokenAmount: string | undefined
    let convertedTokensPerVote: string
    let convertedPaymentAmount: string
    let convertedPaymentTokenWeight: string | undefined
    
    try {
      // Convert token amount if present
      if (tokenRequirement && tokenAmount !== undefined && tokenAmount !== null) {
        convertedTokenAmount = await this.coinConverter.fromContractUnits(tokenAmount, tokenRequirement)
        console.log(`[DEBUG] Converted token amount: ${tokenAmount} -> ${convertedTokenAmount} ${tokenRequirement}`)
      }
      
      // Convert tokens per vote for token weighting
      if (useTokenWeighting && tokensPerVote > 0) {
        const tokenType = tokenRequirement && tokenRequirement !== "none" ? tokenRequirement : undefined
        convertedTokensPerVote = await this.coinConverter.fromContractUnits(tokensPerVote, tokenType)
        console.log(`[DEBUG] Converted tokens per vote: ${tokensPerVote} -> ${convertedTokensPerVote}`)
      } else {
        convertedTokensPerVote = "0"
      }
      
      // Convert payment amount (always in SUI/MIST)
      const paymentAmount = fields.payment_amount || 0
      convertedPaymentAmount = await this.coinConverter.fromContractUnits(paymentAmount)
      console.log(`[DEBUG] Converted payment amount: ${paymentAmount} MIST -> ${convertedPaymentAmount} SUI`)
      
      // Convert payment token weight if present (always in SUI/MIST)
      if (usePaymentWeighting && fields.payment_token_weight) {
        convertedPaymentTokenWeight = await this.coinConverter.fromContractUnits(fields.payment_token_weight)
        console.log(`[DEBUG] Converted payment token weight: ${fields.payment_token_weight} MIST -> ${convertedPaymentTokenWeight} SUI`)
      } else {
        // When payment weighting is disabled, set to "0"
        convertedPaymentTokenWeight = "0"
        console.log(`[DEBUG] Payment weighting disabled, setting payment token weight to "0"`)
      }
    } catch (error) {
      console.error('[DEBUG] Failed to convert token amounts using CoinConverter:', error)
      // Fallback to string conversion of original values
      convertedTokenAmount = tokenAmount?.toString()
      convertedTokensPerVote = tokensPerVote?.toString() || "0"
      convertedPaymentAmount = fields.payment_amount?.toString() || "0"
      convertedPaymentTokenWeight = usePaymentWeighting ? fields.payment_token_weight?.toString() : "0"
    }
    
    // Extract remaining security fields
    const version = Number(fields.version || 1)
    const isLocked = !!fields.is_locked
    const creationTimestamp = Number(fields.creation_timestamp || startTimestamp)
    
    // Compute security indicators
    const hasReentrancyProtection = version >= 2 // Reentrancy protection added in version 2
    const hasInputValidation = version >= 2 // Input validation added in version 2
    
    // Calculate security level based on features
    let securityLevel: "basic" | "enhanced" | "maximum" = "basic"
    let securityScore = 0
    
    // Base security features
    if (hasReentrancyProtection) securityScore += 2
    if (hasInputValidation) securityScore += 2
    if (version >= 2) securityScore += 1
    
    // Advanced security features
    if (fields.has_whitelist) securityScore += 1
    if (tokenRequirement) securityScore += 1
    if (useTokenWeighting) securityScore += 1
    if (usePaymentWeighting) securityScore += 1
    
    // Determine security level
    if (securityScore >= 7) {
      securityLevel = "maximum"
    } else if (securityScore >= 4) {
      securityLevel = "enhanced"
    }

    // Build the vote details object with all fields using converted values
    const voteDetails: VoteDetails = {
      id: voteId,
      creator: fields.creator,
      title: fields.title,
      description: fields.description,
      startTimestamp,
      endTimestamp,
      paymentAmount: convertedPaymentAmount,
      requireAllPolls: !!fields.require_all_polls,
      pollsCount: Number(fields.polls_count || 0),
      totalVotes: Number(fields.total_votes || 0),
      isCancelled,
      status,
      tokenRequirement,
      tokenAmount: convertedTokenAmount,
      hasWhitelist: !!fields.has_whitelist,
      showLiveStats: !!fields.show_live_stats,
      useTokenWeighting,
      tokensPerVote: convertedTokensPerVote,
      paymentTokenWeight: convertedPaymentTokenWeight,
      // Security and audit fields
      usePaymentWeighting,
      version,
      isLocked,
      creationTimestamp,
      // Security indicators (computed)
      securityLevel,
      hasReentrancyProtection,
      hasInputValidation,
      // Raw contract values for internal use
      _rawPaymentAmount: rawPaymentAmount,
      _rawTokenAmount: rawTokenAmount,
      _rawTokensPerVote: rawTokensPerVote,
      _rawPaymentTokenWeight: rawPaymentTokenWeight
    }

    // Cache the result
    this.voteDetailsCache.set(voteId, { details: voteDetails, timestamp: Date.now() })

    return voteDetails
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage?.includes("not found")) {
      console.error(`Vote ${voteId} not found:`, errorMessage);
      throw new Error(`Vote ${voteId} not found. It may have been deleted or never existed.`);
    } else if (errorMessage?.includes("network")) {
      console.error(`Network error fetching vote ${voteId}:`, errorMessage);
      throw new Error("Network error. Please check your connection and try again.");
    } else {
      console.error(`Failed to fetch vote details for ${voteId}:`, errorMessage);
      throw new Error(`Failed to fetch vote details: ${errorMessage || "Unknown error"}`);
    }
  }
}

  /**
   * Get detailed information about a vote's polls
   * @param voteId The vote object ID
   * @returns Array of poll details
   */
  async getVotePolls(voteId: string): Promise<PollDetails[]> {
    try {
      this.checkInitialization()
  
      if (!voteId) {
        throw new Error("Vote ID is required")
      }
  
      // First get the vote details to check pollsCount
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails) throw new Error(`Vote ${voteId} not found`)
  

  
      const polls: (PollDetails | null)[] = new Array(voteDetails.pollsCount).fill(null)
      
      // Fetch all polls in parallel but maintain order
      const pollPromises = Array.from({ length: voteDetails.pollsCount }, (_, i) => {
        const pollIndex = i + 1 // 1-based indexing
        
        return (async () => {
          try {

            
            // Get the dynamic field (poll) by name
            const pollField = await this.client.getDynamicFieldObject({
              parentId: voteId,
              name: {
                type: "u64",
                value: pollIndex.toString(),
              },
            })
  
            if (!pollField.data || !pollField.data.content || pollField.data.content.dataType !== "moveObject") {
              console.warn(`Poll at index ${pollIndex} not found`)
              return null
            }
  
            const pollFields = pollField.data.content.fields as Record<string, any>
            const pollId = pollField.data.objectId
  
            // Build poll details
            const pollDetails: PollDetails = {
              id: pollId,
              title: pollFields.title,
              description: pollFields.description,
              isMultiSelect: !!pollFields.is_multi_select,
              maxSelections: Number(pollFields.max_selections || 1),
              isRequired: !!pollFields.is_required,
              optionsCount: Number(pollFields.options_count || 0),
              totalResponses: Number(pollFields.total_responses || 0),
              options: [], // Will be populated separately if needed
            }
            

            
            // Store in the correct position
            polls[i] = pollDetails
            
            return pollDetails
          } catch (error) {
            console.error(`Failed to fetch poll at index ${pollIndex} for vote ${voteId}:`, error)
            return null
          }
        })()
      })
  
      // Wait for all polls to be fetched
      await Promise.all(pollPromises)
  
      // Filter out null values and ensure order is preserved
      const orderedPolls = polls.filter((poll): poll is PollDetails => poll !== null)
      

  
      return orderedPolls
    } catch (error) {
      console.error(`Failed to fetch polls for vote ${voteId}:`, error)
      throw new Error(`Failed to fetch polls: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  

  /**
   * Get detailed information about a poll's options
   * @param voteId The vote object ID
   * @param pollIndex The poll index (1-based)
   * @returns Array of poll option details
   */
  async getPollOptions(voteId: string, pollIndex: number): Promise<PollOptionDetails[]> {
    try {
      this.checkInitialization()
  
      if (!voteId) {
        throw new Error("Vote ID is required")
      }
  
      if (pollIndex < 1) {
        throw new Error("Poll index must be 1 or greater")
      }
  

  
      // First get the poll details
      const polls = await this.getVotePolls(voteId)
      if (!polls || polls.length < pollIndex) {
        throw new Error(`Poll index ${pollIndex} not found for vote ${voteId}`)
      }
  
      const poll = polls[pollIndex - 1] // Convert to 0-based index
      const pollId = poll.id
  

  
      const options: (PollOptionDetails | null)[] = new Array(poll.optionsCount).fill(null)
  
      // Fetch all options in parallel but maintain order
      const optionPromises = Array.from({ length: poll.optionsCount }, (_, i) => {
        const optionIndex = i + 1 // 1-based indexing
        
        return (async () => {
          try {

            
            // Get the dynamic field (option) by name
            const optionField = await this.client.getDynamicFieldObject({
              parentId: pollId,
              name: {
                type: "u64",
                value: optionIndex.toString(),
              },
            })
  
            if (!optionField.data || !optionField.data.content || optionField.data.content.dataType !== "moveObject") {
              console.warn(`Option at index ${optionIndex} not found for poll ${pollId}`)
              return null
            }
  
            const optionFields = optionField.data.content.fields as Record<string, any>
            const optionId = optionField.data.objectId
  
            // Build option details
            const optionDetails: PollOptionDetails = {
              id: optionId,
              text: optionFields.text,
              mediaUrl: optionFields.media_url?.fields?.value || undefined,
              votes: Number(optionFields.votes || 0),
            }
  

            
            // Store in the correct position
            options[i] = optionDetails
            
            return optionDetails
          } catch (error) {
            console.error(`Failed to fetch option at index ${optionIndex} for poll ${pollId}:`, error)
            return null
          }
        })()
      })
  
      // Wait for all options to be fetched
      await Promise.all(optionPromises)
  
      // Filter out null values and ensure order is preserved
      const orderedOptions = options.filter((option): option is PollOptionDetails => option !== null)
      

  
      return orderedOptions
    } catch (error) {
      console.error(`Failed to fetch options for poll ${pollIndex} in vote ${voteId}:`, error)
      throw new Error(`Failed to fetch poll options: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
     * Create a complete vote with polls and options in a single transaction
     * @param title Vote title
     * @param description Vote description
     * @param startTimestamp Start timestamp in milliseconds
     * @param endTimestamp End timestamp in milliseconds
     * @param paymentAmount Payment amount in SUI (will be converted to MIST)
     * @param requireAllPolls Whether all polls must be answered
     * @param showLiveStats Whether to show live stats
     * @param pollData Poll configuration data
     * @returns Transaction to be signed
     */
  async createCompleteVoteTransaction(
    title: string,
    description: string,
    startTimestamp: number,
    endTimestamp: number,
    requiredToken = "",
    requiredAmount = 0,
    paymentAmount = 0,
    requireAllPolls = true,
    showLiveStats = false,
    pollData: PollData[],
    useTokenWeighting = false, 
    tokensPerVote = 0,
    usePaymentWeighting = false,
    whitelistAddresses: string[] = [],
    voterWeights: number[] = [],
    paymentTokenWeight = 0.1
  ): Promise<Transaction> {
    try {
      this.checkInitialization()

      // Validate inputs
      if (!title) {
        throw new Error("Vote title is required")
      }

      if (startTimestamp >= endTimestamp) {
        throw new Error("End timestamp must be after start timestamp")
      }



      if (!pollData || !Array.isArray(pollData) || pollData.length === 0) {
        throw new Error("At least one poll is required")
      }

      const tx = new Transaction()

      // Get current timestamp from Clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      // Initialize arrays for poll data
      const pollTitles: string[] = []
      const pollDescriptions: string[] = []
      const pollIsMultiSelect: boolean[] = []
      const pollMaxSelections: number[] = []
      const pollIsRequired: boolean[] = []
      const pollOptionCounts: number[] = []
      const pollOptionTexts: string[] = []
      const pollOptionMediaUrls: number[][] = []

      for (let pollIndex = 0; pollIndex < pollData.length; pollIndex++) {
        const poll = pollData[pollIndex]
        

        
        pollTitles.push(poll.title || "")
        pollDescriptions.push(poll.description || "")
        pollIsMultiSelect.push(!!poll.isMultiSelect)
        pollIsRequired.push(!!poll.isRequired)
  
        // Handle maxSelections for single/multi-select polls
        const maxSelections = poll.isMultiSelect
          ? Math.min(Math.max(1, poll.maxSelections), poll.options.length - 1)
          : 1
        pollMaxSelections.push(maxSelections)
  
        // Record option count for this poll
        pollOptionCounts.push(poll.options.length)
  
        // Process options for this poll in strict sequential order

        for (let optionIndex = 0; optionIndex < poll.options.length; optionIndex++) {
          const option = poll.options[optionIndex]
          

          
          pollOptionTexts.push(option.text || "")
  
          // Convert media URL to bytes (empty array if none)
          if (option.mediaUrl) {
            const mediaUrlBytes = new TextEncoder().encode(option.mediaUrl)
            pollOptionMediaUrls.push(Array.from(mediaUrlBytes))
          } else {
            pollOptionMediaUrls.push([])
          }
        }
      }

      // Convert token amounts to contract units using enhanced converter
      let convertedRequiredAmount = requiredAmount
      let convertedTokensPerVote = tokensPerVote
      let convertedPaymentTokenWeight = paymentTokenWeight
      let convertedPaymentAmount = paymentAmount
      
      console.log(`[DEBUG] Vote creation - Original values:`, {
        requiredToken,
        requiredAmount,
        tokensPerVote,
        paymentTokenWeight,
        paymentAmount,
        useTokenWeighting,
        usePaymentWeighting
      })
      
      try {
        // Convert required token amount
        if (requiredToken && requiredAmount > 0) {
          const convertedAmount = await this.coinConverter.toContractUnits(requiredAmount, requiredToken)
          convertedRequiredAmount = parseInt(convertedAmount)
          console.log(`[DEBUG] Required amount conversion: ${requiredAmount} -> ${convertedRequiredAmount}`)
        }
        
        // Convert tokens per vote for token weighting
        if (useTokenWeighting && tokensPerVote > 0) {
          const tokenType = requiredToken && requiredToken !== "none" ? requiredToken : undefined
          const convertedAmount = await this.coinConverter.toContractUnits(tokensPerVote, tokenType)
          convertedTokensPerVote = parseInt(convertedAmount)
          console.log(`[DEBUG] Tokens per vote conversion: ${tokensPerVote} -> ${convertedTokensPerVote}`)
        }
        
        // Convert payment token weight (always in SUI/MIST)
        if (usePaymentWeighting && paymentTokenWeight > 0) {
          const convertedAmount = await this.coinConverter.toContractUnits(paymentTokenWeight)
          convertedPaymentTokenWeight = parseInt(convertedAmount)
          console.log(`[DEBUG] Payment token weight conversion: ${paymentTokenWeight} SUI -> ${convertedPaymentTokenWeight} MIST`)
        } else {
          // When payment weighting is disabled, set to 0 in contract units
          convertedPaymentTokenWeight = 0
          console.log(`[DEBUG] Payment weighting disabled, setting payment token weight to 0`)
        }
        
        // Convert payment amount (always in SUI/MIST)
        if (paymentAmount > 0) {
          const convertedAmount = await this.coinConverter.toContractUnits(paymentAmount)
          convertedPaymentAmount = parseInt(convertedAmount)
          console.log(`[DEBUG] Payment amount conversion: ${paymentAmount} SUI -> ${convertedPaymentAmount} MIST`)
        }
      } catch (error) {
        console.error('[DEBUG] Failed to convert token amounts using CoinConverter:', error)
        throw new Error(`Token conversion failed: ${error instanceof Error ? error.message : String(error)}`)
      }
      
      // Handle voter weights: if empty but whitelist addresses exist, generate default weights of 1
      let finalVoterWeights = voterWeights
      if (whitelistAddresses.length > 0 && voterWeights.length === 0) {
        finalVoterWeights = whitelistAddresses.map(() => 1) // Default weight of 1 for basic whitelist
        console.log(`[DEBUG] Generated default voter weights for ${whitelistAddresses.length} whitelist addresses`)
      }
      
      // Validate whitelist addresses and voter weights arrays match
      if (whitelistAddresses.length !== finalVoterWeights.length) {
        throw new Error(`Whitelist addresses (${whitelistAddresses.length}) and voter weights (${finalVoterWeights.length}) arrays must have the same length`)
      }
      
      // Ensure voterWeights are properly converted to numbers
      const numericVoterWeights = finalVoterWeights.map(weight => {
        const numWeight = typeof weight === 'string' ? Number(weight) : Number(weight)
        if (isNaN(numWeight) || numWeight <= 0) {
          throw new Error(`Invalid voter weight: ${weight}. All voter weights must be valid positive numbers.`)
        }
        return numWeight
      })
      
      console.log(`[DEBUG] Final converted values for contract:`, {
        convertedRequiredAmount,
        convertedTokensPerVote,
        convertedPaymentTokenWeight,
        convertedPaymentAmount,
        whitelistCount: whitelistAddresses.length,
        voterWeightsCount: voterWeights.length,
        originalVoterWeights: voterWeights,
        finalVoterWeights: finalVoterWeights,
        numericVoterWeights: numericVoterWeights,
        numericVoterWeightsType: typeof numericVoterWeights,
        numericVoterWeightsArray: Array.isArray(numericVoterWeights)
      })
      
      // Auto-set SUI as default token for payment/token weighting when no token is specified
      if ((useTokenWeighting || usePaymentWeighting) && (!requiredToken || requiredToken.trim() === "")) {
        requiredToken = "0x2::sui::SUI"
        console.log('[DEBUG] Auto-setting SUI as default token for weighting')
      }
      
      // Build the transaction with proper arguments matching the contract
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::create_complete_vote`,
        arguments: [
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.u64(startTimestamp),
          tx.pure.u64(endTimestamp),
          tx.pure.u64(convertedPaymentAmount), // Use converted MIST amount
          tx.pure.bool(requireAllPolls),
          tx.pure.string(requiredToken),
          tx.pure.u64(convertedRequiredAmount), // Use converted token amount              
          tx.pure.bool(showLiveStats),
          tx.pure.bool(useTokenWeighting),   
          tx.pure.u64(convertedTokensPerVote), // Use converted tokens per vote
          tx.pure.bool(usePaymentWeighting), // Payment weighting parameter
          tx.pure.u64(convertedPaymentTokenWeight), // Use converted payment token weight
          tx.pure.vector("u64", numericVoterWeights), // voter_weights must be 15th parameter
          tx.pure.vector("string", pollTitles),
          tx.pure.vector("string", pollDescriptions),
          tx.pure.vector("bool", pollIsMultiSelect),
          tx.pure.vector("u64", pollMaxSelections),
          tx.pure.vector("bool", pollIsRequired),
          tx.pure.vector("u64", pollOptionCounts),
          tx.pure.vector("string", pollOptionTexts),
          tx.pure.vector("vector<u8>", pollOptionMediaUrls),
          tx.pure.vector("address", whitelistAddresses),
          clockObj,
        ],
      })
      return tx
    } catch (error) {
      console.error("Failed to create complete vote transaction:", error)
      throw new Error(
        `Failed to create complete vote transaction: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Create a combined transaction for uploading media to Walrus and creating a vote
   */
  async createVoteWithMediaTransaction(
    title: string,
    description: string,
    startTimestamp: number,
    endTimestamp: number,
    requiredToken = "",
    requiredAmount = 0,
    paymentAmount = 0,
    requireAllPolls = true,
    showLiveStats = false,
    useTokenWeighting = false,
    tokensPerVote = 0,
    usePaymentWeighting = false,
    pollData: PollData[],
    mediaFiles: Record<string, { data: Uint8Array, contentType: string }>,
    whitelistAddresses: string[] = [],
    voterWeights: number[] = []
  ): Promise<Transaction> {
    try {
      this.checkInitialization()

      // Validate inputs
      if (!title) {
        throw new Error("Vote title is required")
      }

      if (startTimestamp >= endTimestamp) {
        throw new Error("End timestamp must be after start timestamp")
      }

      if (!pollData || !Array.isArray(pollData) || pollData.length === 0) {
        throw new Error("At least one poll is required")
      }
      for (let i = 0; i < pollData.length; i++) {
        const poll = pollData[i]

        
        if (!poll.title) {
          throw new Error(`Poll ${i + 1} is missing a title`)
        }
        
        if (!poll.options || poll.options.length < 2) {
          throw new Error(`Poll ${i + 1} must have at least 2 options`)
        }
        
        for (let j = 0; j < poll.options.length; j++) {
          const option = poll.options[j]

          
          if (!option.text) {
            throw new Error(`Poll ${i + 1}, Option ${j + 1} is missing text`)
          }
        }
      }

      const tx = new Transaction()

      // Get current timestamp from Clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      // Map to store uploaded blob IDs
      const blobIdMap = new Map<string, string>()

      // Walrus Testnet Package ID - This is the actual package ID for Walrus on Testnet
      const WALRUS_PACKAGE_ID = "0xd12a1773839233ca208d9c956d41e81f0f5f93a2f3384ab3cf8ce916a0e434fa"

      // 1. First, upload all media files using Walrus contracts
      if (Object.keys(mediaFiles).length > 0) {
        for (const [fileId, fileData] of Object.entries(mediaFiles)) {
          // Calculate storage epochs (default is 10 epochs)
          const storageEpochs = 10
          const epochsArg = tx.pure.u64(storageEpochs)

          // Calculate storage size needed
          const encodedLength = tx.pure.u64(fileData.data.length)

          // Determine whether the blob is deletable (true in most cases)
          const deletable = tx.pure.bool(true)

          // Split coins for storage payment - calculate based on size
          const estimatedStorageCost = Math.ceil(fileData.data.length * 10) + 1000 // Simple estimation
          const [storageCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(estimatedStorageCost)])

          // Step 1: Create a new storage object
          const storage = tx.moveCall({
            target: `${WALRUS_PACKAGE_ID}::storage::new_storage`,
            arguments: [
              storageCoin,     // Payment for storage
              encodedLength,   // Size in bytes
              epochsArg,       // Number of epochs to store
              deletable,       // Whether the blob can be deleted
            ],
          })

          // Step 2: Create the blob with the storage
          const blobObj = tx.moveCall({
            target: `${WALRUS_PACKAGE_ID}::storage::create_blob_with_storage`,
            arguments: [
              storage,               // Storage object from previous call
              tx.pure(fileData.data) // The actual binary data
            ],
          })

          // Store placeholder blob ID to reference in media URLs
          blobIdMap.set(fileId, `[BLOB_ID_${fileId}]`)
        }
      }

      // 2. Process poll data with media URLs
      const pollTitles: string[] = []
      const pollDescriptions: string[] = []
      const pollIsMultiSelect: boolean[] = []
      const pollMaxSelections: number[] = []
      const pollIsRequired: boolean[] = []
      const pollOptionCounts: number[] = []
      const pollOptionTexts: string[] = []
      const pollOptionMediaUrls: number[][] = []

      // Process each poll
      for (let pollIndex = 0; pollIndex < pollData.length; pollIndex++) {
        const poll = pollData[pollIndex]
        

        
        pollTitles.push(poll.title || "")
        pollDescriptions.push(poll.description || "")
        pollIsMultiSelect.push(!!poll.isMultiSelect)
        pollIsRequired.push(!!poll.isRequired)
  
        // Handle maxSelections for single/multi-select polls
        const maxSelections = poll.isMultiSelect
          ? Math.min(Math.max(1, poll.maxSelections), poll.options.length - 1)
          : 1
        pollMaxSelections.push(maxSelections)
  
        // Record option count for this poll
        pollOptionCounts.push(poll.options.length)
  
        // Process options for this poll in strict sequential order

        for (let optionIndex = 0; optionIndex < poll.options.length; optionIndex++) {
          const option = poll.options[optionIndex]
          

          
          pollOptionTexts.push(option.text || "")
  
          // Convert media URL to bytes (empty array if none)
          if (option.mediaUrl) {
            const mediaUrlBytes = new TextEncoder().encode(option.mediaUrl)
            pollOptionMediaUrls.push(Array.from(mediaUrlBytes))
          } else {
            pollOptionMediaUrls.push([])
          }
        }
      }

      // Convert token requirement to bytes
      const tokenRequirementBytes = requiredToken
        ? Array.from(new TextEncoder().encode(requiredToken))
        : []

      // Convert token amounts to decimal units before sending to contract
      let convertedRequiredAmount = requiredAmount
      let convertedTokensPerVote = tokensPerVote
      
      console.log(`[DEBUG] Vote with media creation - Original values:`, {
        requiredToken,
        requiredAmount,
        tokensPerVote,
        paymentAmount,
        useTokenWeighting
      })
      
      if (requiredToken && requiredAmount > 0) {
        try {
          // Get token info to determine decimals
          const tokenInfo = await tokenService.getTokenInfo(requiredToken)
          if (tokenInfo && tokenInfo.decimals !== undefined) {
            console.log(`[DEBUG] Converting token amounts - Token: ${requiredToken}, Decimals: ${tokenInfo.decimals}`)
            
            convertedRequiredAmount = parseInt(toDecimalUnits(requiredAmount.toString(), tokenInfo.decimals))
            console.log(`[DEBUG] Required amount conversion: ${requiredAmount} -> ${convertedRequiredAmount}`)
            
            if (useTokenWeighting && tokensPerVote > 0) {
              convertedTokensPerVote = parseInt(toDecimalUnits(tokensPerVote.toString(), tokenInfo.decimals))
              console.log(`[DEBUG] Tokens per vote conversion: ${tokensPerVote} -> ${convertedTokensPerVote}`)
            }
          }
        } catch (error) {
          console.error('[DEBUG] Failed to convert token amounts to decimal units:', error)
          // Continue with original values if conversion fails
        }
      }
      
      // Convert payment amount from SUI to MIST
      const suiDecimals = tokenService.getSuiTokenInfo().decimals
      const convertedPaymentAmount = parseInt(toDecimalUnits(paymentAmount.toString(), suiDecimals))
      console.log(`[DEBUG] Payment amount conversion: ${paymentAmount} SUI -> ${convertedPaymentAmount} MIST (decimals: ${suiDecimals})`)
      
      // Handle voter weights: if empty but whitelist addresses exist, generate default weights of 1
      let finalVoterWeights = voterWeights
      if (whitelistAddresses.length > 0 && voterWeights.length === 0) {
        finalVoterWeights = whitelistAddresses.map(() => 1) // Default weight of 1 for basic whitelist
        console.log(`[DEBUG] Generated default voter weights for ${whitelistAddresses.length} whitelist addresses`)
      }
      
      // Validate whitelist addresses and voter weights arrays match
      if (whitelistAddresses.length !== finalVoterWeights.length) {
        throw new Error(`Whitelist addresses (${whitelistAddresses.length}) and voter weights (${finalVoterWeights.length}) arrays must have the same length`)
      }
      
      // Ensure voterWeights are properly converted to numbers
      const numericVoterWeights = finalVoterWeights.map(weight => {
        const numWeight = typeof weight === 'string' ? Number(weight) : Number(weight)
        if (isNaN(numWeight) || numWeight <= 0) {
          throw new Error(`Invalid voter weight: ${weight}. All voter weights must be valid positive numbers.`)
        }
        return numWeight
      })
      
      console.log(`[DEBUG] Final converted values for contract:`, {
        convertedRequiredAmount,
        convertedTokensPerVote,
        convertedPaymentAmount,
        originalVoterWeights: voterWeights,
        finalVoterWeights: finalVoterWeights,
        numericVoterWeights: numericVoterWeights
      })

      // 3. Create the vote using the actual SuiVote package ID
      const voteObj = tx.moveCall({
        target: `${PACKAGE_ID}::voting::create_complete_vote`,
        arguments: [
          tx.pure.string(title),
          tx.pure.string(description),
          tx.pure.u64(startTimestamp),
          tx.pure.u64(endTimestamp),
          tx.pure.u64(convertedPaymentAmount), // Use converted MIST amount
          tx.pure.bool(requireAllPolls),
          tx.pure.string(requiredToken),  
          tx.pure.u64(convertedRequiredAmount),     
          tx.pure.bool(showLiveStats),
          tx.pure.bool(useTokenWeighting),
          tx.pure.u64(convertedTokensPerVote),
          tx.pure.bool(usePaymentWeighting), // Add missing payment weighting parameter
          tx.pure.vector("u64", numericVoterWeights), // voter_weights must be 14th parameter
          tx.pure.vector("string", pollTitles),
          tx.pure.vector("string", pollDescriptions),
          tx.pure.vector("bool", pollIsMultiSelect),
          tx.pure.vector("u64", pollMaxSelections),
          tx.pure.vector("bool", pollIsRequired),
          tx.pure.vector("u64", pollOptionCounts),
          tx.pure.vector("string", pollOptionTexts),
          tx.pure.vector("vector<u8>", pollOptionMediaUrls),
          tx.pure.vector("address", whitelistAddresses),
          clockObj,
        ],
      })

      // Return created vote object to the sender
      tx.transferObjects([voteObj], tx.pure.address("$SENDER"))

      return tx
    } catch (error) {
      console.error("Failed to create vote with media transaction:", error)
      throw new Error(
        `Failed to create vote with media: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Check if a voter is whitelisted for a vote
   * @param voteId Vote object ID
   * @param voterAddress Voter address
   * @returns Boolean indicating if the voter is whitelisted
   */
  async isVoterWhitelisted(voteId: string, voterAddress: string): Promise<boolean> {
    try {
      this.checkInitialization()

      if (!voteId || !voterAddress) {
        return false
      }

      // First get the vote details to check if it has a whitelist
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails) return false

      // If the vote doesn't have a whitelist, everyone is allowed
      if (!voteDetails.hasWhitelist) {
        return true
      }

      // Check if the address is in the whitelist by checking if the dynamic field exists
      try {
        const response = await this.client.getDynamicFieldObject({
          parentId: voteId,
          name: {
            type: "address",
            value: voterAddress,
          },
        })

        // If the field exists, the voter is whitelisted
        return !!response.data
      } catch (error) {
        console.error(`Failed to check whitelist status for ${voterAddress}:`, error)
        return false
      }
    } catch (error) {
      console.error(`Failed to check if voter is whitelisted:`, error)
      return false
    }
  }

  /**
   * Create a transaction to add allowed voters to a whitelist
   * @param voteId Vote object ID
   * @param voterAddresses Array of voter addresses to add to the whitelist
   * @returns Transaction to be signed
   */
  addAllowedVotersTransaction(voteId: string, voterAddresses: string[]): Transaction {
    try {
      this.checkInitialization()

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      if (!voterAddresses || !Array.isArray(voterAddresses) || voterAddresses.length === 0) {
        throw new Error("At least one voter address must be provided")
      }

      // Validate addresses
      for (const address of voterAddresses) {
        if (!address) {
          throw new Error("Invalid voter address")
        }
      }

      const tx = new Transaction()

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      // Convert addresses to Sui address objects
      const addressObjects = voterAddresses.map(addr => tx.pure.address(addr))

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::add_allowed_voters`,
        arguments: [
          tx.object(voteId),
          tx.pure.vector("address", voterAddresses),
          clockObj,
        ],
      })

      return tx
    } catch (error) {
      console.error(`Failed to create add allowed voters transaction:`, error)
      throw new Error(`Failed to add allowed voters: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Get the whitelisted voters for a vote by querying the dynamic fields
   * @param voteId Vote object ID
   * @returns Array of whitelisted voter addresses
   */
  async getWhitelistedVoters(voteId: string): Promise<string[]> {
    try {
      this.checkInitialization()

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      // First check if the vote has a whitelist
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails || !voteDetails.hasWhitelist) {
        return []
      }

      // We need to check VoterWhitelisted events since dynamic field queries 
      // can't be easily filtered by type
      const whitelistedVoters: string[] = []

      // Query for VoterWhitelisted events
      const { data } = await this.retryRequest(async () => {
        return await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::voting::VoterWhitelisted`
          },
          limit: 1000, // Using a higher limit to get all events
        })
      })

      // Filter events for the specific vote
      const filteredEvents = data.filter(event => {
        if (!event.parsedJson) return false
        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        return whitelistEvent.vote_id === voteId
      })

      // Extract voter addresses without duplicates
      const voterSet = new Set<string>()
      for (const event of filteredEvents) {
        if (!event.parsedJson) continue
        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        voterSet.add(whitelistEvent.voter_address)
      }

      return Array.from(voterSet)
    } catch (error) {
      console.error(`Failed to get whitelisted voters:`, error)
      return []
    }
  }

  /**
   * Get the whitelist weight for a specific voter
   * @param voteId The vote ID
   * @param voterAddress The voter's address
   * @returns The voter's whitelist weight (0 if not whitelisted, 1+ if whitelisted)
   */
  async getWhitelistWeight(voteId: string, voterAddress: string): Promise<number> {
    try {
      this.checkInitialization()

      if (!voteId || !voterAddress) {
        throw new Error("Vote ID and voter address are required")
      }

      // First check if the vote has a whitelist
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails || !voteDetails.hasWhitelist) {
        return 1 // No whitelist means everyone has weight 1
      }

      // Check if the voter is whitelisted
      const isWhitelisted = await this.isVoterWhitelisted(voteId, voterAddress)
      if (!isWhitelisted) {
        return 0 // Not whitelisted
      }

      // Try to get the WhitelistEntry with weight (for version 2+)
      try {
        const dynamicField = await this.retryRequest(async () => {
          return await this.client.getDynamicFieldObject({
            parentId: voteId,
            name: {
              type: "address",
              value: voterAddress
            }
          })
        })

        if (dynamicField.data?.content?.dataType === "moveObject") {
          const fields = (dynamicField.data.content as any).fields
          if (fields && fields.value && typeof fields.value.weight === "string") {
            return parseInt(fields.value.weight)
          }
        }
      } catch (error) {
        // If we can't get the WhitelistEntry, fall back to legacy behavior
        console.log(`Could not get whitelist weight for ${voterAddress}, using default weight 1`)
      }

      // Default weight for legacy entries or if we can't determine the weight
      return 1
    } catch (error) {
      console.error(`Failed to get whitelist weight for ${voterAddress}:`, error)
      return 0
    }
  }

  /**
   * Get votes where a user is whitelisted
   * @param address User address
   * @param limit Maximum number of votes to return
   * @param cursor Pagination cursor
   * @returns Array of vote details with pagination cursor
   */
  async getVotesWhitelistedForAddress(
    address: string,
    limit = 20,
    cursor?: string,
  ): Promise<{ data: VoteDetails[]; nextCursor?: string }> {
    try {
      this.checkInitialization()

      if (!address) {
        throw new Error("Address is required")
      }

      // Query for VoterWhitelisted events using MoveEventType filter
      const eventsResponse = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoterWhitelisted`
        },
        cursor: cursor as any,
        limit: 100, // Using a higher limit initially since we'll filter manually
        order: "descending", // Get most recent first
      })

      // Manually filter the events for voter_address = address
      const filteredEvents = eventsResponse.data.filter(event => {
        if (!event.parsedJson) return false
        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        return whitelistEvent.voter_address === address
      })

      // Process events to extract unique vote IDs
      const voteIds = new Set<string>()
      for (const event of filteredEvents) {
        if (!event.parsedJson) continue

        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        voteIds.add(whitelistEvent.vote_id)
      }

      // Fetch details for each unique vote in parallel
      const votesPromises = Array.from(voteIds).map((voteId) => this.getVoteDetails(voteId))
      const votesResults = await Promise.all(votesPromises)

      // Filter out null results and respect the limit
      const votes = votesResults.filter(Boolean) as VoteDetails[]
      const limitedVotes = votes.slice(0, limit)


      return {
        data: limitedVotes,
        nextCursor: eventsResponse.nextCursor as string | undefined,
      }
    } catch (error) {
      console.error("Failed to fetch whitelisted votes:", error)
      throw new Error(`Failed to fetch whitelisted votes: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Cast a vote on a poll
   * @param voteId Vote object ID
   * @param pollIndex Poll index (1-based)
   * @param optionIndices Selected option indices (1-based)
   * @param payment SUI payment amount (if required)
   * @returns Transaction to be signed
   */
  async castVoteTransaction(voteId: string, pollIndex: number, optionIndices: number[],tokenBalance: number = 0, payment = 0): Promise<Transaction> {
    try {
      this.checkInitialization()

      // Validate inputs
      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      if (pollIndex < 1) {
        throw new Error("Poll index must be 1 or greater")
      }

      if (!optionIndices || !Array.isArray(optionIndices) || optionIndices.length === 0) {
        throw new Error("At least one option index must be selected")
      }

      if (payment < 0) {
        throw new Error("Payment amount must be non-negative")
      }

      // Get vote details to check payment weighting requirements
      const vote = await this.getVoteDetails(voteId)
      
      // Token balance is already in base units from checkTokenBalance
      let convertedTokenBalance = tokenBalance

      console.log(`[Transaction Debug] castVoteTransaction inputs:`, {
        voteId,
        pollIndex,
        optionIndices,
        tokenBalance,
        convertedTokenBalance,
        payment,
        usePaymentWeighting: vote.usePaymentWeighting,
        tokensPerVote: vote.tokensPerVote
      });

      // Convert payment amount from SUI to MIST
      let convertedPaymentAmount = 0
      if (payment > 0) {
        const suiDecimals = tokenService.getSuiTokenInfo().decimals
        convertedPaymentAmount = parseInt(toDecimalUnits(payment.toString(), suiDecimals))
        console.log(`[DEBUG] Payment amount conversion: ${payment} SUI -> ${convertedPaymentAmount} MIST (decimals: ${suiDecimals})`)
      }
      
      // For payment weighting, ensure minimum payment is met
      if (vote.usePaymentWeighting && vote.tokensPerVote && parseFloat(vote.tokensPerVote) > 0) {
        const minimumPaymentMist = parseFloat(vote.tokensPerVote) // Convert string to number
        if (convertedPaymentAmount < minimumPaymentMist) {
          convertedPaymentAmount = minimumPaymentMist
          console.log(`[DEBUG] Payment weighting: Using minimum payment ${minimumPaymentMist} MIST (${fromDecimalUnits(minimumPaymentMist.toString(), 9)} SUI)`)
        }
      }

      const tx = new Transaction()

      // Create payment coin if needed
      let paymentCoin
      if (convertedPaymentAmount > 0) {
        // Split payment from gas coin
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(convertedPaymentAmount)])
      } else {
        // Create an empty coin if no payment is required
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)])
      }

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      console.log(`[Transaction Debug] Move call arguments:`, {
        voteId,
        adminId: ADMIN_ID,
        pollIndex,
        tokenBalance: convertedTokenBalance,
        optionIndices,
        paymentAmount: convertedPaymentAmount
      });

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cast_vote`,
        arguments: [
          tx.object(voteId),
          tx.object(ADMIN_ID),
          tx.pure.u64(pollIndex),
          tx.pure.u64(convertedTokenBalance),
          tx.pure.vector("u64", optionIndices),
          paymentCoin,
          clockObj,
        ],
      })

      return tx
    } catch (error) {
      console.error(`Failed to create cast vote transaction:`, error)
      throw new Error(`Failed to cast vote: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  
/**
 * Cast votes on multiple polls at once
 * @param voteId Vote object ID
 * @param pollIndices Poll indices (1-based)
 * @param optionIndicesPerPoll Selected option indices for each poll (1-based)
 * @param tokenBalance Token balance for weighted voting
 * @param payment SUI payment amount (if required)
 * @returns Transaction to be signed
 */
async castMultipleVotesTransaction(
  voteId: string,
  pollIndices: number[],
  optionIndicesPerPoll: number[][],
  tokenBalance: number = 0,
  payment = 0,
): Promise<Transaction> {
  try {
    this.checkInitialization()

    // Validate inputs
    if (!voteId) {
      throw new Error("Vote ID is required")
    }

    if (!pollIndices || !Array.isArray(pollIndices) || pollIndices.length === 0) {
      throw new Error("At least one poll index must be specified")
    }

    if (!optionIndicesPerPoll || !Array.isArray(optionIndicesPerPoll) || optionIndicesPerPoll.length === 0) {
      throw new Error("Option indices for each poll must be provided")
    }

    if (pollIndices.length !== optionIndicesPerPoll.length) {
      throw new Error("Number of poll indices must match number of option index arrays")
    }

    // Enhanced validation
    for (let i = 0; i < pollIndices.length; i++) {
      if (pollIndices[i] < 1) {
        throw new Error(`Poll index at position ${i} must be 1 or greater`)
      }

      if (
        !optionIndicesPerPoll[i] ||
        !Array.isArray(optionIndicesPerPoll[i]) ||
        optionIndicesPerPoll[i].length === 0
      ) {
        throw new Error(`At least one option must be selected for poll index ${pollIndices[i]}`)
      }
      
      // Make sure option indices are valid
      for (let j = 0; j < optionIndicesPerPoll[i].length; j++) {
        if (optionIndicesPerPoll[i][j] < 1) {
          throw new Error(`Option index must be 1 or greater for poll ${pollIndices[i]}`)
        }
      }
      
      // Ensure no duplicate option indices for the same poll
      const uniqueOptionIndices = new Set(optionIndicesPerPoll[i])
      if (uniqueOptionIndices.size !== optionIndicesPerPoll[i].length) {
        throw new Error(`Duplicate option indices for poll ${pollIndices[i]} are not allowed`)
      }
    }

    if (payment < 0) {
      throw new Error("Payment amount must be non-negative")
    }

    // Get vote details to check payment weighting requirements
    const vote = await this.getVoteDetails(voteId)

    // Token balance is already in base units from checkTokenBalance
    let convertedTokenBalance = tokenBalance;

    // Set a default token balance if none provided
    if (convertedTokenBalance <= 0) {
      // Use a reasonable default value (the contract will check actual balance)
      convertedTokenBalance = 1;
    }

    // Convert payment amount from SUI to MIST
    let convertedPaymentAmount = 0
    if (payment > 0) {
      const suiDecimals = tokenService.getSuiTokenInfo().decimals
      convertedPaymentAmount = parseInt(toDecimalUnits(payment.toString(), suiDecimals))
      console.log(`[DEBUG] Payment amount conversion: ${payment} SUI -> ${convertedPaymentAmount} MIST (decimals: ${suiDecimals})`)
    }
    
    // For payment weighting, ensure minimum payment is met
    if (vote.usePaymentWeighting && vote.tokensPerVote && parseFloat(vote.tokensPerVote) > 0) {
      const minimumPaymentMist = parseFloat(vote.tokensPerVote) // Convert string to number
      if (convertedPaymentAmount < minimumPaymentMist) {
        convertedPaymentAmount = minimumPaymentMist
        console.log(`[DEBUG] Payment weighting: Using minimum payment ${minimumPaymentMist} MIST (${fromDecimalUnits(minimumPaymentMist.toString(), 9)} SUI)`)
      }
    }

    const tx = new Transaction()

    // Create payment coin if needed
    let paymentCoin
    if (convertedPaymentAmount > 0) {
      // Split payment from gas coin
      ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(convertedPaymentAmount)])
    } else {
      // Create an empty coin if no payment is required
      ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)])
    }

    // Get the clock object
    const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)
    
    // Log the data being sent to the transaction for debugging


    tx.moveCall({
      target: `${PACKAGE_ID}::voting::cast_multiple_votes`,
      arguments: [
        tx.object(voteId),
        tx.object(ADMIN_ID),
        tx.pure.vector("u64", pollIndices),
        tx.pure.vector("vector<u64>", optionIndicesPerPoll),
        tx.pure.u64(convertedTokenBalance),
        paymentCoin,
        clockObj,
      ],
    })

    return tx
  } catch (error) {
    console.error(`Failed to create cast multiple votes transaction:`, error)
    throw new Error(`Failed to cast multiple votes: ${error instanceof Error ? error.message : String(error)}`)
  }
}

    calculateVoteWeight(tokenBalance: number, tokensPerVote: number, minimumTokenAmount: number = 0): number {
    if (tokenBalance <= 0 || tokensPerVote <= 0) {
      return 1; // Default weight
    }
    
    const weight = Math.floor(tokenBalance / tokensPerVote);
    
    // Ensure minimum weight is 1 if they meet the minimum token requirement
    if (weight === 0 && minimumTokenAmount > 0 && tokenBalance >= minimumTokenAmount) {
      return 1;
    }
    
    return Math.max(weight, 0);
  }


  /**
   * Close a vote (can be called by creator or after end time)
   * @param voteId Vote object ID
   * @returns Transaction to be signed
   */
  closeVoteTransaction(voteId: string): Transaction {
    try {
      this.checkInitialization()

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const tx = new Transaction()

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::close_vote`,
        arguments: [tx.object(voteId), clockObj],
      })

      return tx
    } catch (error) {
      console.error(`Failed to create close vote transaction:`, error)
      throw new Error(`Failed to close vote: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Cancel a vote (only by creator, only before start)
   * @param voteId Vote object ID
   * @returns Transaction to be signed
   */
  cancelVoteTransaction(voteId: string): Transaction {
    try {
      this.checkInitialization()

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const tx = new Transaction()

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cancel_vote`,
        arguments: [tx.object(voteId), clockObj],
      })

      return tx
    } catch (error) {
      console.error(`Failed to create cancel vote transaction:`, error)
      throw new Error(`Failed to cancel vote: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Extend voting period (only by creator)
   * @param voteId Vote object ID
   * @param newEndTimestamp New end timestamp in milliseconds
   * @returns Transaction to be signed
   */
  extendVotingPeriodTransaction(voteId: string, newEndTimestamp: number): Transaction {
    try {
      this.checkInitialization()

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      if (!newEndTimestamp || newEndTimestamp <= Date.now()) {
        throw new Error("New end timestamp must be in the future")
      }

      const tx = new Transaction()

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::extend_voting_period`,
        arguments: [tx.object(voteId), tx.pure.u64(newEndTimestamp), clockObj],
      })

      return tx
    } catch (error) {
      console.error(`Failed to create extend voting period transaction:`, error)
      throw new Error(`Failed to extend voting period: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Note: Votes automatically become active based on their start timestamp.
   * No manual transaction is needed to start a vote - the Move contract
   * checks timestamps during vote casting operations.
   * This method is deprecated and should not be used.
   * @deprecated Votes are time-based and start automatically
   */
  startVoteTransaction(voteId: string): Transaction {
    throw new Error("Vote starting is automatic based on timestamps. No manual transaction needed.")
  }

  /**
 * Check if a user has voted on a specific vote (with caching)
 * @param userAddress User address
 * @param voteId Vote object ID
 * @returns Boolean indicating whether the user has voted
 */
  async hasVoted(userAddress: string, voteId: string): Promise<boolean> {
    try {
      this.checkInitialization()

      if (!userAddress) {
        throw new Error("User address is required")
      }

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      // Check cache first
      const cacheKey = `${userAddress}:${voteId}`
      const cached = this.voteStatusCache.get(cacheKey)
      
      if (cached && Date.now() - cached.timestamp < this.VOTE_STATUS_CACHE_TTL) {
        return cached.hasVoted
      }

      // Query for VoteCast events using MoveEventType filter
      // Order by descending to get most recent events first
      const { data } = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
        },
        limit: 200, // Increased limit to catch more recent votes
        order: 'descending' // Get most recent events first
      })

      // Manually filter for both voter and vote_id
      const hasVoted = data.some(event => {
        if (!event.parsedJson) return false

        const voteCastEvent = event.parsedJson as VoteCastEvent
        return voteCastEvent.voter === userAddress && voteCastEvent.vote_id === voteId
      })

      // Cache the result
      this.voteStatusCache.set(cacheKey, { hasVoted, timestamp: Date.now() })

      return hasVoted
    } catch (error) {
      return false
    }
  }

  /**
   * Batch check vote status for multiple votes (performance optimization)
   * @param userAddress User address
   * @param voteIds Array of vote IDs to check
   * @returns Map of vote ID to voting status
   */
  async batchCheckVoteStatus(userAddress: string, voteIds: string[]): Promise<Map<string, boolean>> {
    try {
      this.checkInitialization()

      if (!userAddress || !voteIds.length) {
        return new Map()
      }

      const results = new Map<string, boolean>()
      const uncachedVoteIds: string[] = []

      // Check cache first for all vote IDs
      for (const voteId of voteIds) {
        const cacheKey = `${userAddress}:${voteId}`
        const cached = this.voteStatusCache.get(cacheKey)
        
        if (cached && Date.now() - cached.timestamp < this.VOTE_STATUS_CACHE_TTL) {
          results.set(voteId, cached.hasVoted)
        } else {
          uncachedVoteIds.push(voteId)
        }
      }

      // If all results are cached, return early
      if (uncachedVoteIds.length === 0) {
        return results
      }

      // Query all VoteCast events once for uncached votes
      const { data } = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
        },
        limit: 500, // Increased limit for batch processing
        order: 'descending'
      })

      // Create a set of vote IDs that the user has voted on
      const userVotes = new Set<string>()
      data.forEach(event => {
        if (event.parsedJson) {
          const voteCastEvent = event.parsedJson as VoteCastEvent
          if (voteCastEvent.voter === userAddress) {
            userVotes.add(voteCastEvent.vote_id)
          }
        }
      })

      // Process uncached vote IDs
      for (const voteId of uncachedVoteIds) {
        const hasVoted = userVotes.has(voteId)
        results.set(voteId, hasVoted)
        
        // Cache the result
        const cacheKey = `${userAddress}:${voteId}`
        this.voteStatusCache.set(cacheKey, { hasVoted, timestamp: Date.now() })
      }

      return results
    } catch (error) {
      console.error('Batch vote status check failed:', error)
      // Return empty results for uncached votes on error
      const results = new Map<string, boolean>()
      for (const voteId of voteIds) {
        const cacheKey = `${userAddress}:${voteId}`
        const cached = this.voteStatusCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < this.VOTE_STATUS_CACHE_TTL) {
          results.set(voteId, cached.hasVoted)
        } else {
          results.set(voteId, false) // Default to false on error
        }
      }
      return results
    }
  }

  /**
   * Get vote results if available
   * @param voteId Vote object ID
   * @returns Vote results or null if not available
   */
  async getVoteResults(voteId: string): Promise<Record<string, PollOptionDetails[]> | null> {
    try {
      this.checkInitialization()

      if (!voteId) {
        console.warn("Empty voteId provided to getVoteResults")
        return null
      }

      // First check if vote is closed
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails) return null

      // Only return results if vote is closed or is active
      if (voteDetails.status !== "closed" && voteDetails.status !== "active") {
        return null
      }

      // Get all polls first
      const polls = await this.getVotePolls(voteId)
      if (!polls || polls.length === 0) return null

      // Fetch options for each poll in parallel
      const pollOptionsPromises: Array<Promise<{ pollId: string; options: PollOptionDetails[] }>> = []

      for (let i = 0; i < polls.length; i++) {
        const pollIndex = i + 1 // Polls are 1-indexed
        pollOptionsPromises.push(
          (async () => {
            const options = await this.getPollOptions(voteId, pollIndex)
            return {
              pollId: polls[i].id,
              options: options || [],
            }
          })(),
        )
      }

      const pollOptionsResults = await Promise.all(pollOptionsPromises)

      // Combine results into a record
      const results: Record<string, PollOptionDetails[]> = {}
      for (const { pollId, options } of pollOptionsResults) {
        if (options.length > 0) {
          results[pollId] = options
        }
      }
      return results
    } catch (error) {
      return null
    }
  }

  /**
   * Get all voters and their voting information for a specific vote with timestamps
   * @param voteId The vote object ID
   * @returns Array of voter information objects with timestamps
   */
  async getVotersForVote(voteId: string): Promise<VoterInfo[]> {
    try {
      console.log('🔍 SuiVoteService.getVotersForVote called for voteId:', voteId);
      this.checkInitialization();

      if (!voteId) {
        throw new Error("Vote ID is required");
      }

      const voterMap = new Map<string, VoterInfo>();
      let cursor: string | null = null;
      let hasNextPage = true;
      let pageCount = 0;
      let totalEvents = 0;
      let relevantEvents = 0;

      console.log('📡 Starting to query VoteCast events...');

      let previousCursor: string | null = null;
      
      while (hasNextPage) {
        pageCount++;
        console.log(`📄 Querying page ${pageCount} with cursor:`, cursor);
        
        // Check for cursor loop - if cursor hasn't changed, break
        if (cursor && cursor === previousCursor) {
          console.warn('⚠️ Cursor loop detected, stopping pagination');
          break;
        }
        
        // Check for empty results with same cursor multiple times
        if (pageCount > 2 && cursor === previousCursor) {
          console.warn('⚠️ Same cursor returned multiple times, stopping pagination');
          break;
        }
        
        previousCursor = cursor;
        
        const response = await this.retryRequest(async () => {
          return await this.client.queryEvents({
            query: {
              MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
            },
            cursor: cursor as any,
            limit: 100,
            order: "ascending",
          });
        });

        console.log(`✅ Page ${pageCount} returned ${response.data.length} events`);
        totalEvents += response.data.length;
        
        // If we get 0 events and have a cursor, it might be a pagination issue
        if (response.data.length === 0 && cursor) {
          console.warn(`⚠️ Page ${pageCount} returned 0 events with cursor, this might indicate pagination issues`);
          // Allow a few empty pages but not too many
          if (pageCount > 5) {
            console.warn('⚠️ Too many empty pages, stopping pagination');
            break;
          }
        }

        for (const event of response.data) {
          if (!event.parsedJson) continue;
          
          const voteCast = event.parsedJson as VoteCastEvent;
          
          // Only process events for this vote
          if (voteCast.vote_id !== voteId) continue;

          relevantEvents++;
          console.log(`🎯 Found relevant vote cast event ${relevantEvents} for voter:`, voteCast.voter);

          // Get timestamp from event (convert string to number)
          const timestamp = Number(event.timestampMs);
          
          let voterInfo = voterMap.get(voteCast.voter);
          
          if (!voterInfo) {
            // Convert token amounts using CoinConverter
            const tokenBalance = await this.coinConverter.fromContractUnits(
              voteCast.token_balance || '0',
              'SUI' // Default to SUI since token_type is not available in VoteCastEvent
            );
            const voteWeight = await this.coinConverter.fromContractUnits(
              voteCast.vote_weight || '0',
              'SUI' // Default to SUI since token_type is not available in VoteCastEvent
            );
            
            voterInfo = {
              voter: voteCast.voter,
              tokenBalance: tokenBalance,
              voteWeight: voteWeight,
              timestamp: timestamp, // Store timestamp
              polls: [],
              // Store raw values for internal use
              _rawTokenBalance: voteCast.token_balance || '0',
              _rawVoteWeight: voteCast.vote_weight || '0'
            };
            voterMap.set(voteCast.voter, voterInfo);
          }

          voterInfo.polls.push({
            pollId: voteCast.poll_id,
            optionIndices: voteCast.option_indices
          });
        }

        const newCursor = response.nextCursor as string | null;
        hasNextPage = !!newCursor;
        
        console.log(`📊 Page ${pageCount} summary: ${response.data.length} events, ${relevantEvents} relevant so far, hasNextPage: ${hasNextPage}`);
        
        // Update cursor for next iteration
        cursor = newCursor;
        
        // Add safety limit to prevent infinite loops
         if (pageCount > 20) {
           console.warn('⚠️ Reached maximum page limit (20), stopping pagination');
           break;
         }
       }

       console.log(`🏁 Pagination completed. Total pages: ${pageCount}, Total events: ${totalEvents}, Relevant events: ${relevantEvents}`);
       const result = Array.from(voterMap.values());
       console.log(`✅ Returning ${result.length} unique voters`);
       return result;
    } catch (error) {
      console.error(`Failed to get voters for vote ${voteId}:`, error);
      throw new Error(
        `Failed to get voters: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
 * Check if a user has the required token balance and return the actual balance
 * @param userAddress User address
 * @param tokenType Token type (e.g., "0x2::sui::SUI" or a custom token)
 * @param requiredAmount Minimum amount required
 * @returns Object with hasBalance (boolean) and tokenBalance (number)
 */
  async checkTokenBalance(userAddress: string, tokenType: string, requiredAmount: string): Promise<{ hasBalance: boolean; tokenBalance: number }> {
    try {
      this.checkInitialization();

      console.log("[Token Debug] checkTokenBalance called with:", {
        userAddress,
        tokenType,
        requiredAmount
      });

      // Return default values if no token requirement or required amount is zero
      if (!tokenType || !requiredAmount) {
        console.log("[Token Debug] No token requirement, returning default");
        return { hasBalance: true, tokenBalance: 0 };
      }
      if (requiredAmount === "0") {
        console.log("[Token Debug] Required amount is 0, returning default");
        return { hasBalance: true, tokenBalance: 0 };
      }

      if (!userAddress) {
        console.log("[Token Debug] No user address, returning false");
        return { hasBalance: false, tokenBalance: 0 };
      }

      // Fetch user's balance in base units
      const { totalBalance } = await this.client.getBalance({
        owner: userAddress,
        coinType: tokenType,
      });

      console.log("[Token Debug] Raw balance from blockchain:", {
        totalBalance,
        type: typeof totalBalance
      });

      if (!totalBalance) {
        console.log("[Token Debug] No balance found, returning false");
        return { hasBalance: false, tokenBalance: 0 };
      }

      // Get token decimals
      let decimals = 9; // Default for SUI
      try {
        const metadata = await this.client.getCoinMetadata({ coinType: tokenType });
        if (metadata?.decimals !== undefined) decimals = metadata.decimals;
      } catch (error) {
        console.warn(`Using default decimals for ${tokenType}: ${decimals}`);
      }

      console.log("[Token Debug] Token decimals:", decimals);

      // Parse required amount into base units (ensure it's a string)
      const requiredAmountStr = String(requiredAmount);
      const requiredBase = this.parseToBaseUnits(requiredAmountStr, decimals);
      const userBalance = BigInt(totalBalance);
      
      console.log("[Token Debug] Balance comparison:", {
         userBalanceString: totalBalance,
         userBalanceBigInt: userBalance.toString(),
         requiredAmountOriginal: requiredAmount,
         requiredAmountString: requiredAmountStr,
         requiredBaseBigInt: requiredBase.toString(),
         hasBalance: userBalance >= requiredBase
       });
      
      const finalTokenBalance = Number(userBalance.toString());
      
      console.log("[Token Debug] Final result:", {
        hasBalance: userBalance >= requiredBase,
        tokenBalance: finalTokenBalance,
        tokenBalanceType: typeof finalTokenBalance
      });
      
      // Return balance in base units (not human-readable format)
      // This ensures the contract receives the expected integer value
      return { 
        hasBalance: userBalance >= requiredBase,
        tokenBalance: finalTokenBalance
      };
    } catch (error) {
      console.error("checkTokenBalance error:", error instanceof Error ? error.message : String(error));
      return { hasBalance: false, tokenBalance: 0 };
    }
  }

  /**
   * Get SUI balance for a user address
   * @param userAddress User address
   * @returns SUI balance in base units (MIST)
   */
  async getSuiBalance(userAddress: string): Promise<number> {
    try {
      this.checkInitialization();

      if (!userAddress) {
        return 0;
      }

      // Add retry logic for rate limiting
      let retries = 0;
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      while (retries < maxRetries) {
        try {
          const { totalBalance } = await this.client.getBalance({
            owner: userAddress,
            coinType: "0x2::sui::SUI",
          });

          return totalBalance ? Number(totalBalance) : 0;
        } catch (fetchError: any) {
          // Check if it's a rate limiting error
          if (fetchError?.message?.includes('429') || 
              fetchError?.message?.includes('Too Many Requests') ||
              fetchError?.message?.includes('Failed to fetch')) {
            retries++;
            if (retries < maxRetries) {
              const delay = baseDelay * Math.pow(2, retries - 1); // Exponential backoff
              console.warn(`Rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          throw fetchError;
        }
      }

      throw new Error('Max retries exceeded for getSuiBalance');
    } catch (error) {
      console.error("getSuiBalance error:", error instanceof Error ? error.message : String(error));
      // Return 0 instead of throwing to prevent UI crashes
      return 0;
    }
  }

  private parseToBaseUnits(amountStr: string, decimals: number): bigint {
    const [integerPart, fractionalPart = '0'] = amountStr.split('.');
    
    // Pad fractional part to 'decimals' digits and truncate excess
    const fractionalPadded = fractionalPart
      .padEnd(decimals, '0')
      .slice(0, decimals);

    // Combine integer and fractional parts
    const fullNumberStr = integerPart + fractionalPadded;

    // Handle empty integer part (e.g., ".5")
    if (fullNumberStr === '') return BigInt(0);

    return BigInt(fullNumberStr);
  }

  /**
   * Clear cache for a specific vote (useful when vote is updated)
   * @param voteId Vote ID to clear from cache
   */
  clearVoteCache(voteId: string): void {
    this.voteDetailsCache.delete(voteId)
    // Clear all vote status cache entries for this vote
    for (const [key] of this.voteStatusCache) {
      if (key.endsWith(`:${voteId}`)) {
        this.voteStatusCache.delete(key)
      }
    }
  }

  /**
   * Clear all caches (useful for logout or data refresh)
   */
  clearAllCaches(): void {
    this.voteDetailsCache.clear()
    this.voteStatusCache.clear()
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCaches(): void {
    const now = Date.now()
    
    // Clear expired vote details cache
    for (const [key, value] of this.voteDetailsCache) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.voteDetailsCache.delete(key)
      }
    }
    
    // Clear expired vote status cache
    for (const [key, value] of this.voteStatusCache) {
      if (now - value.timestamp > this.VOTE_STATUS_CACHE_TTL) {
        this.voteStatusCache.delete(key)
      }
    }
  }

}

// Create a singleton instance
const suivoteService = new SuiVoteService()

// Export standalone function for getWhitelistWeight
export const getWhitelistWeight = async (voteId: string, voterAddress: string): Promise<number> => {
  return await suivoteService.getWhitelistWeight(voteId, voterAddress)
}