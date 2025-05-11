import { SuiClient, getFullnodeUrl } from "@mysten/sui/client"
import { Transaction } from "@mysten/sui/transactions"
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils"

// Constants from configuration
const PACKAGE_ID = process.env.NEXT_PUBLIC_SUIVOTE_PACKAGE_ID || ""
const ADMIN_ID = process.env.NEXT_PUBLIC_SUIVOTE_ADMIN_ID || ""

/**
 * Vote details interface
 */
export interface VoteDetails {
  id: string
  creator: string
  title: string
  description: string
  startTimestamp: number
  endTimestamp: number
  paymentAmount: number
  requireAllPolls: boolean
  pollsCount: number
  totalVotes: number
  isCancelled: boolean
  status: "active" | "pending" | "upcoming" | "closed" | "voted"
  tokenRequirement?: string    // Token type identifier
  tokenAmount?: number         // Token amount required
  hasWhitelist: boolean        // Indicates if vote has address restrictions
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
}

/**
 * Vote cast event interface
 */
export interface VoteCastEvent {
  vote_id: string
  poll_id: string
  voter: string
  option_indices: number[]
}

/**
 * Vote created event interface
 */
export interface VoteCreatedEvent {
  vote_id: string
  creator: string
  title: string
  start_timestamp: number
  end_timestamp: number
  polls_count: number
  token_requirement?: string    // New field
  token_amount?: number         // New field
  has_whitelist: boolean        // New field
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
 * Vote list interface for display
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
  tokenAmount?: number
  hasWhitelist: boolean
  isWhitelisted?: boolean      // Indicates if user is whitelisted for this vote
}

export class SuiVoteService {
  private client: SuiClient
  private isInitialized = false

