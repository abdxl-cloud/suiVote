/// @title SuiVote: A streamlined decentralized voting platform on Sui
/// @version 1.1.0
/// @notice This module implements an optimized voting system with reduced on-chain operations
/// @dev Functionality that can be handled by the frontend has been moved off-chain
/// @dev Weighting Priority System: Whitelist weighting > Payment weighting > Token requirement weighting
/// @dev Only one weighting mechanism can be active per vote to prevent conflicts
module contracts::voting {
    use sui::dynamic_object_field as dof;
    use sui::dynamic_field;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};

    // ===== Constants =====
    const CURRENT_VERSION: u64 = 1;

    // ===== Error codes =====
    const EInvalidTimestamp: u64 = 0;
    const ENotAuthorized: u64 = 1;
    const EPollNotActive: u64 = 2;
    const EPollClosed: u64 = 3;
    const EInsufficientPayment: u64 = 4;
    const EInvalidOptionIndex: u64 = 6;
    const ETooManyOptions: u64 = 7;
    const ERequiredOptionNotSelected: u64 = 8;
    const EPollNotFound: u64 = 10;
    const EInvalidSelection: u64 = 11;
    const EInvalidPollCount: u64 = 12;
    const EInvalidInputLength: u64 = 14;
    const ENotWhitelisted: u64 = 15;
    const EInvalidTokenWeightRatio: u64 = 16;
    const EInvalidTokenBalance: u64 = 17;
    const EUpgradeNotNeeded: u64 = 18;
    const EReentrancyDetected: u64 = 19;
    const EInvalidStringLength: u64 = 20;
    const EInvalidVectorLength: u64 = 21;
    const EOverflow: u64 = 22;
    const EZeroDivision: u64 = 23;
    const EInvalidVoteWeight: u64 = 24;
    const EInvalidTokenAmount: u64 = 25;
    
    // ===== Security Constants =====
    const MIN_STRING_LENGTH: u64 = 1;
    const MAX_STRING_LENGTH: u64 = 1000;
    const MAX_DESCRIPTION_LENGTH: u64 = 5000;
    const MAX_URL_LENGTH: u64 = 2000;
    const MAX_VECTOR_LENGTH: u64 = 100;
    const MAX_POLLS_PER_VOTE: u64 = 50;
    const MAX_OPTIONS_PER_POLL: u64 = 20;
    const MAX_SELECTIONS_PER_POLL: u64 = 10;
    const MAX_WHITELIST_SIZE: u64 = 10000;
    const MAX_PAYMENT_AMOUNT: u64 = 1000000000000; // 1000 SUI in MIST
    const MAX_TOKENS_PER_VOTE: u64 = 1000000000000;
    const MAX_VOTE_WEIGHT: u64 = 1000000;
    const MIN_VOTING_DURATION: u64 = 3600000; // 1 hour in milliseconds
    const MAX_VOTING_DURATION: u64 = 31536000000; // 1 year in milliseconds

    // ===== Capability objects =====
    
    /// Admin capability for the platform
    public struct VoteAdmin has key {
        id: UID,
        total_votes_created: u64,
        total_votes_cast: u64
    }

    // ===== Core data structures =====
    
    /// Main vote container - with new token requirement fields, whitelist flag, and version
    public struct Vote has key, store {
        id: UID,
        creator: address,
        title: String,
        description: String,
        start_timestamp: u64,
        end_timestamp: u64,
        payment_amount: u64,
        require_all_polls: bool,
        polls_count: u64,
        total_votes: u64,
        is_cancelled: bool,
        token_requirement: Option<String>,
        token_amount: Option<u64>,
        has_whitelist: bool,
        show_live_stats: bool,
        use_token_weighting: bool,  
        tokens_per_vote: u64,
        use_payment_weighting: bool,
        payment_token_weight: u64,
        version: u64,
        // Security fields
        is_locked: bool, // Reentrancy protection
        creation_timestamp: u64 // For additional validation
    }

    /// Simple struct to mark addresses as whitelisted (legacy)
    public struct WhitelistMarker has store, copy, drop {}
    
    /// Enhanced whitelist entry with weight support
    public struct WhitelistEntry has store, copy, drop {
        weight: u64
    }

    /// Individual poll in a vote
    public struct Poll has key, store {
        id: UID,
        title: String,
        description: String,
        is_multi_select: bool,
        max_selections: u64,
        is_required: bool,
        options_count: u64,
        total_responses: u64
    }

    /// Poll option
    public struct PollOption has key, store {
        id: UID,
        text: String,
        media_url: Option<String>,
        votes: u64
    }

    // ===== Events =====
    
    /// Emitted when a new vote is created
    public struct VoteCreated has copy, drop {
        vote_id: ID,
        creator: address,
        title: String,
        start_timestamp: u64,
        end_timestamp: u64,
        polls_count: u64,
        token_requirement: Option<String>,
        token_amount: Option<u64>,
        has_whitelist: bool,
        show_live_stats: bool,
        use_token_weighting: bool,
        tokens_per_vote: u64,
        use_payment_weighting: bool,
        payment_token_weight: u64,
        version: u64
    }

    /// Emitted when a vote is cast
    public struct VoteCast has copy, drop {
        vote_id: ID,
        poll_id: ID,
        voter: address,
        option_indices: vector<u64>,
        token_balance: u64,
        vote_weight: u64     
    }

    /// Emitted when a poll is added to a vote
    public struct PollAdded has copy, drop {
        vote_id: ID,
        poll_id: ID,
        poll_index: u64,
        title: String
    }

    /// Emitted when an option is added to a poll
    public struct OptionAdded has copy, drop {
        vote_id: ID,
        poll_id: ID,
        option_id: ID,
        option_index: u64,
        text: String
    }

    /// Emitted when a vote is closed
    public struct VoteClosed has copy, drop {
        vote_id: ID,
        total_votes: u64
    }

    /// Emitted when a vote is cancelled
    public struct VoteCancelled has copy, drop {
        vote_id: ID,
        creator: address,
        timestamp: u64
    }

    /// Emitted when a vote is deleted
    public struct VoteDeleted has copy, drop {
        vote_id: ID,
        creator: address,
        timestamp: u64
    }

    /// Emitted when a vote is updated
    public struct VoteUpdated has copy, drop {
        vote_id: ID,
        creator: address,
        timestamp: u64
    }

    /// Emitted when a poll is updated
    public struct PollUpdated has copy, drop {
        vote_id: ID,
        poll_id: ID,
        poll_index: u64,
        timestamp: u64
    }

    /// Emitted when a poll option is updated
    public struct OptionUpdated has copy, drop {
        vote_id: ID,
        poll_id: ID,
        option_id: ID,
        poll_index: u64,
        option_index: u64,
        timestamp: u64
    }

    /// Emitted when an address is added to the allowed voters list
    public struct VoterWhitelisted has copy, drop {
        vote_id: ID,
        voter_address: address
    }

    /// Emitted when a vote is upgraded
    public struct VoteUpgraded has copy, drop {
        vote_id: ID,
        creator: address,
        old_version: u64,
        new_version: u64
    }

    // ===== Initialization =====
    
    /// Initialize the admin object
    fun init(ctx: &mut TxContext) {
        transfer::share_object(VoteAdmin {
            id: object::new(ctx),
            total_votes_created: 0,
            total_votes_cast: 0
        });
    }

    // ===== Vote creation and management =====
    
    /// Create a new vote with its initial configuration, including token requirements and whitelist
    public entry fun create_vote(
        title: String,
        description: String,
        start_timestamp: u64,
        end_timestamp: u64,
        payment_amount: u64,
        require_all_polls: bool,
        token_requirement: String,
        token_amount: u64,
        show_live_stats: bool, 
        use_token_weighting: bool,
        mut tokens_per_vote: u64,
        use_payment_weighting: bool,
        payment_token_weight: u64,
        whitelist_addresses: vector<address>,
        voter_weights: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // ===== Input Validation =====
        // Validate string lengths
        assert!(string::length(&title) >= MIN_STRING_LENGTH && string::length(&title) <= MAX_STRING_LENGTH, EInvalidStringLength);
        assert!(string::length(&description) <= MAX_STRING_LENGTH, EInvalidStringLength);
        assert!(string::length(&token_requirement) <= MAX_STRING_LENGTH, EInvalidStringLength);
        
        // Validate vector lengths
        assert!(vector::length(&whitelist_addresses) <= MAX_VECTOR_LENGTH, EInvalidVectorLength);
        assert!(vector::length(&voter_weights) <= MAX_VECTOR_LENGTH, EInvalidVectorLength);
        
        // Validate timestamp ranges
        let current_time = clock::timestamp_ms(clock);
        // Description is optional, so allow empty strings
        assert!(string::length(&description) <= MAX_DESCRIPTION_LENGTH, EInvalidStringLength);
        
        // Timestamp validation
        assert!(start_timestamp >= current_time, EInvalidTimestamp);
        assert!(end_timestamp > start_timestamp, EInvalidTimestamp);
        assert!(end_timestamp <= start_timestamp + MAX_VOTING_DURATION, EInvalidTimestamp);
        
        // Payment validation
        assert!(payment_amount <= MAX_PAYMENT_AMOUNT, EOverflow);
        
        // Validate voting duration
        let voting_duration = end_timestamp - start_timestamp;
        assert!(voting_duration >= MIN_VOTING_DURATION, EInvalidTimestamp);
        assert!(voting_duration <= MAX_VOTING_DURATION, EInvalidTimestamp);
        
        // Validate whitelist consistency
        if (!vector::is_empty(&voter_weights)) {
            assert!(vector::length(&whitelist_addresses) == vector::length(&voter_weights), EInvalidVectorLength);
        };
        
        // Validate overflow protection for payment amount
        assert!(payment_amount < 18446744073709551615, EOverflow); // Max u64 - 1

        let token_req = if (string::length(&token_requirement) > 0) {
            option::some(token_requirement)
        } else {
            option::none()
        };


        let mut token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };
        // Validate weighting mechanism combinations
        let has_whitelist = !vector::is_empty(&whitelist_addresses);
        let has_whitelist_weighting = has_whitelist && !vector::is_empty(&voter_weights);
        
        // Whitelist weighting (custom weights) cannot be combined with other weighting mechanisms
        // But basic whitelist (access control) can be combined with payment/token weighting
        let weighting_count = (if (has_whitelist_weighting) 1 else 0) + 
                             (if (use_payment_weighting) 1 else 0) + 
                             (if (use_token_weighting) 1 else 0);
        assert!(weighting_count <= 1, EInvalidTokenWeightRatio); // Reusing error code for weighting conflicts
        
        if (use_token_weighting || use_payment_weighting) {
    
            assert!(option::is_some(&token_req), EInvalidTokenWeightRatio);
            
    
            if (tokens_per_vote == 0 && option::is_some(&token_amt)) {
                tokens_per_vote = option::extract(&mut token_amt);
            token_amt = option::some(tokens_per_vote);
            } else {
        
                assert!(tokens_per_vote > 0, EInvalidTokenWeightRatio);
            };
        } else {
    
            tokens_per_vote = 0;
        };


        let payment_in_mist = payment_amount;


        let mut vote = Vote {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            title,
            description,
            start_timestamp,
            end_timestamp,
            payment_amount: payment_in_mist,
            require_all_polls,
            polls_count: 0,
            total_votes: 0,
            is_cancelled: false,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: !vector::is_empty(&whitelist_addresses),
            show_live_stats,
            use_token_weighting,
            tokens_per_vote,
            use_payment_weighting,
            payment_token_weight,
            version: CURRENT_VERSION,
            // Initialize security fields
            is_locked: false,
            creation_timestamp: current_time
        };

        let vote_id = object::id(&vote);
        
        if (vote.has_whitelist) {
            let creator = vote.creator;
            
            if (vote.version >= 2) {
                let creator_entry = WhitelistEntry { weight: 1 };
                dynamic_field::add(&mut vote.id, creator, creator_entry);
            } else {
                let creator_marker = WhitelistMarker {};
                dynamic_field::add(&mut vote.id, creator, creator_marker);
            };
            
            event::emit(VoterWhitelisted {
                vote_id,
                voter_address: creator
            });
            
            if (!vector::is_empty(&whitelist_addresses)) {
                if (!vector::is_empty(&voter_weights)) {
                    add_allowed_voters_with_weights(&mut vote, whitelist_addresses, voter_weights, clock, ctx);
                } else {
                    add_allowed_voters(&mut vote, whitelist_addresses, clock, ctx);
                };
            };
        };
        
        // Admin tracking removed - anyone can create votes now
        
        event::emit(VoteCreated {
            vote_id,
            creator: tx_context::sender(ctx),
            title,
            start_timestamp,
            end_timestamp,
            polls_count: 0,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: vote.has_whitelist,
            show_live_stats,
            use_token_weighting,
            tokens_per_vote,
            use_payment_weighting,
            payment_token_weight,
            version: vote.version
        });

        transfer::share_object(vote);
    }
    
    public entry fun add_poll(
        vote: &mut Vote,
        title: String,
        description: String,
        is_multi_select: bool,
        max_selections: u64,
        is_required: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // ===== Security Checks =====
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        // Authorization check
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Input validation
        assert!(string::length(&title) > 0 && string::length(&title) <= MAX_STRING_LENGTH, EInvalidStringLength);
        assert!(string::length(&description) <= MAX_STRING_LENGTH, EInvalidStringLength);
        assert!(vote.polls_count < MAX_POLLS_PER_VOTE, EInvalidPollCount);
        
        // Validate max_selections
        if (is_multi_select) {
            assert!(max_selections > 0 && max_selections <= MAX_SELECTIONS_PER_POLL, EInvalidSelection);
        };
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        assert!(!vote.is_cancelled, EPollClosed);

        let poll = Poll {
            id: object::new(ctx),
            title,
            description,
            is_multi_select,
            max_selections: if (is_multi_select) { max_selections } else { 1 },
            is_required,
            options_count: 0,
            total_responses: 0
        };
        
        let poll_index = safe_add(vote.polls_count, 1);
        let poll_id = object::id(&poll);
        let vote_id = object::id(vote);
        
        dof::add(&mut vote.id, poll_index, poll);
        vote.polls_count = poll_index;
        
        event::emit(PollAdded {
            vote_id,
            poll_id,
            poll_index,
            title
        });
        
        // Release lock
        vote.is_locked = false;
    }

    public entry fun add_poll_option(
        vote: &mut Vote,
        poll_index: u64,
        text: String,
        media_url: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // ===== Security Checks =====
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        // Authorization check
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Input validation
        assert!(string::length(&text) > 0 && string::length(&text) <= MAX_STRING_LENGTH, EInvalidStringLength);
        assert!(vector::length(&media_url) <= MAX_STRING_LENGTH, EInvalidVectorLength);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        assert!(!vote.is_cancelled, EPollClosed);
        
        let vote_id = object::id(vote);
        
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        assert!(dof::exists_(&vote.id, poll_index), EPollNotFound);
        
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        
        // Validate option count limit
        assert!(poll.options_count < MAX_OPTIONS_PER_POLL, ETooManyOptions);
        
        let media = if (vector::length(&media_url) > 0) {
            option::some(string::utf8(media_url))
        } else {
            option::none()
        };
        
        let option = PollOption {
            id: object::new(ctx),
            text,
            media_url: media,
            votes: 0
        };
        
        let option_index = safe_add(poll.options_count, 1);
        let option_id = object::id(&option);
        let poll_id = object::id(poll);
        
        dof::add(&mut poll.id, option_index, option);
        poll.options_count = option_index;
        
        event::emit(OptionAdded {
            vote_id,
            poll_id,
            option_id,
            option_index,
            text
        });
        
        // Release lock
        vote.is_locked = false;
    }

    /// Add allowed voters to the whitelist
    public entry fun add_allowed_voters(
        vote: &mut Vote,
        voters: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let weights = vector::empty<u64>();
        add_allowed_voters_with_weights(vote, voters, weights, clock, ctx);
    }
    
    /// Add allowed voters to the whitelist with custom weights
    public entry fun add_allowed_voters_with_weights(
        vote: &mut Vote,
        voters: vector<address>,
        weights: vector<u64>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        // Only creator can add allowed voters
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can't modify after voting has started
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Can't modify if vote is cancelled
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Input validation
        let voter_count = vector::length(&voters);
        assert!(voter_count > 0 && voter_count <= MAX_WHITELIST_SIZE, EInvalidInputLength);
        
        // Validate weights vector length if provided
        let has_weights = !vector::is_empty(&weights);
        if (has_weights) {
            assert!(vector::length(&weights) == voter_count, EInvalidInputLength);
            
            // Validate individual weights
            let mut j = 0;
            while (j < vector::length(&weights)) {
                let weight = *vector::borrow(&weights, j);
                assert!(weight > 0 && weight <= MAX_VOTE_WEIGHT, EInvalidVoteWeight);
                j = j + 1;
            };
        };
        
        // Store vote_id before mutable borrows
        let vote_id = object::id(vote);
        
        // Set the whitelist flag to true
        vote.has_whitelist = true;
        
        // Add the allowed voters as dynamic fields
        let mut i = 0;
        let voter_count = vector::length(&voters);
        
        while (i < voter_count) {
            let voter = *vector::borrow(&voters, i);
            
            // Only add if voter not already whitelisted
            if (!dynamic_field::exists_(&vote.id, voter)) {
                if (has_weights && vote.version >= 2) {
                    // Use new WhitelistEntry with weight for version 2+
                    let weight = *vector::borrow(&weights, i);
                    let entry = WhitelistEntry { weight };
                    dynamic_field::add(&mut vote.id, voter, entry);
                } else {
                    // Use legacy WhitelistMarker for backward compatibility
                    let marker = WhitelistMarker {};
                    dynamic_field::add(&mut vote.id, voter, marker);
                };
                
                // Emit event for each whitelisted voter for frontend tracking
                event::emit(VoterWhitelisted {
                    vote_id,
                    voter_address: voter
                });
            };
            
            i = i + 1;
        };
        
        // Release reentrancy lock
        vote.is_locked = false;
    }
    
    /// New function: Ensure vote creator is whitelisted for their own vote
    public entry fun ensure_creator_whitelisted(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        // Only call before voting starts
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Only creator can ensure themselves
        let sender = tx_context::sender(ctx);
        assert!(vote.creator == sender, ENotAuthorized);
        
        // Only relevant if whitelist is enabled
        if (vote.has_whitelist) {
            // Check if creator is already whitelisted
            if (!dynamic_field::exists_(&vote.id, vote.creator)) {
                // Add creator to whitelist
                let marker = WhitelistMarker {};
                dynamic_field::add(&mut vote.id, vote.creator, marker);
                
                event::emit(VoterWhitelisted {
                    vote_id: object::id(vote),
                    voter_address: vote.creator
                });
            };
        };
        
        // Release reentrancy lock
        vote.is_locked = false;
    }
    
    /// Upgrade helper function for existing votes
    public entry fun upgrade_vote_to_current_version(
        vote: &mut Vote,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        // Only creator can upgrade
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Store current version for event
        let old_version = vote.version;
        
        // Check if upgrade needed
        if (vote.version < CURRENT_VERSION) {
            // Perform version-specific upgrades
            
            // For version 0 to 1 (whitelist creator fix)
            if (vote.version < 1 && vote.has_whitelist && !dynamic_field::exists_(&vote.id, vote.creator)) {
                let marker = WhitelistMarker {};
                dynamic_field::add(&mut vote.id, vote.creator, marker);
                
                event::emit(VoterWhitelisted {
                    vote_id: object::id(vote),
                    voter_address: vote.creator
                });
            };
            

            
            // Set to current version
            vote.version = CURRENT_VERSION;
            
            // Emit upgrade event
            event::emit(VoteUpgraded {
                vote_id: object::id(vote),
                creator: vote.creator,
                old_version,
                new_version: CURRENT_VERSION
            });
        } else {
            // Already at current version
            assert!(false, EUpgradeNotNeeded);
        };
        
        // Release reentrancy lock
        vote.is_locked = false;
    }
    
    /// Create a complete vote with polls and options in a single transaction, including token weighting
    public entry fun create_complete_vote(
        title: String,
        description: String,
        start_timestamp: u64,
        end_timestamp: u64,
        payment_amount: u64,
        require_all_polls: bool,
        token_requirement: vector<u8>,
        token_amount: u64,
        show_live_stats: bool,
        use_token_weighting: bool,
        mut tokens_per_vote: u64,
        use_payment_weighting: bool,
        payment_token_weight: u64,
        voter_weights: vector<u64>,
        poll_titles: vector<String>,
        poll_descriptions: vector<String>,
        poll_is_multi_select: vector<bool>,
        poll_max_selections: vector<u64>,
        poll_is_required: vector<bool>,
        poll_option_counts: vector<u64>,
        poll_option_texts: vector<String>,
        poll_option_media_urls: vector<vector<u8>>,
        whitelist_addresses: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {

        let current_time = clock::timestamp_ms(clock);
        
        // Input validation for strings
        assert!(string::length(&title) >= MIN_STRING_LENGTH && string::length(&title) <= MAX_STRING_LENGTH, EInvalidStringLength);
        // Description is optional, so allow empty strings
        assert!(string::length(&description) <= MAX_DESCRIPTION_LENGTH, EInvalidStringLength);
        
        // Timestamp validation
        assert!(start_timestamp >= current_time, EInvalidTimestamp);
        assert!(end_timestamp > start_timestamp, EInvalidTimestamp);
        assert!(end_timestamp <= start_timestamp + MAX_VOTING_DURATION, EInvalidTimestamp);
        
        // Payment validation
        assert!(payment_amount <= MAX_PAYMENT_AMOUNT, EOverflow);


        let poll_count = vector::length(&poll_titles);
        assert!(poll_count > 0 && poll_count <= MAX_POLLS_PER_VOTE, EInvalidPollCount);
        assert!(poll_count == vector::length(&poll_descriptions), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_is_multi_select), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_max_selections), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_is_required), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_option_counts), EInvalidInputLength);
        
        // Validate whitelist size
        let whitelist_count = vector::length(&whitelist_addresses);
        assert!(whitelist_count <= MAX_WHITELIST_SIZE, EInvalidInputLength);
        
        // Validate individual poll titles and descriptions
        let mut i = 0;
        while (i < poll_count) {
            let poll_title = vector::borrow(&poll_titles, i);
            let poll_desc = vector::borrow(&poll_descriptions, i);
            let max_selections = *vector::borrow(&poll_max_selections, i);
            let option_count = *vector::borrow(&poll_option_counts, i);
            
            // Poll title is required
            assert!(string::length(poll_title) >= MIN_STRING_LENGTH && string::length(poll_title) <= MAX_STRING_LENGTH, EInvalidStringLength);
            // Poll description is optional, so allow empty strings
            assert!(string::length(poll_desc) <= MAX_DESCRIPTION_LENGTH, EInvalidStringLength);
            assert!(max_selections > 0 && max_selections <= MAX_OPTIONS_PER_POLL, EInvalidSelection);
            assert!(option_count > 0 && option_count <= MAX_OPTIONS_PER_POLL, EInvalidOptionIndex);
            
            i = i + 1;
        };
        
        // Validate voter weights if provided
        if (!vector::is_empty(&voter_weights)) {
            assert!(vector::length(&voter_weights) == whitelist_count, EInvalidInputLength);
            let mut j = 0;
            while (j < vector::length(&voter_weights)) {
                let weight = *vector::borrow(&voter_weights, j);
                assert!(weight > 0 && weight <= MAX_VOTE_WEIGHT, EInvalidVoteWeight);
                j = j + 1;
            };
        };


        let token_req = if (vector::length(&token_requirement) > 0) {
            option::some(string::utf8(token_requirement))
        } else {
            option::none()
        };


        let mut token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };
        
        // Validate weighting mechanism combinations
        let has_whitelist = !vector::is_empty(&whitelist_addresses);
        let has_whitelist_weighting = has_whitelist && !vector::is_empty(&voter_weights);
        
        // Whitelist weighting (custom weights) cannot be combined with other weighting mechanisms
        // But basic whitelist (access control) can be combined with payment/token weighting
        let weighting_count = (if (has_whitelist_weighting) 1 else 0) + 
                             (if (use_payment_weighting) 1 else 0) + 
                             (if (use_token_weighting) 1 else 0);
        assert!(weighting_count <= 1, EInvalidTokenWeightRatio); // Reusing error code for weighting conflicts

        if (use_token_weighting || use_payment_weighting) {
    
            assert!(option::is_some(&token_req), EInvalidTokenWeightRatio);
            
    
            if (tokens_per_vote == 0 && option::is_some(&token_amt)) {
                tokens_per_vote = option::extract(&mut token_amt);
            token_amt = option::some(tokens_per_vote);
            } else {
        
                assert!(tokens_per_vote > 0, EInvalidTokenWeightRatio);
            };
        } else {
    
            tokens_per_vote = 0;
        };


        let payment_in_mist = payment_amount;


        let mut vote = Vote {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            title,
            description,
            start_timestamp,
            end_timestamp,
            payment_amount: payment_in_mist,
            require_all_polls,
            polls_count: 0,
            total_votes: 0,
            is_cancelled: false,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: !vector::is_empty(&whitelist_addresses),
            show_live_stats,
            use_token_weighting,
            tokens_per_vote,
            use_payment_weighting,
            payment_token_weight,
            version: CURRENT_VERSION,
            // Initialize security fields
            is_locked: false,
            creation_timestamp: current_time
        };

        let vote_id = object::id(&vote);

        // FIXED: Process polls and options with guaranteed ordering
        let mut option_text_index = 0;
        let mut option_media_index = 0;
        
        // Create polls in sequential order (1-based indexing)
        let mut poll_counter = 0;
        while (poll_counter < poll_count) {
            // Create poll with guaranteed index
            let poll_index = poll_counter + 1; // 1-based indexing
            
            let poll = Poll {
                id: object::new(ctx),
                title: *vector::borrow(&poll_titles, poll_counter),
                description: *vector::borrow(&poll_descriptions, poll_counter),
                is_multi_select: *vector::borrow(&poll_is_multi_select, poll_counter),
                max_selections: if (*vector::borrow(&poll_is_multi_select, poll_counter)) { 
                    *vector::borrow(&poll_max_selections, poll_counter)
                } else { 
                    1 
                },
                is_required: *vector::borrow(&poll_is_required, poll_counter),
                options_count: 0,
                total_responses: 0
            };

            let poll_id = object::id(&poll);
            
            // CRITICAL: Store poll with guaranteed sequential index
            dof::add(&mut vote.id, poll_index, poll);
            vote.polls_count = poll_index; // Update count to match index
            
            // Emit event with correct index
            event::emit(PollAdded {
                vote_id,
                poll_id,
                poll_index,
                title: *vector::borrow(&poll_titles, poll_counter)
            });

            // Now add options to this poll in guaranteed order
            let option_count_for_this_poll = *vector::borrow(&poll_option_counts, poll_counter);
            let mut option_counter = 0;
            
            while (option_counter < option_count_for_this_poll) {
                // Get mutable reference to the poll we just added
                let poll_ref: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
                
                // Create option with guaranteed index
                let option_index = option_counter + 1; // 1-based indexing
                
                let option_text = *vector::borrow(&poll_option_texts, option_text_index);
                let option_media_url = *vector::borrow(&poll_option_media_urls, option_media_index);

                let media = if (vector::length(&option_media_url) > 0) {
                    option::some(string::utf8(option_media_url))
                } else {
                    option::none()
                };

                let option = PollOption {
                    id: object::new(ctx),
                    text: option_text,
                    media_url: media,
                    votes: 0
                };

                let option_id = object::id(&option);
                
                // CRITICAL: Store option with guaranteed sequential index
                dof::add(&mut poll_ref.id, option_index, option);
                poll_ref.options_count = option_index; // Update count to match index
                
                // Emit event with correct indices
                event::emit(OptionAdded {
                    vote_id,
                    poll_id,
                    option_id,
                    option_index,
                    text: option_text
                });

                // Increment global counters
                option_text_index = option_text_index + 1;
                option_media_index = option_media_index + 1;
                option_counter = option_counter + 1;
            };

            poll_counter = poll_counter + 1;
        };
        
        if (vote.has_whitelist) {
            let creator = vote.creator;
            
            if (vote.version >= 2) {
                let creator_entry = WhitelistEntry { weight: 1 };
                dynamic_field::add(&mut vote.id, creator, creator_entry);
            } else {
                let creator_marker = WhitelistMarker {};
                dynamic_field::add(&mut vote.id, creator, creator_marker);
            };
            
            event::emit(VoterWhitelisted {
                vote_id,
                voter_address: creator
            });
            
            if (!vector::is_empty(&whitelist_addresses)) {
                if (!vector::is_empty(&voter_weights)) {
                    add_allowed_voters_with_weights(&mut vote, whitelist_addresses, voter_weights, clock, ctx);
                } else {
                    add_allowed_voters(&mut vote, whitelist_addresses, clock, ctx);
                };
            };
        };
        
        // Update admin stats
        // Admin tracking removed - anyone can create votes now
        

        event::emit(VoteCreated {
            vote_id,
            creator: tx_context::sender(ctx),
            title,
            start_timestamp,
            end_timestamp,
            polls_count: vote.polls_count,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: vote.has_whitelist,
            show_live_stats,
            use_token_weighting,
            tokens_per_vote,
            use_payment_weighting,
            payment_token_weight,
            version: vote.version
        });


        transfer::share_object(vote);
    }

    /// Cast a vote on a poll - with whitelist check
    public entry fun cast_vote(
        vote: &mut Vote,
        admin: &mut VoteAdmin,
        poll_index: u64,
        token_balance: u64,
        option_indices: vector<u64>,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // ===== Security Checks =====
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Input validation
        assert!(vector::length(&option_indices) > 0, EInvalidSelection);
        assert!(vector::length(&option_indices) <= MAX_SELECTIONS_PER_POLL, EInvalidVectorLength);
        
        // Timing validation
        assert!(current_time >= vote.start_timestamp, EPollNotActive);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Overflow protection for vote counts
        assert!(vote.total_votes < 18446744073709551615, EOverflow);
        assert!(admin.total_votes_cast < 18446744073709551615, EOverflow);
        

        if (vote.has_whitelist) {
            assert!(dynamic_field::exists_(&vote.id, sender), ENotWhitelisted);
        };
        
        if (option::is_some(&vote.token_requirement) && option::is_some(&vote.token_amount)) {
            let min_token_amount = option::borrow(&vote.token_amount);
            assert!(token_balance >= *min_token_amount, EInvalidTokenBalance);
        };

        let mut actual_payment_amount = 0u64;
        let mut minimum_payment = 0u64;
        
        if (vote.payment_amount > 0 || (vote.use_payment_weighting)) {
            let payment_value = coin::value(&payment);
            
            // For payment weighting, minimum payment is payment_token_weight
            minimum_payment = if (vote.use_payment_weighting && vote.payment_token_weight > 0) {
                vote.payment_token_weight
            } else {
                vote.payment_amount
            };
            
            assert!(payment_value >= minimum_payment, EInsufficientPayment);
            
            // For payment weighting, calculate the actual payment amount based on minimum_payment
            if (vote.use_payment_weighting && minimum_payment > 0) {
                // Calculate how many vote weights the user can afford
                let max_vote_weights = safe_div(payment_value, minimum_payment);
                // Calculate the exact payment amount (no fractional weights)
                actual_payment_amount = safe_mul(max_vote_weights, minimum_payment);
                
                // Ensure minimum payment of tokens_per_vote - critical fix for small amounts
                if (actual_payment_amount == 0 && payment_value >= minimum_payment) {
                    actual_payment_amount = minimum_payment;
                };
            } else {
                // Regular payment mode - use the fixed payment amount
                actual_payment_amount = vote.payment_amount;
            };
            
            if (payment_value == actual_payment_amount) {
                // Exact payment - transfer all to creator
                transfer::public_transfer(payment, vote.creator);
            } else {
                // Split payment - send actual_payment_amount to creator, return excess to voter
                let paid = coin::split(&mut payment, actual_payment_amount, ctx);
                transfer::public_transfer(paid, vote.creator);
                
                let remaining = coin::value(&payment);
                if (remaining > 0) {
                    transfer::public_transfer(payment, sender);
                } else {
                    coin::destroy_zero(payment);
                }
            }
        } else {
            // No payment required - return payment to sender
            transfer::public_transfer(payment, sender);
        };
        

        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        
        // Extract all vote properties before borrowing mutable reference
        let vote_id = object::id(vote);
        let use_token_weighting = vote.use_token_weighting;
        let tokens_per_vote = vote.tokens_per_vote;
        let payment_token_weight = vote.payment_token_weight;
        let token_amount = vote.token_amount;
        let use_payment_weighting = vote.use_payment_weighting;
        let has_whitelist = vote.has_whitelist;
        let whitelist_weight = if (has_whitelist) {
            get_whitelist_weight(vote, sender)
        } else {
            1
        };
        
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        

        validate_poll_selections(poll, &option_indices);
        
        let mut vote_weight = 1;
        
        // Weighting system: whitelist weighting > payment > token requirement
        // Basic whitelist (access control) can be combined with payment/token weighting
        if (has_whitelist && whitelist_weight > 1) {
            // Whitelist weighting takes absolute priority
            vote_weight = whitelist_weight;
        } else if (use_payment_weighting && actual_payment_amount > 0 && payment_token_weight > 0) {
            // Second priority: Payment weighting
            let payment_weight = safe_div(actual_payment_amount, payment_token_weight);
            
            // Ensure vote weight is never 0 when payment is made
            vote_weight = if (payment_weight == 0 && actual_payment_amount > 0) {
                1
            } else if (payment_weight == 0) {
                1  // Fallback to ensure non-zero weight
            } else {
                payment_weight
            };
        };
        
        if (vote_weight == 1 && use_token_weighting && token_balance > 0 && tokens_per_vote > 0) {
            // Third priority: Token requirement weighting
            vote_weight = safe_div(token_balance, tokens_per_vote);

            if (vote_weight == 0 && option::is_some(&token_amount)) {
                let min_token_amount = option::borrow(&token_amount);
                if (token_balance >= *min_token_amount) {
                    vote_weight = 1;
                };
            };
        };
        
        // Validate final vote weight
        validate_vote_weight(vote_weight);


        let mut i = 0;
        let option_count = vector::length(&option_indices);
        
        while (i < option_count) {
            let option_idx = *vector::borrow(&option_indices, i);
            assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
            
            let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
            
            // Overflow protection for option votes
            assert!(option.votes < 18446744073709551615 - vote_weight, EOverflow);
            option.votes = safe_add(option.votes, vote_weight);
            
            i = i + 1;
        };
        

        poll.total_responses = safe_add(poll.total_responses, 1);
        

        let poll_id = object::id(poll);


        vote.total_votes = safe_add(vote.total_votes, 1);
        admin.total_votes_cast = safe_add(admin.total_votes_cast, 1);
        

        event::emit(VoteCast {
            vote_id,
            poll_id,
            voter: sender,
            option_indices,
            token_balance,
            vote_weight
        });
        
        // Release lock
        vote.is_locked = false;
    }

    /// Cast votes on multiple polls at once with token weighting
    public entry fun cast_multiple_votes(
        vote: &mut Vote,
        admin: &mut VoteAdmin,
        poll_indices: vector<u64>,
        option_indices_per_poll: vector<vector<u64>>,
        token_balance: u64,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // ===== Security Checks =====
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Input validation
        assert!(vector::length(&poll_indices) > 0, EInvalidSelection);
        assert!(vector::length(&poll_indices) <= MAX_POLLS_PER_VOTE, EInvalidVectorLength);
        assert!(vector::length(&option_indices_per_poll) <= MAX_POLLS_PER_VOTE, EInvalidVectorLength);
        
        // Timing validation
        assert!(current_time >= vote.start_timestamp, EPollNotActive);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Overflow protection
        assert!(vote.total_votes < 18446744073709551615, EOverflow);
        assert!(admin.total_votes_cast < 18446744073709551615, EOverflow);
        

        if (vote.has_whitelist) {
            assert!(dynamic_field::exists_(&vote.id, sender), ENotWhitelisted);
        };
        
        // If token requirement exists, validate token balance
        if (option::is_some(&vote.token_requirement) && option::is_some(&vote.token_amount)) {
            let min_token_amount = option::borrow(&vote.token_amount);
            assert!(token_balance >= *min_token_amount, EInvalidTokenBalance);
        };
        
        // Ensure vectors have same length
        let poll_count = vector::length(&poll_indices);
        assert!(poll_count == vector::length(&option_indices_per_poll), EInvalidSelection);
        
        // If all polls are required, check that all polls are included
        if (vote.require_all_polls) {
            assert!(poll_count == vote.polls_count, ERequiredOptionNotSelected);
        };
        

        let vote_id = object::id(vote);
        

        let mut actual_payment_amount = 0u64;
        
        if (vote.payment_amount > 0 || (vote.use_payment_weighting && vote.tokens_per_vote > 0)) {
            let payment_value = coin::value(&payment);
            
            // For payment weighting, minimum payment is tokens_per_vote
            let minimum_payment = if (vote.use_payment_weighting && vote.tokens_per_vote > 0) {
                vote.tokens_per_vote
            } else {
                vote.payment_amount
            };
            
            assert!(payment_value >= minimum_payment, EInsufficientPayment);
            
            // For payment weighting, calculate the actual payment amount based on tokens_per_vote
            if (vote.use_payment_weighting && vote.tokens_per_vote > 0) {
                // Calculate how many vote weights the user can afford
                let max_vote_weights = safe_div(payment_value, vote.tokens_per_vote);
                // Calculate the exact payment amount (no fractional weights)
                actual_payment_amount = safe_mul(max_vote_weights, vote.tokens_per_vote);
                
                // Ensure minimum payment of tokens_per_vote
                if (actual_payment_amount < vote.tokens_per_vote && payment_value >= vote.tokens_per_vote) {
                    actual_payment_amount = vote.tokens_per_vote;
                };
            } else {
                // Regular payment mode - use the fixed payment amount
                actual_payment_amount = vote.payment_amount;
            };
            
            if (payment_value == actual_payment_amount) {
                // Exact payment - transfer all to creator
                transfer::public_transfer(payment, vote.creator);
            } else {
                // Split payment - send actual_payment_amount to creator, return excess to voter
                let paid = coin::split(&mut payment, actual_payment_amount, ctx);
                transfer::public_transfer(paid, vote.creator);
                
                let remaining = coin::value(&payment);
                if (remaining > 0) {
                    transfer::public_transfer(payment, sender);
                } else {
                    coin::destroy_zero(payment);
                }
            }
        } else {
            // No payment required - return payment to sender
            transfer::public_transfer(payment, sender);
        };
        
        // Calculate vote weight using priority-based weighting system
        let mut vote_weight = 1;
        
        // Weighting system: whitelist weighting > payment > token requirement
        // Basic whitelist (access control) can be combined with payment/token weighting
        if (vote.has_whitelist) {
            let whitelist_weight = get_whitelist_weight(vote, sender);
            if (whitelist_weight > 1) {
                // Whitelist weighting takes absolute priority
                vote_weight = whitelist_weight;
            };
        };
        
        if (vote_weight == 1 && vote.use_payment_weighting && actual_payment_amount > 0 && vote.tokens_per_vote > 0) {
            // Second priority: Payment weighting
            let payment_weight = safe_div(actual_payment_amount, vote.tokens_per_vote);
            
            vote_weight = if (payment_weight == 0 && actual_payment_amount > 0) {
                1
            } else {
                payment_weight
            };
        };
        
        if (vote_weight == 1 && vote.use_token_weighting && token_balance > 0 && vote.tokens_per_vote > 0) {
            // Third priority: Token requirement weighting
            vote_weight = safe_div(token_balance, vote.tokens_per_vote);

            if (vote_weight == 0 && option::is_some(&vote.token_amount)) {
                let min_token_amount = option::borrow(&vote.token_amount);
                if (token_balance >= *min_token_amount) {
                    vote_weight = 1;
                };
            };
        };
        
        // Validate final vote weight
        validate_vote_weight(vote_weight);
        

        let mut i = 0;
        
        while (i < poll_count) {
            let poll_index = *vector::borrow(&poll_indices, i);
            let option_indices = *vector::borrow(&option_indices_per_poll, i);
            
    
            assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
            let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
            

            validate_poll_selections(poll, &option_indices);
            

            let mut j = 0;
            let option_count = vector::length(&option_indices);
            
            while (j < option_count) {
                let option_idx = *vector::borrow(&option_indices, j);
                assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
                
                let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
                
                // Overflow protection for option votes
                assert!(option.votes < 18446744073709551615 - vote_weight, EOverflow);
                option.votes = safe_add(option.votes, vote_weight);
                
                j = j + 1;
            };
            

            poll.total_responses = safe_add(poll.total_responses, 1);
            
    
            let poll_id = object::id(poll);
            

            event::emit(VoteCast {
                vote_id,
                poll_id,
                voter: sender,
                option_indices,
                token_balance,
                vote_weight
            });
            
            i = i + 1;
        };
        

        vote.total_votes = safe_add(vote.total_votes, 1);
        admin.total_votes_cast = safe_add(admin.total_votes_cast, 1);
        
        // Release lock
        vote.is_locked = false;
    }

    /// Close a vote after end time
    public entry fun close_vote(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;

        let current_time = clock::timestamp_ms(clock);
        assert!(
            vote.creator == tx_context::sender(ctx) || current_time > vote.end_timestamp, 
            ENotAuthorized
        );
        

        assert!(current_time > vote.end_timestamp || vote.is_cancelled, EPollNotActive);
        

        let vote_id = object::id(vote);
        let total_votes = vote.total_votes;
        

        event::emit(VoteClosed {
            vote_id,
            total_votes
        });
        
        // Release reentrancy lock
        vote.is_locked = false;
    }

    /// Cancel a vote (only by creator, only before start)
    public entry fun cancel_vote(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;

        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Mark as cancelled
        vote.is_cancelled = true;
        

        let vote_id = object::id(vote);
        

        event::emit(VoteCancelled {
            vote_id,
            creator: vote.creator,
            timestamp: current_time
        });
        
        // Release reentrancy lock
        vote.is_locked = false;
    }

    /// Delete a vote permanently (only by creator)
    public entry fun delete_vote(
        mut vote: Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        let current_time = clock::timestamp_ms(clock);
        let vote_id = object::id(&vote);
        let creator = vote.creator;
        
        // Clean up all polls and their options
        let mut poll_index = 1;
        while (poll_index <= vote.polls_count) {
            if (dof::exists_(&vote.id, poll_index)) {
                let mut poll: Poll = dof::remove(&mut vote.id, poll_index);
                
                // Clean up all options in this poll
                let mut option_index = 1;
                while (option_index <= poll.options_count) {
                    if (dof::exists_(&poll.id, option_index)) {
                        let option: PollOption = dof::remove(&mut poll.id, option_index);
                        let PollOption { id, text: _, media_url: _, votes: _ } = option;
                        object::delete(id);
                    };
                    option_index = option_index + 1;
                };
                
                let Poll { id, title: _, description: _, is_multi_select: _, max_selections: _, is_required: _, options_count: _, total_responses: _ } = poll;
                object::delete(id);
            };
            poll_index = poll_index + 1;
        };
        
        // Emit deletion event before destroying the vote
        event::emit(VoteDeleted {
            vote_id,
            creator,
            timestamp: current_time
        });
        
        // Destroy the vote object
        let Vote { 
            id, 
            creator: _, 
            title: _, 
            description: _, 
            start_timestamp: _, 
            end_timestamp: _, 
            payment_amount: _, 
            require_all_polls: _, 
            polls_count: _, 
            total_votes: _, 
            is_cancelled: _, 
            token_requirement: _, 
            token_amount: _, 
            has_whitelist: _, 
            show_live_stats: _, 
            use_token_weighting: _, 
            tokens_per_vote: _, 
            use_payment_weighting: _, 
            payment_token_weight: _,
            version: _,
            is_locked: _,
            creation_timestamp: _ 
        } = vote;
        object::delete(id);
    }

    /// Extend voting period (only by creator)
    public entry fun extend_voting_period(
        vote: &mut Vote,
        new_end_timestamp: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;

        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        

        assert!(!vote.is_cancelled, EPollClosed);
        

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        
        // Validate timestamp range
        assert!(new_end_timestamp > vote.end_timestamp, EInvalidTimestamp);
        assert!(new_end_timestamp <= current_time + MAX_VOTING_DURATION, EInvalidTimestamp);
        

        vote.end_timestamp = new_end_timestamp;
        
        // Release reentrancy lock
        vote.is_locked = false;
    }

    /// Update vote details (only by creator, only before voting starts)
    public entry fun update_vote(
        vote: &mut Vote,
        mut new_title: Option<String>,
        mut new_description: Option<String>,
        mut new_start_timestamp: Option<u64>,
        mut new_end_timestamp: Option<u64>,
        mut new_payment_amount: Option<u64>,
        mut new_require_all_polls: Option<bool>,
        mut new_token_requirement: Option<String>,
        mut new_token_amount: Option<u64>,
        mut new_show_live_stats: Option<bool>,
        mut new_use_token_weighting: Option<bool>,
        mut new_tokens_per_vote: Option<u64>,
        mut new_use_payment_weighting: Option<bool>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        assert!(!vote.is_cancelled, EPollClosed);
        
        let current_time = clock::timestamp_ms(clock);
        
        // Input validation for strings
        if (option::is_some(&new_title)) {
            let title_ref = option::borrow(&new_title);
            assert!(string::length(title_ref) >= MIN_STRING_LENGTH && string::length(title_ref) <= MAX_STRING_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_description)) {
            let desc_ref = option::borrow(&new_description);
            // Description is optional, so allow empty strings
            assert!(string::length(desc_ref) <= MAX_DESCRIPTION_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_token_requirement)) {
            let token_ref = option::borrow(&new_token_requirement);
            assert!(string::length(token_ref) >= MIN_STRING_LENGTH && string::length(token_ref) <= MAX_STRING_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_title)) {
            vote.title = option::extract(&mut new_title);
        };
        
        if (option::is_some(&new_description)) {
            vote.description = option::extract(&mut new_description);
        };
        
        if (option::is_some(&new_start_timestamp)) {
            let start_time = option::extract(&mut new_start_timestamp);
            assert!(start_time > current_time, EInvalidTimestamp);
            assert!(start_time < vote.end_timestamp, EInvalidTimestamp);
            vote.start_timestamp = start_time;
        };
        
        if (option::is_some(&new_end_timestamp)) {
            let end_time = option::extract(&mut new_end_timestamp);
            assert!(end_time > vote.start_timestamp, EInvalidTimestamp);
            vote.end_timestamp = end_time;
        };
        
        if (option::is_some(&new_payment_amount)) {
            let payment = option::extract(&mut new_payment_amount);
            assert!(payment <= MAX_PAYMENT_AMOUNT, EOverflow);
            vote.payment_amount = payment;
        };
        
        if (option::is_some(&new_require_all_polls)) {
            vote.require_all_polls = option::extract(&mut new_require_all_polls);
        };
        
        if (option::is_some(&new_token_requirement)) {
            vote.token_requirement = option::some(option::extract(&mut new_token_requirement));
        };
        
        if (option::is_some(&new_token_amount)) {
            vote.token_amount = option::some(option::extract(&mut new_token_amount));
        };
        
        if (option::is_some(&new_show_live_stats)) {
            vote.show_live_stats = option::extract(&mut new_show_live_stats);
        };
        
        if (option::is_some(&new_use_token_weighting)) {
            vote.use_token_weighting = option::extract(&mut new_use_token_weighting);
        };
        
        if (option::is_some(&new_tokens_per_vote)) {
            vote.tokens_per_vote = option::extract(&mut new_tokens_per_vote);
        };
        
        if (option::is_some(&new_use_payment_weighting)) {
            vote.use_payment_weighting = option::extract(&mut new_use_payment_weighting);
        };
        
        // Update tokens_per_vote
        if (option::is_some(&new_tokens_per_vote)) {
            let tokens_per_vote_value = option::extract(&mut new_tokens_per_vote);
            assert!(tokens_per_vote_value > 0 && tokens_per_vote_value <= MAX_TOKENS_PER_VOTE, EInvalidTokenAmount);
            vote.tokens_per_vote = tokens_per_vote_value;
        };
        
        let vote_id = object::id(vote);
         event::emit(VoteUpdated {
             vote_id,
             creator: vote.creator,
             timestamp: current_time
         });
         
         // Release reentrancy lock
         vote.is_locked = false;
     }

     /// Update poll details (only by creator, only before voting starts)
    public entry fun update_poll(
        vote: &mut Vote,
        poll_index: u64,
        mut new_title: Option<String>,
        mut new_description: Option<String>,
        mut new_is_multi_select: Option<bool>,
        mut new_max_selections: Option<u64>,
        mut new_is_required: Option<bool>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Reentrancy protection
        assert!(!vote.is_locked, EReentrancyDetected);
        vote.is_locked = true;
        
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        assert!(!vote.is_cancelled, EPollClosed);
        
        let current_time = clock::timestamp_ms(clock);
        let vote_id = object::id(vote);
        
        // Input validation
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        
        if (option::is_some(&new_title)) {
            let title_ref = option::borrow(&new_title);
            assert!(string::length(title_ref) >= MIN_STRING_LENGTH && string::length(title_ref) <= MAX_STRING_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_description)) {
            let desc_ref = option::borrow(&new_description);
            // Description is optional, so allow empty strings
            assert!(string::length(desc_ref) <= MAX_DESCRIPTION_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_max_selections)) {
            let max_sel = *option::borrow(&new_max_selections);
            assert!(max_sel > 0 && max_sel <= MAX_OPTIONS_PER_POLL, EInvalidSelection);
        };
        
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        let poll_id = object::id(poll);
        
        if (option::is_some(&new_title)) {
            poll.title = option::extract(&mut new_title);
        };
        
        if (option::is_some(&new_description)) {
            poll.description = option::extract(&mut new_description);
        };
        
        if (option::is_some(&new_is_multi_select)) {
            poll.is_multi_select = option::extract(&mut new_is_multi_select);
        };
        
        if (option::is_some(&new_max_selections)) {
            poll.max_selections = option::extract(&mut new_max_selections);
        };
        
        if (option::is_some(&new_is_required)) {
            poll.is_required = option::extract(&mut new_is_required);
        };
         event::emit(PollUpdated {
             vote_id,
             poll_id,
             poll_index,
             timestamp: current_time
         });
         
         // Release reentrancy lock
         vote.is_locked = false;
     }

     /// Update poll option details (only by creator, only before voting starts)
    public entry fun update_poll_option(
        vote: &mut Vote,
        poll_index: u64,
        option_index: u64,
        mut new_text: Option<String>,
        mut new_media_url: Option<String>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
         // Reentrancy protection
         assert!(!vote.is_locked, EReentrancyDetected);
         vote.is_locked = true;
         
         assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
         assert!(!vote.is_cancelled, EPollClosed);
         
         let current_time = clock::timestamp_ms(clock);
         
         let vote_id = object::id(vote);
        
        // Input validation
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        
        if (option::is_some(&new_text)) {
            let text_ref = option::borrow(&new_text);
            assert!(string::length(text_ref) >= MIN_STRING_LENGTH && string::length(text_ref) <= MAX_STRING_LENGTH, EInvalidStringLength);
        };
        
        if (option::is_some(&new_media_url)) {
            let url_ref = option::borrow(&new_media_url);
            // Media URL is optional, so allow empty strings
            assert!(string::length(url_ref) <= MAX_URL_LENGTH, EInvalidStringLength);
        };
        
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        let poll_id = object::id(poll);
        
        assert!(option_index <= poll.options_count && option_index > 0, EInvalidOptionIndex);
        let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_index);
        let option_id = object::id(option);
        
        if (option::is_some(&new_text)) {
            option.text = option::extract(&mut new_text);
        };
        
        if (option::is_some(&new_media_url)) {
            option.media_url = option::some(option::extract(&mut new_media_url));
        };
         event::emit(OptionUpdated {
             vote_id,
             poll_id,
             option_id,
             poll_index,
             option_index,
             timestamp: current_time
         });
         
         // Release reentrancy lock
         vote.is_locked = false;
     }

     // ===== Helper functions =====
    
    /// Validate poll selections - minimal validation kept on-chain
    fun validate_poll_selections(poll: &Poll, option_indices: &vector<u64>) {

        if (!poll.is_multi_select) {
            assert!(vector::length(option_indices) == 1, ETooManyOptions);
        } else {

            assert!(vector::length(option_indices) <= poll.max_selections, ETooManyOptions);
            assert!(vector::length(option_indices) > 0, ERequiredOptionNotSelected);
        };
        

        let mut i = 0;
        let option_count = vector::length(option_indices);
        
        while (i < option_count) {
            let option_i = *vector::borrow(option_indices, i);
            let mut j = i + 1;
            
            while (j < option_count) {
                let option_j = *vector::borrow(option_indices, j);
                assert!(option_i != option_j, EInvalidSelection);
                j = j + 1;
            };
            
            i = i + 1;
        };
    }

    /// Check if an address is allowed to vote (for frontend use)
    public fun is_allowed_to_vote(vote: &Vote, voter: address): bool {

        if (!vote.has_whitelist) {
            return true
        };
        

        dynamic_field::exists_(&vote.id, voter)
    }
    
    /// Get whitelist weight for an address (returns 0 if not whitelisted, 1 for legacy entries)
    public fun get_whitelist_weight(vote: &Vote, voter: address): u64 {

        if (!vote.has_whitelist) {
            return 1
        };
        

        if (!dynamic_field::exists_(&vote.id, voter)) {
            return 0
        };
        

        if (dynamic_field::exists_with_type<address, WhitelistEntry>(&vote.id, voter)) {
            let entry: &WhitelistEntry = dynamic_field::borrow(&vote.id, voter);
            if (entry.weight == 0) {
                return 1
            } else {
                return entry.weight
            }
        } else {

            return 1
        }
    }
    
    /// Get payment weighting details for a vote
    public fun get_payment_weighting_info(vote: &Vote): (bool, u64, u64, u64) {
        (vote.use_payment_weighting, vote.payment_amount, vote.tokens_per_vote, vote.payment_token_weight)
    }

    // ===== Security Helper Functions =====
    
    /// Safe addition with overflow check
    fun safe_add(a: u64, b: u64): u64 {
        let result = a + b;
        assert!(result >= a && result >= b, EOverflow);
        result
    }
    
    /// Safe multiplication with overflow check
    fun safe_mul(a: u64, b: u64): u64 {
        if (a == 0 || b == 0) {
            return 0
        };
        let result = a * b;
        assert!(result / a == b, EOverflow);
        result
    }
    
    /// Safe division with zero check
    fun safe_div(a: u64, b: u64): u64 {
        assert!(b > 0, EZeroDivision);
        a / b
    }
    
    /// Validate vote weight calculation
    fun validate_vote_weight(weight: u64) {
        assert!(weight > 0 && weight <= MAX_VOTE_WEIGHT, EInvalidVoteWeight);
    }
    
    // ===== View functions =====

    /// Get vote details - updated with new token requirement fields and version
    public fun get_vote_details(vote: &Vote): (
        address, String, String, u64, u64, u64, bool, u64, u64, bool, 
        Option<String>, Option<u64>, bool, bool, bool, u64, bool, u64, bool, u64
    ) {
        (
            vote.creator,
            vote.title,
            vote.description,
            vote.start_timestamp,
            vote.end_timestamp,
            vote.payment_amount,
            vote.require_all_polls,
            vote.polls_count,
            vote.total_votes,
            vote.is_cancelled,
            vote.token_requirement,
            vote.token_amount,
            vote.has_whitelist,
            vote.show_live_stats,
            vote.use_token_weighting,
            vote.tokens_per_vote,
            vote.use_payment_weighting,
            vote.version,
            vote.is_locked,
            vote.creation_timestamp
        )
    }
    
    /// Get poll details - useful for frontend validation
    public fun get_poll_details(
        vote: &Vote, 
        poll_index: u64
    ): (String, String, bool, u64, bool, u64, u64) {
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        let poll: &Poll = dof::borrow(&vote.id, poll_index);
        
        (
            poll.title,
            poll.description,
            poll.is_multi_select,
            poll.max_selections,
            poll.is_required,
            poll.options_count,
            poll.total_responses
        )
    }
    
    /// Get option details - useful for frontend to display results
    public fun get_option_details(
        vote: &Vote,
        poll_index: u64,
        option_index: u64
    ): (String, Option<String>, u64) {
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        let poll: &Poll = dof::borrow(&vote.id, poll_index);
        
        assert!(option_index <= poll.options_count && option_index > 0, EInvalidOptionIndex);
        let option: &PollOption = dof::borrow(&poll.id, option_index);
        
        (option.text, option.media_url, option.votes)
    }
    
    /// Get admin statistics
    public fun get_admin_stats(admin: &VoteAdmin): (u64, u64) {
        (admin.total_votes_created, admin.total_votes_cast)
    }

    /// Get contract version
    public fun get_contract_version(): u64 {
        CURRENT_VERSION
    }
}