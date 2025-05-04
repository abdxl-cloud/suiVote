// services/suivote-service.ts
import { 
    SuiClient, 
    getFullnodeUrl, 
    SuiObjectResponse, 
    SuiEventFilter, 
    PaginatedObjectsResponse 
  } from '@mysten/sui/client';
  import { Transaction } from '@mysten/sui/transactions';
  import { bcs } from '@mysten/sui/bcs';
  import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
  import { SUI_CONFIG } from "../config/sui-config"
  
  const PACKAGE_ID = SUI_CONFIG.PACKAGE_ID
  const ADMIN_ID = SUI_CONFIG.ADMIN_ID
  
  // Data types for vote details
  export interface VoteDetails {
    id: string;
    creator: string;
    title: string;
    description: string;
    startTimestamp: number;
    endTimestamp: number;
    requiredToken?: string;
    requiredAmount: number;
    paymentAmount: number;
    requireAllPolls: boolean;
    pollsCount: number;
    totalVotes: number;
    isCancelled: boolean;
    status: 'upcoming' | 'active' | 'closed';
  }
  
  export interface PollDetails {
    id: string;
    title: string;
    description: string;
    isMultiSelect: boolean;
    maxSelections: number;
    isRequired: boolean;
    optionsCount: number;
    totalResponses: number;
    options?: PollOptionDetails[];
  }
  
  export interface PollOptionDetails {
    id: string;
    text: string;
    mediaUrl?: string;
    votes: number;
  }
  
  export interface VoteCastEvent {
    vote_id: string;
    poll_id: string;
    voter: string;
    option_indices: number[];
  }
  
  export interface VoteCreatedEvent {
    vote_id: string;
    creator: string;
    title: string;
    start_timestamp: number;
    end_timestamp: number;
    polls_count: number;
  }
  
  export interface TokenVerificationResult {
    isValid: boolean;
    balance: bigint;
    error?: string;
  }
  
  /**
   * Service for interacting with the SuiVote contract
   */
  export class SuiVoteService {
    private client: SuiClient;
  
    /**
     * Initialize the service with a network selection
     * @param network The Sui network to connect to (devnet, testnet, mainnet)
     */
    constructor(network = 'devnet') {
      try {
        this.client = new SuiClient({ url: getFullnodeUrl(SUI_CONFIG.NETWORK) });
        console.log(`SuiVoteService initialized on network: ${network}`);
      } catch (error) {
        console.error(`Failed to initialize SuiClient for network ${network}:`, error);
        throw new Error(`Failed to initialize SuiVoteService: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    }
  
    /**
     * Get votes created by a specific address with pagination support
     * @param address The creator's address
     * @param limit Maximum number of votes to return
     * @param cursor Pagination cursor
     * @returns Array of vote details with pagination cursor
     */
    async getVotesCreatedByAddress(
      address: string, 
      limit: number = 20, 
      cursor?: string
    ): Promise<{ data: VoteDetails[], nextCursor?: string }> {
      try {
        if (!address) {
          throw new Error("Address is required");
        }
        
        console.log(`Fetching votes created by address ${address}, limit: ${limit}`);
        
        // Query for VoteCreated events where creator matches address
        const eventsResponse = await this.client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::voting::VoteCreated`,
            MoveEventField: {
              path: '/creator',
              value: address
            }
          },
          cursor,
          limit,
          descending_order: true // Get most recent first
        });
  
        // Process events to extract vote IDs
        const votes: VoteDetails[] = [];
        const processedIds = new Set<string>();
  
        console.log(`Found ${eventsResponse.data.length} vote creation events`);
  
        // Use Promise.all for parallel processing
        await Promise.all(eventsResponse.data.map(async (event) => {
          if (!event.parsedJson) return;
          
          const voteCreatedEvent = event.parsedJson as VoteCreatedEvent;
          
          // Avoid processing duplicates
          if (processedIds.has(voteCreatedEvent.vote_id)) return;
          processedIds.add(voteCreatedEvent.vote_id);
          
          // Get detailed vote information
          const voteDetails = await this.getVoteDetails(voteCreatedEvent.vote_id);
          if (voteDetails) {
            votes.push(voteDetails);
          }
        }));
  
        // Sort by most recent first
        votes.sort((a, b) => b.startTimestamp - a.startTimestamp);
  
        console.log(`Processed ${votes.length} unique votes`);
  
        return {
          data: votes,
          nextCursor: eventsResponse.nextCursor
        };
      } catch (error) {
        console.error("Failed to fetch votes created by address:", error);
        throw new Error(`Failed to fetch votes: ${(error instanceof Error) ? error.message : String(error)}`);
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
      limit: number = 20, 
      cursor?: string
    ): Promise<{ data: VoteDetails[], nextCursor?: string }> {
      try {
        if (!address) {
          throw new Error("Address is required");
        }
        
        console.log(`Fetching votes participated by address ${address}, limit: ${limit}`);
        
        // Query for VoteCast events where voter matches the address
        const eventsResponse = await this.client.queryEvents({
          query: {
            And: [
              {
                MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
              },
              {
                MoveEventField: {
                  path: '/voter',
                  value: address
                }
              }
            ]
          },
          cursor,
          limit,
          descending_order: true // Get most recent first
        });
        
        console.log(`Found ${eventsResponse.data.length} vote cast events`);
        
        // Process events to extract unique vote IDs
        const voteIds = new Set<string>();
        for (const event of eventsResponse.data) {
          if (!event.parsedJson) continue;
          
          const voteCastEvent = event.parsedJson as VoteCastEvent;
          voteIds.add(voteCastEvent.vote_id);
        }
        
        console.log(`Found ${voteIds.size} unique votes participated in`);
        
        // Fetch details for each unique vote in parallel
        const votesPromises = Array.from(voteIds).map(voteId => this.getVoteDetails(voteId));
        const votesResults = await Promise.all(votesPromises);
        
        // Filter out null results and respect the limit
        const votes = votesResults.filter(Boolean) as VoteDetails[];
        const limitedVotes = votes.slice(0, limit);
        
        console.log(`Successfully processed ${limitedVotes.length} votes`);
        
        return {
          data: limitedVotes,
          nextCursor: eventsResponse.nextCursor
        };
      } catch (error) {
        console.error("Failed to fetch participated votes:", error);
        throw new Error(`Failed to fetch participated votes: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    }
  
    /**
     * Get detailed information about a specific vote
     * @param voteId The vote object ID
     * @returns Vote details or null if not found
     */
    async getVoteDetails(voteId: string): Promise<VoteDetails | null> {
      try {
        if (!voteId) {
          console.warn("Empty voteId provided to getVoteDetails");
          return null;
        }
        
        // Fetch the vote object
        const { data } = await this.client.getObject({
          id: voteId,
          options: {
            showContent: true,
            showType: true,
          },
        });
        
        if (!data || !data.content || data.content.dataType !== 'moveObject') {
          console.warn(`Vote object not found or invalid: ${voteId}`);
          return null;
        }
        
        const objectType = data.type as string;
        // Verify this is a Vote object from our package
        if (!objectType || !objectType.startsWith(`${PACKAGE_ID}::voting::Vote`)) {
          console.warn(`Object is not a Vote type: ${objectType}`);
          return null;
        }
        
        const fields = data.content.fields as Record<string, any>;
        
        // Get current time to determine vote status
        const currentTime = Date.now();
        const startTimestamp = Number(fields.start_timestamp);
        const endTimestamp = Number(fields.end_timestamp);
        const isCancelled = fields.is_cancelled;
        
        let status: 'upcoming' | 'active' | 'closed';
        if (isCancelled) {
          status = 'closed';
        } else if (currentTime < startTimestamp) {
          status = 'upcoming';
        } else if (currentTime <= endTimestamp) {
          status = 'active';
        } else {
          status = 'closed';
        }
        
        // Check for required token - handle the case where it might be in different formats
        let requiredToken = undefined;
        if (fields.required_token && fields.required_token.fields && fields.required_token.fields.value) {
          requiredToken = fields.required_token.fields.value;
        } else if (fields.required_token && typeof fields.required_token === 'string') {
          requiredToken = fields.required_token;
        }
        
        // Build the vote details object
        const voteDetails: VoteDetails = {
          id: voteId,
          creator: fields.creator,
          title: fields.title || '',
          description: fields.description || '',
          startTimestamp,
          endTimestamp,
          requiredToken,
          requiredAmount: Number(fields.required_amount || 0),
          paymentAmount: Number(fields.payment_amount || 0),
          requireAllPolls: !!fields.require_all_polls,
          pollsCount: Number(fields.polls_count || 0),
          totalVotes: Number(fields.total_votes || 0),
          isCancelled,
          status
        };
        
        return voteDetails;
      } catch (error) {
        console.error(`Failed to fetch vote details for ${voteId}:`, error);
        return null;
      }
    }
  
    /**
     * Get detailed information about a vote's polls
     * @param voteId The vote object ID
     * @returns Array of poll details
     */
    async getVotePolls(voteId: string): Promise<PollDetails[]> {
      try {
        if (!voteId) {
          throw new Error("Vote ID is required");
        }
        
        // First get the vote details to check pollsCount
        const voteDetails = await this.getVoteDetails(voteId);
        if (!voteDetails) throw new Error(`Vote ${voteId} not found`);
        
        console.log(`Fetching polls for vote ${voteId}, count: ${voteDetails.pollsCount}`);
        
        const polls: PollDetails[] = [];
        const pollPromises: Promise<void>[] = [];
        
        // Query each poll by its index using dynamic fields in parallel
        for (let i = 1; i <= voteDetails.pollsCount; i++) {
          pollPromises.push(
            (async (index) => {
              try {
                // Get the dynamic field (poll) by name
                const pollField = await this.client.getDynamicFieldObject({
                  parentId: voteId,
                  name: {
                    type: 'u64',
                    value: index.toString()
                  }
                });
                
                if (!pollField.data || !pollField.data.content || pollField.data.content.dataType !== 'moveObject') return;
                
                const pollFields = pollField.data.content.fields as Record<string, any>;
                const pollId = pollField.data.objectId;
                
                // Build poll details
                const pollDetails: PollDetails = {
                  id: pollId,
                  title: pollFields.title || '',
                  description: pollFields.description || '',
                  isMultiSelect: !!pollFields.is_multi_select,
                  maxSelections: Number(pollFields.max_selections || 1),
                  isRequired: !!pollFields.is_required,
                  optionsCount: Number(pollFields.options_count || 0),
                  totalResponses: Number(pollFields.total_responses || 0),
                  options: [] // Will be populated separately if needed
                };
                
                polls.push(pollDetails);
              } catch (error) {
                console.warn(`Failed to fetch poll at index ${index} for vote ${voteId}:`, error);
                // Continue with other polls if one fails
              }
            })(i)
          );
        }
        
        // Wait for all polls to be fetched
        await Promise.all(pollPromises);
        
        // Sort polls by index (though they should already be in order)
        polls.sort((a, b) => a.id.localeCompare(b.id));
        
        console.log(`Successfully fetched ${polls.length} polls`);
        
        return polls;
      } catch (error) {
        console.error(`Failed to fetch polls for vote ${voteId}:`, error);
        throw new Error(`Failed to fetch polls: ${(error instanceof Error) ? error.message : String(error)}`);
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
        if (!voteId) {
          throw new Error("Vote ID is required");
        }
        
        if (pollIndex < 1) {
          throw new Error("Poll index must be 1 or greater");
        }
        
        console.log(`Fetching options for vote ${voteId}, poll index: ${pollIndex}`);
        
        // First get the poll details
        const polls = await this.getVotePolls(voteId);
        if (!polls || polls.length < pollIndex) {
          throw new Error(`Poll index ${pollIndex} not found for vote ${voteId}`);
        }
        
        const poll = polls[pollIndex - 1]; // Convert to 0-based index
        const pollId = poll.id;
        
        console.log(`Poll ID: ${pollId}, options count: ${poll.optionsCount}`);
        
        const options: PollOptionDetails[] = [];
        const optionPromises: Promise<void>[] = [];
        
        // Query each option by its index using dynamic fields in parallel
        for (let i = 1; i <= poll.optionsCount; i++) {
          optionPromises.push(
            (async (index) => {
              try {
                // Get the dynamic field (option) by name
                const optionField = await this.client.getDynamicFieldObject({
                  parentId: pollId,
                  name: {
                    type: 'u64',
                    value: index.toString()
                  }
                });
                
                if (!optionField.data || !optionField.data.content || optionField.data.content.dataType !== 'moveObject') return;
                
                const optionFields = optionField.data.content.fields as Record<string, any>;
                const optionId = optionField.data.objectId;
                
                // Build option details
                const optionDetails: PollOptionDetails = {
                  id: optionId,
                  text: optionFields.text || '',
                  mediaUrl: optionFields.media_url?.fields?.value || undefined, // Handle Option<String>
                  votes: Number(optionFields.votes || 0)
                };
                
                options.push(optionDetails);
              } catch (error) {
                console.warn(`Failed to fetch option at index ${index} for poll ${pollId}:`, error);
                // Continue with other options if one fails
              }
            })(i)
          );
        }
        
        // Wait for all options to be fetched
        await Promise.all(optionPromises);
        
        // Sort options by index (though they should already be in order)
        options.sort((a, b) => a.id.localeCompare(b.id));
        
        console.log(`Successfully fetched ${options.length} options`);
        
        return options;
      } catch (error) {
        console.error(`Failed to fetch options for poll ${pollIndex} in vote ${voteId}:`, error);
        throw new Error(`Failed to fetch poll options: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    }
  
    /**
     * Create a new vote
     * @param title Vote title
     * @param description Vote description
     * @param startTimestamp Start timestamp in milliseconds
     * @param endTimestamp End timestamp in milliseconds
     * @param requiredToken Optional token requirement
     * @param requiredAmount Required token amount
     * @param paymentAmount Payment amount in SUI
     * @param requireAllPolls Whether all polls must be answered
     * @returns Transaction to be signed
     */
    createVote(
      title: string,
      description: string,
      startTimestamp: number,
      endTimestamp: number,
      requiredToken: string = '',
      requiredAmount: number = 0,
      paymentAmount: number = 0,
      requireAllPolls: boolean = true,
    ): Transaction {
      try {
        // Validate inputs
        if (!title) {
          throw new Error("Vote title is required");
        }
        
        if (startTimestamp >= endTimestamp) {
          throw new Error("End timestamp must be after start timestamp");
        }
        
        if (requiredAmount < 0) {
          throw new Error("Required amount must be non-negative");
        }
        
        if (paymentAmount < 0) {
          throw new Error("Payment amount must be non-negative");
        }
        
        console.log(`Creating vote: ${title}, timeframe: ${new Date(startTimestamp).toISOString()} - ${new Date(endTimestamp).toISOString()}`);
        
        const tx = new Transaction();
        
        // Get current timestamp from Clock object
        const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
        
        // Properly encode all string values to prevent errors
        const titleBytes = new TextEncoder().encode(title || '');
        const descriptionBytes = new TextEncoder().encode(description || '');
        const requiredTokenBytes = new TextEncoder().encode(requiredToken || '');
        
        tx.moveCall({
          target: `${PACKAGE_ID}::voting::create_vote`,
          arguments: [
            tx.object(ADMIN_ID),
            tx.pure(titleBytes),
            tx.pure(descriptionBytes),
            tx.pure(startTimestamp),
            tx.pure(endTimestamp),
            tx.pure(requiredTokenBytes),
            tx.pure(requiredAmount),
            tx.pure(paymentAmount),
            tx.pure(requireAllPolls),
            clockObj
          ],
        });
        
        // Return transaction to be signed by the wallet
        return tx;
      } catch (error) {
        console.error("Failed to create vote transaction:", error);
        throw new Error(`Failed to create vote transaction: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    }
  
    /**
     * Create a complete vote with polls and options in a single transaction
     * This is more gas-efficient than creating everything separately
     * @param title Vote title
     * @param description Vote description
     * @param startTimestamp Start timestamp in milliseconds
     * @param endTimestamp End timestamp in milliseconds
     * @param requiredToken Optional token requirement
     * @param requiredAmount Required token amount
     * @param paymentAmount Payment amount in SUI
     * @param requireAllPolls Whether all polls must be answered
     * @param pollData Poll configuration data
     * @returns Transaction to be signed
     */
    /**
     * Create a complete vote with polls and options in a single transaction
     * This is more gas-efficient than creating everything separately
     */
    createCompleteVote(
        title: string,
        description: string,
        startTimestamp: number,
        endTimestamp: number,
        requiredToken: string = '',
        requiredAmount: number = 0,
        paymentAmount: number = 0,
        requireAllPolls: boolean = true,
        pollData: {
        title: string;
        description: string;
        isMultiSelect: boolean;
        maxSelections: number;
        isRequired: boolean;
        options: {
            text: string;
            mediaUrl?: string;
        }[];
        }[]
    ): Transaction {
        try {
        // Validate inputs
        if (!title) {
            throw new Error("Vote title is required");
        }
        
        if (startTimestamp >= endTimestamp) {
            throw new Error("End timestamp must be after start timestamp");
        }
        
        if (requiredAmount < 0) {
            throw new Error("Required amount must be non-negative");
        }
        
        if (paymentAmount < 0) {
            throw new Error("Payment amount must be non-negative");
        }
        
        if (!pollData || !Array.isArray(pollData) || pollData.length === 0) {
            throw new Error("At least one poll is required");
        }
        
        // Validate poll data
        for (const poll of pollData) {
            if (!poll.title) {
            throw new Error("Poll title is required");
            }
            
            if (!poll.options || !Array.isArray(poll.options) || poll.options.length < 2) {
            throw new Error(`Poll "${poll.title}" must have at least 2 options`);
            }
            
            if (poll.isMultiSelect && (poll.maxSelections < 1 || poll.maxSelections >= poll.options.length)) {
            throw new Error(`Multi-select poll "${poll.title}" maxSelections must be between 1 and ${poll.options.length - 1}`);
            }
            
            for (const option of poll.options) {
            if (!option.text) {
                throw new Error(`All options in poll "${poll.title}" must have text`);
            }
            }
        }
        
        console.log(`Creating complete vote: ${title} with ${pollData.length} polls`);
        
        const tx = new Transaction();
        
        // Get current timestamp from Clock object
        const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
        
        // Use BCS to properly serialize string arrays
        // For strings, we need to properly encode to BCS format
        const titleBcs = bcs.string().serialize(title || '').toBytes();
        const descriptionBcs = bcs.string().serialize(description || '').toBytes();
        const requiredTokenBcs = bcs.string().serialize(requiredToken || '').toBytes();
        
        // Initialize arrays for poll data
        const pollTitlesBcs: Uint8Array[] = [];
        const pollDescriptionsBcs: Uint8Array[] = [];
        const pollIsMultiSelect: boolean[] = [];
        const pollMaxSelections: number[] = [];
        const pollIsRequired: boolean[] = [];
        const pollOptionCounts: number[] = [];
        const pollOptionTextsBcs: Uint8Array[] = [];
        const pollOptionMediaUrlsBcs: Uint8Array[] = [];
        
        // Process each poll with validation
        for (const poll of pollData) {
            // Encode poll title and description with BCS
            pollTitlesBcs.push(bcs.string().serialize(poll.title || '').toBytes());
            pollDescriptionsBcs.push(bcs.string().serialize(poll.description || '').toBytes());
            
            // Ensure boolean and number values
            pollIsMultiSelect.push(!!poll.isMultiSelect);
            pollIsRequired.push(!!poll.isRequired);
            
            // Handle maxSelections for single/multi-select polls
            let maxSelections = poll.isMultiSelect 
            ? Math.min(Math.max(1, poll.maxSelections), poll.options.length - 1) 
            : 1;
            pollMaxSelections.push(maxSelections);
            
            // Record option count for this poll
            pollOptionCounts.push(poll.options.length);
            
            // Process options for this poll
            for (const option of poll.options) {
            pollOptionTextsBcs.push(bcs.string().serialize(option.text || '').toBytes());
            
            // Convert media URL string to BCS
            const mediaUrl = option.mediaUrl || '';
            pollOptionMediaUrlsBcs.push(bcs.string().serialize(mediaUrl).toBytes());
            }
        }
        
        // Log array sizes for debugging
        console.log(`Building transaction with:
            - title: ${title}
            - ${pollData.length} polls
            - ${pollOptionTextsBcs.length} total options
            - Start: ${new Date(startTimestamp).toISOString()}
            - End: ${new Date(endTimestamp).toISOString()}`
        );
        
        // Build the transaction with correct BCS serialization
        tx.moveCall({
            target: `${PACKAGE_ID}::voting::create_complete_vote`,
            arguments: [
            tx.object(ADMIN_ID),
            tx.pure(titleBcs, "vector<u8>"),
            tx.pure(descriptionBcs, "vector<u8>"),
            tx.pure(startTimestamp, "u64"),
            tx.pure(endTimestamp, "u64"),
            tx.pure(requiredTokenBcs, "vector<u8>"),
            tx.pure(requiredAmount, "u64"),
            tx.pure(paymentAmount, "u64"),
            tx.pure(requireAllPolls, "bool"),
            tx.pure(pollTitlesBcs, "vector<vector<u8>>"),
            tx.pure(pollDescriptionsBcs, "vector<vector<u8>>"),
            tx.pure(pollIsMultiSelect, "vector<bool>"),
            tx.pure(pollMaxSelections, "vector<u64>"),
            tx.pure(pollIsRequired, "vector<bool>"),
            tx.pure(pollOptionCounts, "vector<u64>"),
            tx.pure(pollOptionTextsBcs, "vector<vector<u8>>"),
            tx.pure(pollOptionMediaUrlsBcs, "vector<vector<u8>>"),
            clockObj
            ],
        });
        
        return tx;
        } catch (error) {
        console.error("Failed to create complete vote transaction:", error);
        throw new Error(`Failed to create complete vote transaction: ${(error instanceof Error) ? error.message : String(error)}`);
        }
    }
  
    /**
     * Add a poll to an existing vote
     * @param voteId Vote object ID
     * @param title Poll title
     * @param description Poll description
     * @param isMultiSelect Whether multiple options can be selected
     * @param maxSelections Maximum number of selections (for multi-select)
     * @param isRequired Whether the poll is required
     * @returns Transaction to be signed
     */
    addPoll(
      voteId: string,
      title: string,
      description: string,
      isMultiSelect: boolean = false,
      maxSelections: number = 1,
      isRequired: boolean = true
    ): Transaction {
      try {
        if (!voteId) {
          throw new Error("Vote ID is required");
        }
        
        if (!title) {
          throw new Error("Poll title is required");
        }
        
        if (isMultiSelect && maxSelections < 1) {
          throw new Error("Max selections must be at least 1 for multi-select polls");
        }
        
        console.log(`Adding poll "${title}" to vote ${voteId}`);
        
        const tx = new Transaction();
        
        // Get the clock object
        const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
        
        // Encode string values
        const titleBytes = new TextEncoder().encode(title || '');
        const descriptionBytes = new TextEncoder().encode(description || '');
        
        tx.moveCall({
          target: `${PACKAGE_ID}::voting::add_poll`,
          arguments: [
            tx.object(voteId),
            tx.pure(titleBytes),
            tx.pure(descriptionBytes),
            tx.pure(isMultiSelect),
            tx.pure(maxSelections),
            tx.pure(isRequired),
            clockObj
          ],
        });
        
        return tx;
      } catch (error) {
        console.error(`Failed to create add poll transaction:`, error);
        throw new Error(`Failed to add poll: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    }
  
    /**
     * Add an option to a poll
     * @param voteId Vote object ID
     * @param pollIndex Poll index (1-based)
     * @param text Option text
     * @param mediaUrl Optional media URL
     * @returns Transaction to be signed
     */
    addPollOption(
      voteId: string,
      pollIndex: number,
      text: string,
      mediaUrl: string = ''
    ): Transaction {
      try {
        if (!voteId) {
          throw new Error("Vote ID is required");
        }
        
        if (pollIndex < 1) {
          throw new Error("Poll index must be 1 or greater");
        }
        
        if (!text) {
          throw new Error("Option text is required");
        }
        
        console.log(`Adding option "${text}" to poll ${pollIndex} in vote ${voteId}`);
        
        const tx = new Transaction();
        
        // Get the clock object
        const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
        
        // Encode string values
        const textBytes = new TextEncoder().encode(text || '');
        const mediaUrlBytes = new TextEncoder().encode(mediaUrl || '');
        
        tx.moveCall({
          target: `${PACKAGE_ID}::voting::add_poll_option`,
          arguments: [
            tx.object(voteId),
            tx.pure(pollIndex),
            tx.pure(textBytes),
            tx.pure(mediaUrlBytes),
            clockObj
          ],
        });
        
        return tx;
      } catch (error) {
        console.error(`Failed to create add poll option transaction:`, error);
        throw new Error(`Failed to add poll option: ${(error instanceof Error) ? error.message : String(error)}`);
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
  castVote(
    voteId: string,
    pollIndex: number,
    optionIndices: number[],
    payment: number = 0
  ): Transaction {
    try {
      // Validate inputs
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      if (pollIndex < 1) {
        throw new Error("Poll index must be 1 or greater");
      }
      
      if (!optionIndices || !Array.isArray(optionIndices) || optionIndices.length === 0) {
        throw new Error("At least one option index must be selected");
      }
      
      if (payment < 0) {
        throw new Error("Payment amount must be non-negative");
      }
      
      console.log(`Casting vote on poll ${pollIndex} of vote ${voteId}, options: ${optionIndices.join(', ')}`);
      
      const tx = new Transaction();
      
      // Create payment coin if needed
      let paymentCoin;
      if (payment > 0) {
        // Split payment from gas coin
        [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure(payment)]);
      } else {
        // Create an empty coin if no payment is required
        [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure(0)]);
      }
      
      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cast_vote`,
        arguments: [
          tx.object(voteId),
          tx.object(ADMIN_ID),
          tx.pure(pollIndex),
          tx.pure(optionIndices),
          paymentCoin,
          clockObj
        ],
      });
      
      return tx;
    } catch (error) {
      console.error(`Failed to create cast vote transaction:`, error);
      throw new Error(`Failed to cast vote: ${(error instanceof Error) ? error.message : String(error)}`);
    }
  }

  /**
   * Cast votes on multiple polls at once
   * This is more gas-efficient than casting multiple individual votes
   * @param voteId Vote object ID
   * @param pollIndices Poll indices (1-based)
   * @param optionIndicesPerPoll Selected option indices for each poll (1-based)
   * @param payment SUI payment amount (if required)
   * @returns Transaction to be signed
   */
  castMultipleVotes(
    voteId: string,
    pollIndices: number[],
    optionIndicesPerPoll: number[][],
    payment: number = 0
  ): Transaction {
    try {
      // Validate inputs
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      if (!pollIndices || !Array.isArray(pollIndices) || pollIndices.length === 0) {
        throw new Error("At least one poll index must be specified");
      }
      
      if (!optionIndicesPerPoll || !Array.isArray(optionIndicesPerPoll) || optionIndicesPerPoll.length === 0) {
        throw new Error("Option indices for each poll must be provided");
      }
      
      if (pollIndices.length !== optionIndicesPerPoll.length) {
        throw new Error("Number of poll indices must match number of option index arrays");
      }
      
      for (let i = 0; i < pollIndices.length; i++) {
        if (pollIndices[i] < 1) {
          throw new Error(`Poll index at position ${i} must be 1 or greater`);
        }
        
        if (!optionIndicesPerPoll[i] || !Array.isArray(optionIndicesPerPoll[i]) || optionIndicesPerPoll[i].length === 0) {
          throw new Error(`At least one option must be selected for poll index ${pollIndices[i]}`);
        }
      }
      
      if (payment < 0) {
        throw new Error("Payment amount must be non-negative");
      }
      
      console.log(`Casting votes on ${pollIndices.length} polls of vote ${voteId}`);
      
      const tx = new Transaction();
      
      // Create payment coin if needed
      let paymentCoin;
      if (payment > 0) {
        // Split payment from gas coin
        [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure(payment)]);
      } else {
        // Create an empty coin if no payment is required
        [paymentCoin] = tx.splitCoins(tx.gas, [tx.pure(0)]);
      }
      
      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cast_multiple_votes`,
        arguments: [
          tx.object(voteId),
          tx.object(ADMIN_ID),
          tx.pure(pollIndices),
          tx.pure(optionIndicesPerPoll),
          paymentCoin,
          clockObj
        ],
      });
      
      return tx;
    } catch (error) {
      console.error(`Failed to create cast multiple votes transaction:`, error);
      throw new Error(`Failed to cast multiple votes: ${(error instanceof Error) ? error.message : String(error)}`);
    }
  }

  /**
   * Close a vote (can be called by creator or after end time)
   * @param voteId Vote object ID
   * @returns Transaction to be signed
   */
  closeVote(voteId: string): Transaction {
    try {
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      console.log(`Closing vote ${voteId}`);
      
      const tx = new Transaction();
      
      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::close_vote`,
        arguments: [
          tx.object(voteId),
          clockObj
        ],
      });
      
      return tx;
    } catch (error) {
      console.error(`Failed to create close vote transaction:`, error);
      throw new Error(`Failed to close vote: ${(error instanceof Error) ? error.message : String(error)}`);
    }
  }

  /**
   * Cancel a vote (only by creator, only before start)
   * @param voteId Vote object ID
   * @returns Transaction to be signed
   */
  cancelVote(voteId: string): Transaction {
    try {
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      console.log(`Cancelling vote ${voteId}`);
      
      const tx = new Transaction();
      
      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::cancel_vote`,
        arguments: [
          tx.object(voteId),
          clockObj
        ],
      });
      
      return tx;
    } catch (error) {
      console.error(`Failed to create cancel vote transaction:`, error);
      throw new Error(`Failed to cancel vote: ${(error instanceof Error) ? error.message : String(error)}`);
    }
  }

  /**
   * Extend voting period (only by creator)
   * @param voteId Vote object ID
   * @param newEndTimestamp New end timestamp in milliseconds
   * @returns Transaction to be signed
   */
  extendVotingPeriod(
    voteId: string,
    newEndTimestamp: number
  ): Transaction {
    try {
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      if (!newEndTimestamp || newEndTimestamp <= Date.now()) {
        throw new Error("New end timestamp must be in the future");
      }
      
      console.log(`Extending voting period for vote ${voteId} to ${new Date(newEndTimestamp).toISOString()}`);
      
      const tx = new Transaction();
      
      // Get the clock object
      const clockObj = tx.object(SUI_CLOCK_OBJECT_ID);
      
      tx.moveCall({
        target: `${PACKAGE_ID}::voting::extend_voting_period`,
        arguments: [
          tx.object(voteId),
          tx.pure(newEndTimestamp),
          clockObj
        ],
      });
      
      return tx;
    } catch (error) {
      console.error(`Failed to create extend voting period transaction:`, error);
      throw new Error(`Failed to extend voting period: ${(error instanceof Error) ? error.message : String(error)}`);
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
      if (!userAddress) {
        throw new Error("User address is required");
      }
      
      if (!voteId) {
        throw new Error("Vote ID is required");
      }
      
      console.log(`Checking if user ${userAddress} has voted on vote ${voteId}`);
      
      // Query for VoteCast events with this user and vote ID
      const { data } = await this.client.queryEvents({
        query: {
          And: [
            {
              MoveEventType: `${PACKAGE_ID}::voting::VoteCast`
            },
            {
              MoveEventField: {
                path: '/voter',
                value: userAddress
              }
            },
            {
              MoveEventField: {
                path: '/vote_id',
                value: voteId
              }
            }
          ]
        },
        limit: 1
      });
      
      const hasVoted = data.length > 0;
      console.log(`User ${userAddress} has ${hasVoted ? '' : 'not '}voted on vote ${voteId}`);
      
      return hasVoted;
    } catch (error) {
      console.error(`Failed to check if user ${userAddress} has voted on vote ${voteId}:`, error);
      return false;
    }
  }

  /**
   * Verify if a user meets token requirements for a vote
   * This function is performed on the frontend to avoid on-chain verification
   * @param walletAddress The user's wallet address
   * @param tokenType The required token type
   * @param requiredAmount The required token amount
   * @returns Verification result
   */
  async verifyTokenRequirements(
    walletAddress: string,
    tokenType: string,
    requiredAmount: number
  ): Promise<TokenVerificationResult> {
    try {
      if (!walletAddress) {
        throw new Error("Wallet address is required");
      }
      
      // If no token requirement, return valid immediately
      if (!tokenType) {
        return { isValid: true, balance: BigInt(0) };
      }
      
      console.log(`Verifying token requirements for ${walletAddress}, token: ${tokenType}, amount: ${requiredAmount}`);
      
      // Get all coins of the required type owned by the user
      const { data: coins } = await this.client.getCoins({
        owner: walletAddress,
        coinType: tokenType,
      });
      
      console.log(`Found ${coins.length} coins of type ${tokenType}`);
      
      // Calculate total balance
      const totalBalance = coins.reduce((sum, coin) => {
        return sum + BigInt(coin.balance);
      }, BigInt(0));
      
      // Check if balance is sufficient
      const isValid = totalBalance >= BigInt(requiredAmount);
      
      console.log(`Total balance: ${totalBalance}, required: ${requiredAmount}, isValid: ${isValid}`);
      
      return {
        isValid,
        balance: totalBalance,
        error: isValid ? undefined : 'Insufficient token balance'
      };
    } catch (error) {
      console.error(`Failed to verify token requirements for ${walletAddress}:`, error);
      return {
        isValid: false,
        balance: BigInt(0),
        error: `Token verification error: ${(error instanceof Error) ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get vote results if available
   * @param voteId Vote object ID
   * @returns Vote results or null if not available
   */
  async getVoteResults(voteId: string): Promise<Record<string, PollOptionDetails[]> | null> {
    try {
      if (!voteId) {
        console.warn("Empty voteId provided to getVoteResults");
        return null;
      }
      
      console.log(`Getting vote results for vote ${voteId}`);
      
      // First check if vote is closed
      const voteDetails = await this.getVoteDetails(voteId);
      if (!voteDetails) return null;
      
      // Only return results if vote is closed or is active
      if (voteDetails.status !== 'closed' && voteDetails.status !== 'active') {
        console.log(`Vote ${voteId} is ${voteDetails.status}, results not available`);
        return null;
      }
      
      // Get all polls first
      const polls = await this.getVotePolls(voteId);
      if (!polls || polls.length === 0) return null;
      
      console.log(`Found ${polls.length} polls for vote ${voteId}`);
      
      // Fetch options for each poll in parallel
      const pollOptionsPromises: Array<Promise<{ pollId: string, options: PollOptionDetails[] }>> = [];
      
      for (let i = 0; i < polls.length; i++) {
        const pollIndex = i + 1; // Polls are 1-indexed
        pollOptionsPromises.push(
          (async () => {
            const options = await this.getPollOptions(voteId, pollIndex);
            return {
              pollId: polls[i].id,
              options: options || []
            };
          })()
        );
      }
      
      const pollOptionsResults = await Promise.all(pollOptionsPromises);
      
      // Combine results into a record
      const results: Record<string, PollOptionDetails[]> = {};
      for (const { pollId, options } of pollOptionsResults) {
        if (options.length > 0) {
          results[pollId] = options;
        }
      }
      
      console.log(`Successfully retrieved results for ${Object.keys(results).length} polls`);
      
      return results;
    } catch (error) {
      console.error(`Failed to get vote results for vote ${voteId}:`, error);
      return null;
    }
  }
}