  constructor(network = "testnet") {
    try {
      this.client = new SuiClient({ url: getFullnodeUrl(network) })
      this.isInitialized = true
      console.log(`SuiVoteService initialized on network: ${network}`)
    } catch (error) {
      console.error(`Failed to initialize SuiClient for network ${network}:`, error)
      throw new Error(`Failed to initialize SuiVoteService: ${error instanceof Error ? error.message : String(error)}`)
    }
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

    console.log(`Fetching votes created by address ${address}, limit: ${limit}`)

    // Query for VoteCreated events using MoveEventType filter
    const eventsResponse = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::voting::VoteCreated`
      },
      cursor,
      limit: 100, // Using a higher limit initially since we'll filter manually
      descending_order: true, // Get most recent first
    })

    // Process events to extract vote IDs
    const votes: VoteDetails[] = []
    const processedIds = new Set<string>()

    console.log(`Found ${eventsResponse.data.length} vote creation events, filtering for creator: ${address}`)

    // Manually filter the events for creator = address
    const filteredEvents = eventsResponse.data.filter(event => {
      if (!event.parsedJson) return false
      const voteCreatedEvent = event.parsedJson as VoteCreatedEvent
      return voteCreatedEvent.creator === address
    })

    console.log(`After filtering, found ${filteredEvents.length} events by creator ${address}`)

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

    console.log(`Processed ${limitedVotes.length} unique votes`)

    return {
      data: limitedVotes,
      nextCursor: eventsResponse.nextCursor,
    }
  } catch (error) {
    console.error("Failed to fetch votes created by address:", error)
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

      console.log(`Fetching votes participated by address ${address}, limit: ${limit}`)

      // Query for VoteCast events using MoveEventType filter
      const eventsResponse = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
        },
        cursor,
        limit: 100, // Using a higher limit initially since we'll filter manually
        descending_order: true, // Get most recent first
      })

      console.log(`Found ${eventsResponse.data.length} vote cast events, filtering for voter: ${address}`)

      // Manually filter the events for voter = address
      const filteredEvents = eventsResponse.data.filter(event => {
        if (!event.parsedJson) return false
        const voteCastEvent = event.parsedJson as VoteCastEvent
        return voteCastEvent.voter === address
      })

      console.log(`After filtering, found ${filteredEvents.length} events by voter ${address}`)

      // Process events to extract unique vote IDs
      const voteIds = new Set<string>()
      for (const event of filteredEvents) {
        if (!event.parsedJson) continue

        const voteCastEvent = event.parsedJson as VoteCastEvent
        voteIds.add(voteCastEvent.vote_id)
      }

      console.log(`Found ${voteIds.size} unique votes participated in`)

      // Fetch details for each unique vote in parallel
      const votesPromises = Array.from(voteIds).map((voteId) => this.getVoteDetails(voteId))
      const votesResults = await Promise.all(votesPromises)

      // Filter out null results and respect the limit
      const votes = votesResults.filter(Boolean) as VoteDetails[]
      const limitedVotes = votes.slice(0, limit)

      console.log(`Successfully processed ${limitedVotes.length} votes`)

      return {
        data: limitedVotes,
        nextCursor: eventsResponse.nextCursor,
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

      // Check which votes the user has already voted in
      const votedPromises = Array.from(new Set([
        ...createdVotes.map(vote => vote.id),
        ...participatedVotes.map(vote => vote.id),
        ...whitelistedVotes.map(vote => vote.id)
      ])).map(async (voteId) => {
        const hasVoted = await this.hasVoted(address, voteId)
        return { voteId, hasVoted }
      })
      
      const votedResults = await Promise.all(votedPromises)
      const votedVoteIds = new Set(
        votedResults
          .filter(result => result.hasVoted)
          .map(result => result.voteId)
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
        
        // First, check if the user has already voted in this vote
        if (votedVoteIds.has(vote.id)) {
          status = "voted"
        } 
        // If it's an upcoming vote
        else if (currentTime < vote.startTimestamp) {
          status = "upcoming"
        }
        // If it's a closed vote
        else if (currentTime > vote.endTimestamp || vote.isCancelled) {
          status = "closed"
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
          isWhitelisted: whitelistedVoteIds.has(vote.id)
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
   * Get detailed information about a specific vote
   * @param voteId The vote object ID
   * @returns Vote details or null if not found
   */
  async getVoteDetails(voteId: string): Promise<VoteDetails | null> {
    try {
      this.checkInitialization()

      if (!voteId) {
        console.warn("Empty voteId provided to getVoteDetails")
        return null
      }

      // Fetch the vote object
      const { data } = await this.client.getObject({
        id: voteId,
        options: {
          showContent: true,
          showType: true,
        },
      })

      if (!data || !data.content || data.content.dataType !== "moveObject") {
        console.warn(`Vote object not found or invalid: ${voteId}`)
        return null
      }

      const objectType = data.type as string
      // Verify this is a Vote object from our package
      if (!objectType || !objectType.startsWith(`${PACKAGE_ID}::voting::Vote`)) {
        console.warn(`Object is not a Vote type: ${objectType}`)
        return null
      }

      const fields = data.content.fields as Record<string, any>

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

      // Extract token requirement fields - these are Option types in Sui
      const tokenRequirement = fields.token_requirement?.fields?.value || undefined
      const tokenAmount = fields.token_amount?.fields?.value !== undefined 
        ? Number(fields.token_amount.fields.value) 
        : undefined

      // Build the vote details object with new fields
      const voteDetails: VoteDetails = {
        id: voteId,
        creator: fields.creator,
        title: fields.title,
        description: fields.description,
        startTimestamp,
        endTimestamp,
        paymentAmount: Number(fields.payment_amount || 0),
        requireAllPolls: !!fields.require_all_polls,
        pollsCount: Number(fields.polls_count || 0),
        totalVotes: Number(fields.total_votes || 0),
        isCancelled,
        status,
        tokenRequirement,      // New field
        tokenAmount,           // New field
        hasWhitelist: !!fields.has_whitelist  // New field
      }

      return voteDetails
    } catch (error) {
      console.error(`Failed to fetch vote details for ${voteId}:`, error)
      return null
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

      console.log(`Fetching polls for vote ${voteId}, count: ${voteDetails.pollsCount}`)

      const polls: PollDetails[] = []
      const pollPromises: Promise<void>[] = []

      // Query each poll by its index using dynamic fields in parallel
      for (let i = 1; i <= voteDetails.pollsCount; i++) {
        pollPromises.push(
          (async (index) => {
            try {
              // Get the dynamic field (poll) by name
              const pollField = await this.client.getDynamicFieldObject({
                parentId: voteId,
                name: {
                  type: "u64",
                  value: index.toString(),
                },
              })

              if (!pollField.data || !pollField.data.content || pollField.data.content.dataType !== "moveObject") return

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

              polls.push(pollDetails)
            } catch (error) {
              console.warn(`Failed to fetch poll at index ${index} for vote ${voteId}:`, error)
              // Continue with other polls if one fails
            }
          })(i),
        )
      }

      // Wait for all polls to be fetched
      await Promise.all(pollPromises)

      // Sort polls by index (though they should already be in order)
      polls.sort((a, b) => a.id.localeCompare(b.id))

      console.log(`Successfully fetched ${polls.length} polls`)

      return polls
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

      console.log(`Fetching options for vote ${voteId}, poll index: ${pollIndex}`)

      // First get the poll details
      const polls = await this.getVotePolls(voteId)
      if (!polls || polls.length < pollIndex) {
        throw new Error(`Poll index ${pollIndex} not found for vote ${voteId}`)
      }

      const poll = polls[pollIndex - 1] // Convert to 0-based index
      const pollId = poll.id

      console.log(`Poll ID: ${pollId}, options count: ${poll.optionsCount}`)

      const options: PollOptionDetails[] = []
      const optionPromises: Promise<void>[] = []

      // Query each option by its index using dynamic fields in parallel
      for (let i = 1; i <= poll.optionsCount; i++) {
        optionPromises.push(
          (async (index) => {
            try {
              // Get the dynamic field (option) by name
              const optionField = await this.client.getDynamicFieldObject({
                parentId: pollId,
                name: {
                  type: "u64",
                  value: index.toString(),
                },
              })

              if (!optionField.data || !optionField.data.content || optionField.data.content.dataType !== "moveObject")
                return

              const optionFields = optionField.data.content.fields as Record<string, any>
              const optionId = optionField.data.objectId

              // Build option details
              const optionDetails: PollOptionDetails = {
                id: optionId,
                text: optionFields.text,
                mediaUrl: optionFields.media_url?.fields?.value || undefined,
                votes: Number(optionFields.votes || 0),
              }

              options.push(optionDetails)
            } catch (error) {
              console.warn(`Failed to fetch option at index ${index} for poll ${pollId}:`, error)
              // Continue with other options if one fails
            }
          })(i),
        )
      }

      // Wait for all options to be fetched
      await Promise.all(optionPromises)

      // Sort options by index (though they should already be in order)
      options.sort((a, b) => a.id.localeCompare(b.id))

      console.log(`Successfully fetched ${options.length} options`)

      return options
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
   * @param paymentAmount Payment amount in SUI
   * @param requireAllPolls Whether all polls must be answered
   * @param pollData Poll configuration data
   * @returns Transaction to be signed
   */
createCompleteVoteTransaction(
  title: string,
  description: string,
  startTimestamp: number,
  endTimestamp: number,
  requiredToken = "",
  requiredAmount = 0,
  paymentAmount = 0,
  requireAllPolls = true,
  pollData: PollData[],
): Transaction {
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

    console.log(`Creating complete vote: ${title} with ${pollData.length} polls`)

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
    const pollOptionMediaUrls: number[][] = [] // Changed to number[][]

    // Process each poll
    for (const poll of pollData) {
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

      // Process options for this poll
      for (const option of poll.options) {
        pollOptionTexts.push(option.text || "")

        // Convert media URL to bytes (empty array if none)
        if (option.mediaUrl) {
          // Convert string to Uint8Array, then to regular array
          const mediaUrlBytes = new TextEncoder().encode(option.mediaUrl)
          // Convert Uint8Array to regular array
          pollOptionMediaUrls.push(Array.from(mediaUrlBytes))
        } else {
          // Empty array if no media URL
          pollOptionMediaUrls.push([])
        }
      }
    }

    // Convert token requirement to bytes
    const tokenRequirementBytes = requiredToken 
      ? Array.from(new TextEncoder().encode(requiredToken))
      : []

    // Build the transaction with proper arguments matching the contract
    tx.moveCall({
      target: `${PACKAGE_ID}::voting::create_complete_vote`,
      arguments: [
        tx.object(ADMIN_ID),
        tx.pure.string(title),
        tx.pure.string(description),
        tx.pure.u64(startTimestamp),
        tx.pure.u64(endTimestamp),
        tx.pure.u64(paymentAmount),
        tx.pure.bool(requireAllPolls),
        tx.pure.vector("u8", tokenRequirementBytes),  // Token requirement as vector<u8>
        tx.pure.u64(requiredAmount),                  // Token amount as u64
        tx.pure.vector("string", pollTitles),
        tx.pure.vector("string", pollDescriptions),
        tx.pure.vector("bool", pollIsMultiSelect),
        tx.pure.vector("u64", pollMaxSelections),
        tx.pure.vector("bool", pollIsRequired),
        tx.pure.vector("u64", pollOptionCounts),
        tx.pure.vector("string", pollOptionTexts),
        tx.pure.vector("vector<u8>", pollOptionMediaUrls),
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
  createVoteWithMediaTransaction(
  title: string,
  description: string,
  startTimestamp: number,
  endTimestamp: number,
  requiredToken = "",
  requiredAmount = 0,
  paymentAmount = 0,
  requireAllPolls = true,
  pollData: PollData[],
  mediaFiles: Record<string, { data: Uint8Array, contentType: string }>
): Transaction {
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

    console.log(`Creating vote with media: ${title} with ${pollData.length} polls and ${Object.keys(mediaFiles).length} media files`)

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
    for (const poll of pollData) {
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

      // Process options for this poll
      for (const option of poll.options) {
        pollOptionTexts.push(option.text || "")

        // If option has mediaUrl and it references a blob ID placeholder
        if (option.mediaUrl && option.mediaUrl.startsWith("[MEDIA_FILE_") && option.mediaUrl.endsWith("]")) {
          // Extract file ID from reference
          const fileId = option.mediaUrl.substring(12, option.mediaUrl.length - 1)
          
          // Check if we have this file in our map
          if (blobIdMap.has(fileId)) {
            // Create the Sui blob URL
            const placeholderUrl = `sui://blob/${blobIdMap.get(fileId)}`
            
            // Convert to byte array for the Move call
            const mediaUrlBytes = new TextEncoder().encode(placeholderUrl)
            pollOptionMediaUrls.push(Array.from(mediaUrlBytes))
          } else {
            // File not found, use empty URL
            pollOptionMediaUrls.push([])
          }
        } else if (option.mediaUrl) {
          // Regular URL (external or previously uploaded)
          const mediaUrlBytes = new TextEncoder().encode(option.mediaUrl)
          pollOptionMediaUrls.push(Array.from(mediaUrlBytes))
        } else {
          // No media URL
          pollOptionMediaUrls.push([])
        }
      }
    }

    // Convert token requirement to bytes
    const tokenRequirementBytes = requiredToken 
      ? Array.from(new TextEncoder().encode(requiredToken))
      : []

    // 3. Create the vote using the actual SuiVote package ID
    const voteObj = tx.moveCall({
      target: `${PACKAGE_ID}::voting::create_complete_vote`,
      arguments: [
        tx.object(ADMIN_ID),
        tx.pure.string(title),
        tx.pure.string(description),
        tx.pure.u64(startTimestamp),
        tx.pure.u64(endTimestamp),
        tx.pure.u64(paymentAmount),
        tx.pure.bool(requireAllPolls),
        tx.pure.vector("u8", tokenRequirementBytes),  // Token requirement as vector<u8>
        tx.pure.u64(requiredAmount),                  // Token amount as u64
        tx.pure.vector("string", pollTitles),
        tx.pure.vector("string", pollDescriptions),
        tx.pure.vector("bool", pollIsMultiSelect),
        tx.pure.vector("u64", pollMaxSelections),
        tx.pure.vector("bool", pollIsRequired),
        tx.pure.vector("u64", pollOptionCounts),
        tx.pure.vector("string", pollOptionTexts),
        tx.pure.vector("vector<u8>", pollOptionMediaUrls),
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

      console.log(`Checking if ${voterAddress} is whitelisted for vote ${voteId}`)

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

      console.log(`Adding ${voterAddresses.length} voters to the whitelist for vote ${voteId}`)

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

      console.log(`Getting whitelisted voters for vote ${voteId}`)

      // First check if the vote has a whitelist
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails || !voteDetails.hasWhitelist) {
        return []
      }

      // We need to check VoterWhitelisted events since dynamic field queries 
      // can't be easily filtered by type
      const whitelistedVoters: string[] = []

      // Query for VoterWhitelisted events
      const { data } = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoterWhitelisted`
        },
        limit: 1000, // Using a higher limit to get all events
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

      console.log(`Fetching votes where ${address} is whitelisted, limit: ${limit}`)

      // Query for VoterWhitelisted events using MoveEventType filter
      const eventsResponse = await this.client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::voting::VoterWhitelisted`
        },
        cursor,
        limit: 100, // Using a higher limit initially since we'll filter manually
        descending_order: true, // Get most recent first
      })

      console.log(`Found ${eventsResponse.data.length} whitelist events, filtering for voter: ${address}`)

      // Manually filter the events for voter_address = address
      const filteredEvents = eventsResponse.data.filter(event => {
        if (!event.parsedJson) return false
        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        return whitelistEvent.voter_address === address
      })

      console.log(`After filtering, found ${filteredEvents.length} events for voter ${address}`)

      // Process events to extract unique vote IDs
      const voteIds = new Set<string>()
      for (const event of filteredEvents) {
        if (!event.parsedJson) continue

        const whitelistEvent = event.parsedJson as VoterWhitelistedEvent
        voteIds.add(whitelistEvent.vote_id)
      }

      console.log(`Found ${voteIds.size} unique votes where user is whitelisted`)

      // Fetch details for each unique vote in parallel
      const votesPromises = Array.from(voteIds).map((voteId) => this.getVoteDetails(voteId))
      const votesResults = await Promise.all(votesPromises)

      // Filter out null results and respect the limit
      const votes = votesResults.filter(Boolean) as VoteDetails[]
      const limitedVotes = votes.slice(0, limit)

      console.log(`Successfully processed ${limitedVotes.length} votes`)

      return {
        data: limitedVotes,
        nextCursor: eventsResponse.nextCursor,
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
  castVoteTransaction(voteId: string, pollIndex: number, optionIndices: number[], payment = 0): Transaction {
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

      console.log(`Casting vote on poll ${pollIndex} of vote ${voteId}, options: ${optionIndices.join(", ")}`)

      const tx = new Transaction()

      // Create payment coin if needed
      let paymentCoin
      if (payment > 0) {
        // Split payment from gas coin
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(payment)])
      } else {
        // Create an empty coin if no payment is required
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)])
      }

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cast_vote`,
        arguments: [
          tx.object(voteId),
          tx.object(ADMIN_ID),
          tx.pure.u64(pollIndex),
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
   * @param payment SUI payment amount (if required)
   * @returns Transaction to be signed
   */
  castMultipleVotesTransaction(
    voteId: string,
    pollIndices: number[],
    optionIndicesPerPoll: number[][],
    payment = 0,
  ): Transaction {
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
      }

      if (payment < 0) {
        throw new Error("Payment amount must be non-negative")
      }

      console.log(`Casting votes on ${pollIndices.length} polls of vote ${voteId}`)

      const tx = new Transaction()

      // Create payment coin if needed
      let paymentCoin
      if (payment > 0) {
        // Split payment from gas coin
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(payment)])
      } else {
        // Create an empty coin if no payment is required
        ;[paymentCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)])
      }

      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID)

      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cast_multiple_votes`,
        arguments: [
          tx.object(voteId),
          tx.object(ADMIN_ID),
          tx.pure.vector("u64", pollIndices),
          tx.pure.vector("vector<u64>", optionIndicesPerPoll),
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

      console.log(`Closing vote ${voteId}`)

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

      console.log(`Cancelling vote ${voteId}`)

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

      console.log(`Extending voting period for vote ${voteId} to ${new Date(newEndTimestamp).toISOString()}`)

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
 * Check if a user has voted on a specific vote
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

    console.log(`Checking if user ${userAddress} has voted on vote ${voteId}`)

    // Query for VoteCast events using MoveEventType filter
    const { data } = await this.client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
      },
      limit: 50, // Using a reasonable limit to search through
    })

    // Manually filter for both voter and vote_id
    const hasVoted = data.some(event => {
      if (!event.parsedJson) return false
      
      const voteCastEvent = event.parsedJson as VoteCastEvent
      return voteCastEvent.voter === userAddress && voteCastEvent.vote_id === voteId
    })

    console.log(`User ${userAddress} has ${hasVoted ? "" : "not "}voted on vote ${voteId}`)

    return hasVoted
  } catch (error) {
    console.error(`Failed to check if user ${userAddress} has voted on vote ${voteId}:`, error)
    return false
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

      console.log(`Getting vote results for vote ${voteId}`)

      // First check if vote is closed
      const voteDetails = await this.getVoteDetails(voteId)
      if (!voteDetails) return null

      // Only return results if vote is closed or is active
      if (voteDetails.status !== "closed" && voteDetails.status !== "active") {
        console.log(`Vote ${voteId} is ${voteDetails.status}, results not available`)
        return null
      }

      // Get all polls first
      const polls = await this.getVotePolls(voteId)
      if (!polls || polls.length === 0) return null

      console.log(`Found ${polls.length} polls for vote ${voteId}`)

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

      console.log(`Successfully retrieved results for ${Object.keys(results).length} polls`)

      return results
    } catch (error) {
      console.error(`Failed to get vote results for vote ${voteId}:`, error)
      return null
    }
  }
}