/// @title SuiVote: A streamlined decentralized voting platform on Sui
/// @version 1.1.0
/// @notice This module implements an optimized voting system with reduced on-chain operations
/// @dev Functionality that can be handled by the frontend has been moved off-chain
module contracts::voting {
    use sui::dynamic_object_field as dof;
    use sui::dynamic_field;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};

    // ===== Constants =====
    // SUI_DECIMALS constant removed - payment amounts are now handled in MIST directly
    const CURRENT_VERSION: u64 = 1; // Contract version for upgrade management

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
    const EUpgradeNotNeeded: u64 = 18; // New error for upgrade logic

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
        version: u64  // New version field for upgrade management
    }

    /// Simple struct to mark addresses as whitelisted - no UID needed
    public struct WhitelistMarker has store, copy, drop {}

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
        version: u64  // Add version to event
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

    /// Emitted when an address is added to the allowed voters list
    public struct VoterWhitelisted has copy, drop {
        vote_id: ID,
        voter_address: address
    }

    /// New event: Emitted when a vote is upgraded
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
        admin: &mut VoteAdmin,
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
        whitelist_addresses: vector<address>, 
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate timestamps
        let current_time = clock::timestamp_ms(clock);
        assert!(start_timestamp >= current_time, EInvalidTimestamp);
        assert!(end_timestamp > start_timestamp, EInvalidTimestamp);

        let token_req = if (string::length(&token_requirement) > 0) {
            option::some(token_requirement)
        } else {
            option::none()
        };

        // Convert token_amount to Option<u64>
        let mut token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };

        // Validate token weighting settings
        if (use_token_weighting) {
            // If using token weighting, we must have a token requirement
            assert!(option::is_some(&token_req), EInvalidTokenWeightRatio);
            
            // If tokens_per_vote is 0, use token_amount as default
            if (tokens_per_vote == 0 && option::is_some(&token_amt)) {
                tokens_per_vote = option::extract(&mut token_amt); // Use minimum requirement as ratio
                token_amt = option::some(tokens_per_vote); // Restore the value
            } else {
                // Otherwise, ensure tokens_per_vote is positive
                assert!(tokens_per_vote > 0, EInvalidTokenWeightRatio);
            };
        } else {
            // If not using token weighting, set tokens_per_vote to 0
            tokens_per_vote = 0;
        };

        // payment_amount is now expected to be in MIST directly
        let payment_in_mist = payment_amount;

        // Create the vote object with whitelist setting and version
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
            has_whitelist: !vector::is_empty(&whitelist_addresses), // Set based on addresses
            show_live_stats,
            use_token_weighting,
            tokens_per_vote,
            version: CURRENT_VERSION // Initialize with current version
        };

        let vote_id = object::id(&vote);
        
        // Process whitelist - always add creator if whitelist is enabled
        if (vote.has_whitelist) {
            // Store creator address first - FIX: avoid referential transparency violation
            let creator = vote.creator;
            
            // Always add creator first
            let creator_marker = WhitelistMarker {};
            dynamic_field::add(&mut vote.id, creator, creator_marker);
            
            // Emit event for creator
            event::emit(VoterWhitelisted {
                vote_id,
                voter_address: creator
            });
            
            // Now process the rest of whitelist addresses if any were provided
            if (!vector::is_empty(&whitelist_addresses)) {
                let mut i = 0;
                let voter_count = vector::length(&whitelist_addresses);
                
                while (i < voter_count) {
                    let voter = *vector::borrow(&whitelist_addresses, i);
                    
                    // Only add if not already added (skip if it's the creator)
                    if (!dynamic_field::exists_(&vote.id, voter)) {
                        // Create and add whitelist marker
                        let marker = WhitelistMarker {};
                        dynamic_field::add(&mut vote.id, voter, marker);
                        
                        // Emit event for each whitelisted voter
                        event::emit(VoterWhitelisted {
                            vote_id,
                            voter_address: voter
                        });
                    };
                    
                    i = i + 1;
                };
            };
        };
        
        // Update admin stats
        admin.total_votes_created = admin.total_votes_created + 1;
        
        // Emit event for frontend tracking with updated whitelist status and version
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
            version: vote.version
        });

        // Share the vote object
        transfer::share_object(vote);
    }
    
    // 3. Enhanced add_poll function with ordering validation
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
        // Only creator can add polls
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can't add polls after voting has started
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Can't add polls if vote is cancelled
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
        
        // FIXED: Ensure sequential poll indexing
        let poll_index = vote.polls_count + 1;
        let poll_id = object::id(&poll);
        let vote_id = object::id(vote);
        
        // Add poll with guaranteed sequential index
        dof::add(&mut vote.id, poll_index, poll);
        vote.polls_count = poll_index; // Critical: update count to match index
        
        // Emit event for frontend tracking
        event::emit(PollAdded {
            vote_id,
            poll_id,
            poll_index,
            title
        });
    }

    // 4. Enhanced add_poll_option function with ordering validation
    public entry fun add_poll_option(
        vote: &mut Vote,
        poll_index: u64,
        text: String,
        media_url: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only creator can add options
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can't add options after voting has started
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Can't add options if vote is cancelled
        assert!(!vote.is_cancelled, EPollClosed);
        
        let vote_id = object::id(vote);
        
        // Validate poll exists
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        assert!(dof::exists_(&vote.id, poll_index), EPollNotFound);
        
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        
        // Convert media_url to Option<String>
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
        
        // FIXED: Ensure sequential option indexing
        let option_index = poll.options_count + 1;
        let option_id = object::id(&option);
        let poll_id = object::id(poll);
        
        // Add option with guaranteed sequential index
        dof::add(&mut poll.id, option_index, option);
        poll.options_count = option_index; // Critical: update count to match index
        
        // Emit event for frontend tracking
        event::emit(OptionAdded {
            vote_id,
            poll_id,
            option_id,
            option_index,
            text
        });
    }

    /// Add allowed voters to the whitelist
    public entry fun add_allowed_voters(
        vote: &mut Vote,
        voters: vector<address>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only creator can add allowed voters
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can't modify after voting has started
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Can't modify if vote is cancelled
        assert!(!vote.is_cancelled, EPollClosed);
        
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
                // Create a simple marker struct with proper abilities
                let marker = WhitelistMarker {};
                
                // Add as a dynamic field with the voter address as the key
                dynamic_field::add(&mut vote.id, voter, marker);
                
                // Emit event for each whitelisted voter for frontend tracking
                event::emit(VoterWhitelisted {
                    vote_id,
                    voter_address: voter
                });
            };
            
            i = i + 1;
        };
    }
    
    /// New function: Ensure vote creator is whitelisted for their own vote
    public entry fun ensure_creator_whitelisted(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
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
                
                // Emit event for tracking
                event::emit(VoterWhitelisted {
                    vote_id: object::id(vote),
                    voter_address: vote.creator
                });
            };
        };
    }
    
    /// Upgrade helper function for existing votes
    public entry fun upgrade_vote_to_current_version(
        vote: &mut Vote,
        ctx: &mut TxContext
    ) {
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
                
                // Emit event for tracking
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
    }
    
    /// Create a complete vote with polls and options in a single transaction, including token weighting
    public entry fun create_complete_vote(
        admin: &mut VoteAdmin,
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
        // Validate timestamps
        let current_time = clock::timestamp_ms(clock);
        assert!(start_timestamp >= current_time, EInvalidTimestamp);
        assert!(end_timestamp > start_timestamp, EInvalidTimestamp);

        // Validate input lengths
        let poll_count = vector::length(&poll_titles);
        assert!(poll_count > 0, EInvalidPollCount);
        assert!(poll_count == vector::length(&poll_descriptions), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_is_multi_select), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_max_selections), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_is_required), EInvalidInputLength);
        assert!(poll_count == vector::length(&poll_option_counts), EInvalidInputLength);

        // Convert token_requirement to Option<String>
        let token_req = if (vector::length(&token_requirement) > 0) {
            option::some(string::utf8(token_requirement))
        } else {
            option::none()
        };

        // Convert token_amount to Option<u64>
        let mut token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };
        
        // Validate token weighting settings
        if (use_token_weighting) {
            // If using token weighting, we must have a token requirement
            assert!(option::is_some(&token_req), EInvalidTokenWeightRatio);
            
            // If tokens_per_vote is 0, use token_amount as default
            if (tokens_per_vote == 0 && option::is_some(&token_amt)) {
                tokens_per_vote = option::extract(&mut token_amt); // Use minimum requirement as ratio
                token_amt = option::some(tokens_per_vote); // Restore the value
            } else {
                // Otherwise, ensure tokens_per_vote is positive
                assert!(tokens_per_vote > 0, EInvalidTokenWeightRatio);
            };
        } else {
            // If not using token weighting, set tokens_per_vote to 0
            tokens_per_vote = 0;
        };

        // payment_amount is now expected to be in MIST directly
        let payment_in_mist = payment_amount;

        // Create the vote object with token weighting fields and whitelist setting
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
            version: CURRENT_VERSION
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
        
        // Process whitelist - always add creator if whitelist is enabled
        if (vote.has_whitelist) {
            // Store creator address first - FIX: avoid referential transparency violation
            let creator = vote.creator;
            
            // Always add creator first
            let creator_marker = WhitelistMarker {};
            dynamic_field::add(&mut vote.id, creator, creator_marker);
            
            // Emit event for creator
            event::emit(VoterWhitelisted {
                vote_id,
                voter_address: creator
            });
            
            // Now process the rest of whitelist addresses if any were provided
            if (!vector::is_empty(&whitelist_addresses)) {
                let mut i = 0;
                let voter_count = vector::length(&whitelist_addresses);
                
                while (i < voter_count) {
                    let voter = *vector::borrow(&whitelist_addresses, i);
                    
                    // Only add if not already added (skip if it's the creator)
                    if (!dynamic_field::exists_(&vote.id, voter)) {
                        // Create and add whitelist marker
                        let marker = WhitelistMarker {};
                        dynamic_field::add(&mut vote.id, voter, marker);
                        
                        // Emit event for each whitelisted voter
                        event::emit(VoterWhitelisted {
                            vote_id,
                            voter_address: voter
                        });
                    };
                    
                    i = i + 1;
                };
            };
        };
        
        // Update admin stats
        admin.total_votes_created = admin.total_votes_created + 1;
        
        // Emit event for frontend tracking with token weighting fields and whitelist status
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
            version: vote.version
        });

        // Share the vote object
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
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Check if vote is active
        assert!(current_time >= vote.start_timestamp, EPollNotActive);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Check if sender is in whitelist (if whitelist is enabled)
        if (vote.has_whitelist) {
            assert!(dynamic_field::exists_(&vote.id, sender), ENotWhitelisted);
        };
        
        if (option::is_some(&vote.token_requirement) && option::is_some(&vote.token_amount)) {
            let min_token_amount = option::borrow(&vote.token_amount);
            assert!(token_balance >= *min_token_amount, EInvalidTokenBalance);
        };

        // Store vote_id before any mutable borrows
        let vote_id = object::id(vote);
        
        // Handle payment if required - send to vote creator
        if (vote.payment_amount > 0) {
            let payment_value = coin::value(&payment);
            assert!(payment_value >= vote.payment_amount, EInsufficientPayment);
            
            // Improved payment handling to avoid precision issues
            if (payment_value == vote.payment_amount) {
                // Exact payment - send the whole coin to vote creator
                transfer::public_transfer(payment, vote.creator);
            } else {
                // Split the payment - using a temporary variable to ensure proper handling
                let paid_amount = vote.payment_amount;
                let paid = coin::split(&mut payment, paid_amount, ctx);
                
                // Send exact amount to vote creator
                transfer::public_transfer(paid, vote.creator);
                
                // Check if there's any remaining value in the payment coin
                let remaining = coin::value(&payment);
                if (remaining > 0) {
                    // Return any excess to sender
                    transfer::public_transfer(payment, sender);
                } else {
                    // Destroy the zero-value coin
                    coin::destroy_zero(payment);
                }
            }
        } else {
            // No payment required, return the whole coin
            transfer::public_transfer(payment, sender);
        };
        
        // Get the poll
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
        let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
        
        // Validate poll selections - moved to frontend, minimal validation on-chain
        validate_poll_selections(poll, &option_indices);
        
        let mut vote_weight = 1; // Default weight is 1
        
        if (vote.use_token_weighting && token_balance > 0 && vote.tokens_per_vote > 0) {
            // Calculate weight: token_balance / tokens_per_vote
            vote_weight = token_balance / vote.tokens_per_vote;
            // Ensure minimum weight is 1 if they meet the requirement
            if (vote_weight == 0 && option::is_some(&vote.token_amount)) {
                let min_token_amount = option::borrow(&vote.token_amount);
                if (token_balance >= *min_token_amount) {
                    vote_weight = 1;
                };
            };
        };

        // Register weighted vote for each selected option
        let mut i = 0;
        let option_count = vector::length(&option_indices);
        
        while (i < option_count) {
            let option_idx = *vector::borrow(&option_indices, i);
            assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
            
            let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
            // Add vote_weight instead of just 1
            option.votes = option.votes + vote_weight;
            
            i = i + 1;
        };
        
        // Update poll response count (still count as 1 response, regardless of weight)
        poll.total_responses = poll.total_responses + 1;
        
        // Store the poll ID before releasing the borrow
        let poll_id = object::id(poll);

        // Update vote counts (still count as 1 vote, regardless of weight)
        vote.total_votes = vote.total_votes + 1;
        admin.total_votes_cast = admin.total_votes_cast + 1;
        
        // Emit extended event with token weighting info
        event::emit(VoteCast {
            vote_id,
            poll_id,
            voter: sender,
            option_indices,
            token_balance,
            vote_weight
        });
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
        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Basic validation
        assert!(current_time >= vote.start_timestamp, EPollNotActive);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Check if sender is in whitelist (if whitelist is enabled)
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
        
        // Store vote_id before any mutable borrows
        let vote_id = object::id(vote);
        
        // Handle payment if required - send to vote creator
        if (vote.payment_amount > 0) {
            let payment_value = coin::value(&payment);
            assert!(payment_value >= vote.payment_amount, EInsufficientPayment);
            
            // Improved payment handling to avoid precision issues
            if (payment_value == vote.payment_amount) {
                // Exact payment - send the whole coin to vote creator
                transfer::public_transfer(payment, vote.creator);
            } else {
                // Split the payment - using a temporary variable to ensure proper handling
                let paid_amount = vote.payment_amount;
                let paid = coin::split(&mut payment, paid_amount, ctx);
                
                // Send exact amount to vote creator
                transfer::public_transfer(paid, vote.creator);
                
                // Check if there's any remaining value in the payment coin
                let remaining = coin::value(&payment);
                if (remaining > 0) {
                    // Return any excess to sender
                    transfer::public_transfer(payment, sender);
                } else {
                    // Destroy the zero-value coin
                    coin::destroy_zero(payment);
                }
            }
        } else {
            // No payment required, return the whole coin
            transfer::public_transfer(payment, sender);
        };
        
        // Calculate vote weight based on token balance
        let mut vote_weight = 1; // Default weight is 1
        
        if (vote.use_token_weighting && token_balance > 0 && vote.tokens_per_vote > 0) {
            // Calculate weight: token_balance / tokens_per_vote
            vote_weight = token_balance / vote.tokens_per_vote;
            // Ensure minimum weight is 1 if they meet the requirement
            if (vote_weight == 0 && option::is_some(&vote.token_amount)) {
                let min_token_amount = option::borrow(&vote.token_amount);
                if (token_balance >= *min_token_amount) {
                    vote_weight = 1;
                };
            };
        };
        
        // Process each poll vote
        let mut i = 0;
        
        while (i < poll_count) {
            let poll_index = *vector::borrow(&poll_indices, i);
            let option_indices = *vector::borrow(&option_indices_per_poll, i);
            
            // Get the poll
            assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
            let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);
            
            // Validate selections - minimal on-chain validation
            validate_poll_selections(poll, &option_indices);
            
            // Register votes with weight
            let mut j = 0;
            let option_count = vector::length(&option_indices);
            
            while (j < option_count) {
                let option_idx = *vector::borrow(&option_indices, j);
                assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
                
                let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
                // Add vote_weight instead of just 1
                option.votes = option.votes + vote_weight;
                
                j = j + 1;
            };
            
            // Update poll response count (1 response, regardless of weight)
            poll.total_responses = poll.total_responses + 1;
            
            // Store the poll ID before releasing the borrow
            let poll_id = object::id(poll);
            
            // Emit event for frontend tracking with token weighting info
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
        
        // Update total votes (still count as 1 vote, regardless of weight)
        vote.total_votes = vote.total_votes + 1;
        admin.total_votes_cast = admin.total_votes_cast + 1;
    }

    /// Close a vote after end time
    public entry fun close_vote(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only creator or after end time can close
        let current_time = clock::timestamp_ms(clock);
        assert!(
            vote.creator == tx_context::sender(ctx) || current_time > vote.end_timestamp, 
            ENotAuthorized
        );
        
        // Ensure vote is past end time or cancelled
        assert!(current_time > vote.end_timestamp || vote.is_cancelled, EPollNotActive);
        
        // Store vote_id before potential mutable borrow
        let vote_id = object::id(vote);
        let total_votes = vote.total_votes;
        
        // Emit event for frontend tracking
        event::emit(VoteClosed {
            vote_id,
            total_votes
        });
    }

    /// Cancel a vote (only by creator, only before start)
    public entry fun cancel_vote(
        vote: &mut Vote,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only creator can cancel
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can only cancel before voting starts
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time < vote.start_timestamp, EPollNotActive);
        
        // Mark as cancelled
        vote.is_cancelled = true;
        
        // Store vote_id before potential mutable borrow
        let vote_id = object::id(vote);
        
        // Emit event for frontend tracking
        event::emit(VoteCancelled {
            vote_id,
            creator: vote.creator,
            timestamp: current_time
        });
    }

    /// Extend voting period (only by creator)
    public entry fun extend_voting_period(
        vote: &mut Vote,
        new_end_timestamp: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Only creator can extend
        assert!(vote.creator == tx_context::sender(ctx), ENotAuthorized);
        
        // Can't extend if vote is cancelled
        assert!(!vote.is_cancelled, EPollClosed);
        
        // Can't extend after vote has ended
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time <= vote.end_timestamp, EPollClosed);
        
        // New end time must be later than current end time
        assert!(new_end_timestamp > vote.end_timestamp, EInvalidTimestamp);
        
        // Update end time
        vote.end_timestamp = new_end_timestamp;
    }

    // ===== Helper functions =====
    
    /// Validate poll selections - minimal validation kept on-chain
    fun validate_poll_selections(poll: &Poll, option_indices: &vector<u64>) {
        // For single-select polls, ensure only one option is selected
        if (!poll.is_multi_select) {
            assert!(vector::length(option_indices) == 1, ETooManyOptions);
        } else {
            // For multi-select polls, ensure selections are within limits
            assert!(vector::length(option_indices) <= poll.max_selections, ETooManyOptions);
            assert!(vector::length(option_indices) > 0, ERequiredOptionNotSelected);
        };
        
        // Ensure no duplicate options
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
        // If there's no whitelist, everyone can vote
        if (!vote.has_whitelist) {
            return true
        };
        
        // Otherwise, check if the address is in the whitelist
        dynamic_field::exists_(&vote.id, voter)
    }

    // ===== View functions =====

    /// Get vote details - updated with new token requirement fields and version
    public fun get_vote_details(vote: &Vote): (
        address, String, String, u64, u64, u64, bool, u64, u64, bool, 
        Option<String>, Option<u64>, bool, bool, bool, u64, u64
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
            vote.version
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