/// @title SuiVote: A streamlined decentralized voting platform on Sui
/// @notice This module implements an optimized voting system with reduced on-chain operations
/// @dev Functionality that can be handled by the frontend has been moved off-chain
module contracts::voting {
    use sui::dynamic_object_field as dof;
    use sui::dynamic_field;
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use std::string::{Self, String};
    use std::option::{Self, Option};
    use std::vector;

    // ===== Constants =====
    const SUI_DECIMALS: u64 = 1_000_000_000; // 1 SUI = 10^9 MIST

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
    const EInvalidOptionCount: u64 = 13;
    const EInvalidInputLength: u64 = 14;
    const ENotWhitelisted: u64 = 15; // New error code for non-whitelisted voters

    // ===== Capability objects =====
    
    /// Admin capability for the platform
    public struct VoteAdmin has key {
        id: UID,
        total_votes_created: u64,
        total_votes_cast: u64
    }

    // ===== Core data structures =====
    
    /// Main vote container - with new token requirement fields and whitelist flag
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
        token_requirement: Option<String>,  // Optional token type identifier
        token_amount: Option<u64>,          // Optional amount of custom token required
        has_whitelist: bool                 // Indicates if vote has address restrictions
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
        token_requirement: Option<String>,  // New field
        token_amount: Option<u64>,          // New field
        has_whitelist: bool                 // New field
    }

    /// Emitted when a vote is cast
    public struct VoteCast has copy, drop {
        vote_id: ID,
        poll_id: ID,
        voter: address,
        option_indices: vector<u64>
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

    /// New event: Emitted when an address is added to the allowed voters list
    public struct VoterWhitelisted has copy, drop {
        vote_id: ID,
        voter_address: address
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
    
    /// Create a new vote with its initial configuration, including token requirements
    public entry fun create_vote(
        admin: &mut VoteAdmin,
        title: String,
        description: String,
        start_timestamp: u64,
        end_timestamp: u64,
        payment_amount: u64,         // Payment amount in SUI (will be converted to MIST)
        require_all_polls: bool,
        token_requirement: vector<u8>,     // New: Optional token identifier as bytes
        token_amount: u64,                 // New: Optional token amount
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate timestamps
        let current_time = clock::timestamp_ms(clock);
        assert!(start_timestamp >= current_time, EInvalidTimestamp);
        assert!(end_timestamp > start_timestamp, EInvalidTimestamp);

        // Convert token_requirement to Option<String>
        let token_req = if (vector::length(&token_requirement) > 0) {
            option::some(string::utf8(token_requirement))
        } else {
            option::none()
        };

        // Convert token_amount to Option<u64>
        let token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };

        // Convert payment_amount from SUI to MIST for internal storage
        let payment_in_mist = if (payment_amount > 0) {
            payment_amount * SUI_DECIMALS
        } else {
            0
        };

        // Create the vote object
        let vote = Vote {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            title,
            description,
            start_timestamp,
            end_timestamp,
            payment_amount: payment_in_mist,  // Store amount in MIST
            require_all_polls,
            polls_count: 0,
            total_votes: 0,
            is_cancelled: false,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: false
        };

        let vote_id = object::id(&vote);
        
        // Update admin stats
        admin.total_votes_created = admin.total_votes_created + 1;
        
        // Emit event for frontend tracking with new fields
        event::emit(VoteCreated {
            vote_id,
            creator: tx_context::sender(ctx),
            title,
            start_timestamp,
            end_timestamp,
            polls_count: 0,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: false
        });

        // Share the vote object
        transfer::share_object(vote);
    }

    /// Add a poll to a vote
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
        
        // Add poll to vote using dynamic fields
        let poll_count = vote.polls_count + 1;
        vote.polls_count = poll_count;
        
        let poll_id = object::id(&poll);
        let vote_id = object::id(vote);  // Get the vote ID before mutable borrow
        
        dof::add(&mut vote.id, poll_count, poll);
        
        // Emit event for frontend tracking
        event::emit(PollAdded {
            vote_id,
            poll_id,
            poll_index: poll_count,
            title
        });
    }

    /// Add an option to a poll
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
        
        // Store vote_id before mutable borrows
        let vote_id = object::id(vote);
        
        // Get the poll
        assert!(poll_index <= vote.polls_count && poll_index > 0, EPollNotFound);
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
        
        // Add option to poll using dynamic fields
        let option_count = poll.options_count + 1;
        poll.options_count = option_count;
        
        let option_id = object::id(&option);
        let poll_id = object::id(poll);
        dof::add(&mut poll.id, option_count, option);
        
        // Emit event for frontend tracking
        event::emit(OptionAdded {
            vote_id,
            poll_id,
            option_id,
            option_index: option_count,
            text
        });
    }

    /// New function: Add allowed voters to the whitelist
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

    /// Create a complete vote with polls and options in a single transaction, including token requirements
    public entry fun create_complete_vote(
        admin: &mut VoteAdmin,
        title: String,
        description: String,
        start_timestamp: u64,
        end_timestamp: u64,
        payment_amount: u64,         // Payment amount in SUI (will be converted to MIST)
        require_all_polls: bool,
        token_requirement: vector<u8>,     // New: Optional token identifier as bytes
        token_amount: u64,                 // New: Optional token amount
        poll_titles: vector<String>,
        poll_descriptions: vector<String>,
        poll_is_multi_select: vector<bool>,
        poll_max_selections: vector<u64>,
        poll_is_required: vector<bool>,
        poll_option_counts: vector<u64>,
        poll_option_texts: vector<String>,
        poll_option_media_urls: vector<vector<u8>>,
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
        let token_amt = if (token_amount > 0 && option::is_some(&token_req)) {
            option::some(token_amount)
        } else {
            option::none()
        };

        // Convert payment_amount from SUI to MIST for internal storage
        let payment_in_mist = if (payment_amount > 0) {
            payment_amount * SUI_DECIMALS
        } else {
            0
        };

        // Create the vote object
        let mut vote = Vote {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            title,
            description,
            start_timestamp,
            end_timestamp,
            payment_amount: payment_in_mist,  // Store amount in MIST
            require_all_polls,
            polls_count: 0,
            total_votes: 0,
            is_cancelled: false,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: false
        };

        // Get all option texts and media_urls total counts
        let mut option_text_index = 0;
        let mut option_media_index = 0;
        let mut total_options = 0;

        let mut i = 0;
        while (i < poll_count) {
            total_options = total_options + *vector::borrow(&poll_option_counts, i);
            i = i + 1;
        };

        // Validate total options
        assert!(total_options == vector::length(&poll_option_texts), EInvalidOptionCount);
        assert!(total_options == vector::length(&poll_option_media_urls), EInvalidOptionCount);

        // Store the vote ID before any mutable borrow
        let vote_id = object::id(&vote);

        // Create polls and options
        i = 0;
        while (i < poll_count) {
            // Add poll
            let poll = Poll {
                id: object::new(ctx),
                title: *vector::borrow(&poll_titles, i),
                description: *vector::borrow(&poll_descriptions, i),
                is_multi_select: *vector::borrow(&poll_is_multi_select, i),
                max_selections: if (*vector::borrow(&poll_is_multi_select, i)) { 
                    *vector::borrow(&poll_max_selections, i)
                } else { 
                    1 
                },
                is_required: *vector::borrow(&poll_is_required, i),
                options_count: 0,
                total_responses: 0
            };

            // Add poll to vote
            let poll_index = vote.polls_count + 1;
            vote.polls_count = poll_index;
            let poll_id = object::id(&poll);
            dof::add(&mut vote.id, poll_index, poll);
            
            // Emit event for poll creation
            event::emit(PollAdded {
                vote_id,
                poll_id,
                poll_index,
                title: *vector::borrow(&poll_titles, i)
            });

            // Add options for this poll
            let option_count = *vector::borrow(&poll_option_counts, i);
            let mut j = 0;
            
            while (j < option_count) {
                // Get poll to add options
                let poll: &mut Poll = dof::borrow_mut(&mut vote.id, poll_index);

                // Get option text and media url
                let option_text = *vector::borrow(&poll_option_texts, option_text_index);
                let option_media_url = *vector::borrow(&poll_option_media_urls, option_media_index);

                // Create option
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

                // Add option to poll
                let option_index = poll.options_count + 1;
                poll.options_count = option_index;
                let option_id = object::id(&option);
                let poll_id = object::id(poll);
                dof::add(&mut poll.id, option_index, option);
                
                // Emit event for option creation
                event::emit(OptionAdded {
                    vote_id, // Use the pre-stored vote_id
                    poll_id,
                    option_id,
                    option_index,
                    text: option_text
                });

                // Increment counters
                option_text_index = option_text_index + 1;
                option_media_index = option_media_index + 1;
                j = j + 1;
            };

            i = i + 1;
        };
        
        // Update admin stats
        admin.total_votes_created = admin.total_votes_created + 1;
        
        // Emit event for frontend tracking with new fields
        event::emit(VoteCreated {
            vote_id,
            creator: tx_context::sender(ctx),
            title,
            start_timestamp,
            end_timestamp,
            polls_count: vote.polls_count,
            token_requirement: token_req,
            token_amount: token_amt,
            has_whitelist: false
        });

        // Share the vote object
        transfer::share_object(vote);
    }

    /// Cast a vote on a poll - with whitelist check
    public entry fun cast_vote(
        vote: &mut Vote,
        admin: &mut VoteAdmin,
        poll_index: u64,
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
        
        // Register vote for each selected option
        let mut i = 0;
        let option_count = vector::length(&option_indices);
        
        while (i < option_count) {
            let option_idx = *vector::borrow(&option_indices, i);
            assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
            
            let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
            option.votes = option.votes + 1;
            
            i = i + 1;
        };
        
        // Update poll response count
        poll.total_responses = poll.total_responses + 1;
        
        // Store the poll ID before releasing the borrow
        let poll_id = object::id(poll);

        // Update vote counts
        vote.total_votes = vote.total_votes + 1;
        admin.total_votes_cast = admin.total_votes_cast + 1;
        
        // Emit event for frontend tracking
        event::emit(VoteCast {
            vote_id,
            poll_id,
            voter: sender,
            option_indices
        });
    }

    /// Cast votes on multiple polls at once - with whitelist check
    public entry fun cast_multiple_votes(
        vote: &mut Vote,
        admin: &mut VoteAdmin,
        poll_indices: vector<u64>,
        option_indices_per_poll: vector<vector<u64>>,
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
            
            // Register votes
            let mut j = 0;
            let option_count = vector::length(&option_indices);
            
            while (j < option_count) {
                let option_idx = *vector::borrow(&option_indices, j);
                assert!(option_idx <= poll.options_count && option_idx > 0, EInvalidOptionIndex);
                
                let option: &mut PollOption = dof::borrow_mut(&mut poll.id, option_idx);
                option.votes = option.votes + 1;
                
                j = j + 1;
            };
            
            // Update poll response count
            poll.total_responses = poll.total_responses + 1;
            
            // Store the poll ID before releasing the borrow
            let poll_id = object::id(poll);
            
            // Emit event for frontend tracking
            event::emit(VoteCast {
                vote_id,
                poll_id,
                voter: sender,
                option_indices
            });
            
            i = i + 1;
        };
        
        // Update total votes
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

    /// Get vote details - updated with new token requirement fields
    public fun get_vote_details(vote: &Vote): (
        address, String, String, u64, u64, u64, bool, u64, u64, bool, Option<String>, Option<u64>, bool
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
            vote.has_whitelist
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
}