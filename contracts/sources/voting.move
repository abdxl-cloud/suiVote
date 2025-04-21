module contracts::VotingSystem {
    use sui::tx_context::{sender};
    use sui::clock::{Clock, timestamp_ms};
    use sui::event;
    use sui::table::{Self, Table};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use std::string;

    // --- Error Code Constants ---
    const E_EMPTY_OPTIONS: u64 = 1;
    const E_INVALID_OPTION_INDEX: u64 = 2;
    const E_ALREADY_VOTED: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_VOTING_CLOSED: u64 = 5;
    const E_INVALID_DURATION: u64 = 6;
    const E_INSUFFICIENT_TOKEN_BALANCE: u64 = 7;
    const E_VOTING_NOT_STARTED: u64 = 8;
    const E_VOTING_IN_PROGRESS: u64 = 9;
    const E_INCORRECT_TOKEN_TYPE: u64 = 10;
    const E_TOKEN_TYPE_EXISTS: u64 = 11;
    const E_ALREADY_VOTED_FOR_OPTION: u64 = 12;
    const E_MAX_SELECTION_REACHED: u64 = 13;

    // --- Poll Type ---
    const POLL_TYPE_SINGLE: u8 = 0;
    const POLL_TYPE_MULTIPLE: u8 = 1;

    // --- Token Registry Object (shared) ---
    public struct TokenRegistry has key {
        id: UID,
        token_types: Table<u64, TokenInfo>,
        admin: address
    }

    // --- Custom Option-like Data ---
    public struct OptionData has copy, drop, store {
        text: vector<u8>,
        media_hash: vector<u8>
    }

    // --- Token Requirements ---
    public struct TokenRequirement has copy, drop, store {
        token_type: vector<u8>,
        // String representation of token type
        min_balance: u64,
        // Minimum token balance required
        reward_amount: u64,
        // Amount to reward voters
        use_weighted_voting: bool    // Flag to determine if voting should be weighted
    }

    // --- Token Info for Dynamic Token Checking ---
    public struct TokenInfo has store, drop {
        module_address: address,
        module_name: vector<u8>,
        struct_name: vector<u8>
    }

    // --- Vote Record ---
    public struct VoteRecord has store, drop {
        options_voted: vector<u64>,
        // Changed to store multiple options
        weights: vector<u64>,
        // Weights per option voted
        timestamp: u64
    }

    // --- Core Structs ---
    public struct Poll has key, store {
        id: UID,
        question: vector<u8>,
        options: vector<OptionData>,
        vote_counts: vector<u64>,
        voters: Table<address, VoteRecord>,
        start_time: u64,
        end_time: u64,
        token_requirement: Option<TokenRequirement>,
        poll_type: u8,
        // Single or multiple selection
        max_selections: u64,
        // Max number of options a voter can select
        total_votes: u64,
        closed: bool
    }

    // --- NEW: Admin Capability for each Election System ---
    public struct ElectionSystemAdmin has key {
        id: UID,
        election_system_id: ID,
        owner: address
    }

    // --- NEW: User-controlled Election System ---
    public struct ElectionSystem has key {
        id: UID,
        name: vector<u8>,
        description: vector<u8>,
        admin: address,
        elections: Table<u64, Election>,
        next_election_id: u64,
        system_token_types: Table<u64, TokenInfo>,
        // System-specific tokens
        created_at: u64
    }

    public struct Election has key, store {
        id: UID,
        name: vector<u8>,
        description: vector<u8>,
        polls: Table<u64, Poll>,
        created_at: u64,
        // Treasury for voter rewards
        reward_treasury: Balance<SUI>
    }

    // --- Events ---
    public struct ElectionSystemCreatedEvent has copy, drop {
        system_id: ID,
        owner: address,
        name: vector<u8>
    }

    public struct ElectionCreatedEvent has copy, drop {
        system_id: ID,
        election_id: u64,
        name: vector<u8>
    }

    public struct PollCreatedEvent has copy, drop {
        system_id: ID,
        election_id: u64,
        poll_id: u64,
        question: vector<u8>,
        poll_type: u8
    }

    public struct VoteCastEvent has copy, drop {
        system_id: ID,
        election_id: u64,
        poll_id: u64,
        voter: address,
        option_indices: vector<u64>,
        weights: vector<u64>
    }

    public struct VoterRewardEvent has copy, drop {
        voter: address,
        amount: u64
    }

    public struct PollClosedEvent has copy, drop {
        system_id: ID,
        election_id: u64,
        poll_id: u64,
        winning_options: vector<u64>
    }

    public struct TokenTypeRegisteredEvent has copy, drop {
        registry_type: vector<u8>,
        // "global" or "system"
        system_id: Option<ID>,
        token_type_name: vector<u8>,
        module_address: address
    }

    // --- Initialization ---
    public entry fun initialize_token_registry(ctx: &mut TxContext) {
        let registry = TokenRegistry {
            id: object::new(ctx),
            token_types: table::new(ctx),
            admin: sender(ctx)
        };
        transfer::share_object(registry);
    }

    // --- NEW: Create an election system owned by the sender ---
    public entry fun create_election_system(
        name: vector<u8>,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let owner = sender(ctx);
        let system_id = object::new(ctx);
        let system_id_copy = object::uid_to_inner(&system_id);

        // Create the election system
        let system = ElectionSystem {
            id: system_id,
            name: clone_bytes(&name),
            description: clone_bytes(&description),
            admin: owner,
            elections: table::new(ctx),
            next_election_id: 1,
            system_token_types: table::new(ctx),
            created_at: timestamp_ms(clock)
        };

        // Create admin capability for this system
        let admin_cap = ElectionSystemAdmin {
            id: object::new(ctx),
            election_system_id: system_id_copy,
            owner
        };

        // Transfer objects to the creator
        transfer::share_object(system);
        transfer::transfer(admin_cap, owner);

        event::emit(ElectionSystemCreatedEvent {
            system_id: system_id_copy,
            owner,
            name: clone_bytes(&name)
        });
    }

    // --- Election Management ---
    public entry fun create_election(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        name: vector<u8>,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        let election_id = system.next_election_id;
        let new_election = Election {
            id: object::new(ctx),
            name: clone_bytes(&name),
            description: clone_bytes(&description),
            polls: table::new(ctx),
            created_at: timestamp_ms(clock),
            reward_treasury: balance::zero()
        };

        table::add(&mut system.elections, election_id, new_election);
        system.next_election_id = election_id + 1;

        event::emit(ElectionCreatedEvent {
            system_id,
            election_id,
            name: clone_bytes(&name)
        });
    }

    // --- Fund Election ---
    public entry fun fund_election(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        election_id: u64,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        let election = table::borrow_mut(&mut system.elections, election_id);
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut election.reward_treasury, payment_balance);
    }

    // --- Poll Management with Token Requirements ---
    public entry fun add_poll_to_election(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        election_id: u64,
        question: vector<u8>,
        texts: vector<vector<u8>>,
        media_hashes: vector<vector<u8>>,
        start_time: u64,
        duration: u64,
        poll_type: u8,
        max_selections: u64,
        // Token requirement fields (optional)
        token_type: vector<u8>,
        min_balance: u64,
        reward_amount: u64,
        use_weighted_voting: bool,
        global_token_registry: &TokenRegistry,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        assert!(vector::length(&texts) > 0, E_EMPTY_OPTIONS);
        assert!(duration > 0, E_INVALID_DURATION);
        let len = vector::length(&texts);

        // Validate poll type and max selections
        assert!(poll_type == POLL_TYPE_SINGLE || poll_type == POLL_TYPE_MULTIPLE, E_INVALID_OPTION_INDEX);

        // For single select polls, max_selections should be 1
        // For multiple select polls, max_selections should be between 1 and number of options
        let mut max_selections = max_selections;
        if (poll_type == POLL_TYPE_SINGLE) {
            max_selections = 1;
        } else {
            assert!(max_selections >= 1 && max_selections <= len, E_INVALID_OPTION_INDEX);
        };

        // Validate token type if specified
        if (vector::length(&token_type) > 0) {
            let token_id = hash_token_type(&token_type);
            // Check in system tokens first, then global tokens
            if (!is_builtin_token(&token_type) &&
                !table::contains(&system.system_token_types, token_id) &&
                !table::contains(&global_token_registry.token_types, token_id)) {
                abort E_INCORRECT_TOKEN_TYPE
            }
        };

        let election = table::borrow_mut(&mut system.elections, election_id);
        let poll_id = table::length(&election.polls) + 1;

        let mut options = vector::empty<OptionData>();
        let mut vote_counts = vector::empty<u64>();

        let mut i = 0;
        while (i < len) {
            vector::push_back(&mut options, OptionData {
                text: clone_bytes(vector::borrow(&texts, i)),
                media_hash: clone_bytes(vector::borrow(&media_hashes, i))
            });
            vector::push_back(&mut vote_counts, 0);
            i = i + 1;
        };

        // Create token requirement if specified
        let token_requirement = if (vector::length(&token_type) > 0 && min_balance > 0) {
            option::some(TokenRequirement {
                token_type: token_type,
                min_balance: min_balance,
                reward_amount: reward_amount,
                use_weighted_voting: use_weighted_voting
            })
        } else {
            option::none()
        };

        let new_poll = Poll {
            id: object::new(ctx),
            question: clone_bytes(&question),
            options,
            vote_counts,
            voters: table::new(ctx),
            start_time,
            end_time: start_time + duration,
            token_requirement,
            poll_type,
            max_selections,
            total_votes: 0,
            closed: false
        };

        table::add(&mut election.polls, poll_id, new_poll);
        event::emit(PollCreatedEvent {
            system_id,
            election_id,
            poll_id,
            question: clone_bytes(&question),
            poll_type
        });
    }

    // --- Single Voting Logic ---
    public entry fun vote_in_poll_single(
        system: &mut ElectionSystem,
        election_id: u64,
        poll_id: u64,
        option_index: u64,
        clock: &Clock,
        global_token_registry: &TokenRegistry,
        ctx: &mut TxContext
    ) {
        let current_time = timestamp_ms(clock);
        let voter = sender(ctx);
        let system_id = object::uid_to_inner(&system.id);

        // First validate the poll and basic requirements before any mutable borrows
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        assert!(current_time >= poll.start_time, E_VOTING_NOT_STARTED);
        assert!(current_time <= poll.end_time, E_VOTING_CLOSED);
        assert!(!poll.closed, E_VOTING_CLOSED);
        assert!(option_index < vector::length(&poll.options), E_INVALID_OPTION_INDEX);
        assert!(!table::contains(&poll.voters, voter), E_ALREADY_VOTED);
        assert!(poll.poll_type == POLL_TYPE_SINGLE, E_INVALID_OPTION_INDEX);

        // Check token requirements before mutable borrows
        let (should_reward, reward_amount, vote_weight) = validate_token_requirement(
            system,
            global_token_registry,
            voter,
            &poll.token_requirement
        );

        // Now we can do mutable borrows
        let election = table::borrow_mut(&mut system.elections, election_id);
        let poll = table::borrow_mut(&mut election.polls, poll_id);

        // Record the vote with weight
        let mut options_voted = vector::empty<u64>();
        let mut weights = vector::empty<u64>();
        vector::push_back(&mut options_voted, option_index);
        vector::push_back(&mut weights, vote_weight);

        table::add(&mut poll.voters, voter, VoteRecord {
            options_voted,
            weights,
            timestamp: current_time
        });

        // Update vote counts
        let count = vector::borrow_mut(&mut poll.vote_counts, option_index);
        *count = *count + vote_weight;
        poll.total_votes = poll.total_votes + vote_weight;

        // Now process reward if needed
        if (should_reward) {
            process_voter_reward(election, voter, reward_amount, ctx);
        };

        event::emit(VoteCastEvent {
            system_id,
            election_id,
            poll_id,
            voter,
            option_indices: options_voted,
            weights
        });
    }

    // --- Multiple Voting Logic ---
    public entry fun vote_in_poll_multiple(
        system: &mut ElectionSystem,
        election_id: u64,
        poll_id: u64,
        option_indices: vector<u64>,
        clock: &Clock,
        global_token_registry: &TokenRegistry,
        ctx: &mut TxContext
    ) {
        let current_time = timestamp_ms(clock);
        let voter = sender(ctx);
        let system_id = object::uid_to_inner(&system.id);

        // First validate the poll and basic requirements before any mutable borrows
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        assert!(current_time >= poll.start_time, E_VOTING_NOT_STARTED);
        assert!(current_time <= poll.end_time, E_VOTING_CLOSED);
        assert!(!poll.closed, E_VOTING_CLOSED);
        assert!(poll.poll_type == POLL_TYPE_MULTIPLE, E_INVALID_OPTION_INDEX);
        assert!(!table::contains(&poll.voters, voter), E_ALREADY_VOTED);

        // Validate selections
        let num_selections = vector::length(&option_indices);
        assert!(num_selections > 0 && num_selections <= poll.max_selections, E_MAX_SELECTION_REACHED);

        // Ensure unique selections
        let mut i = 0;
        while (i < num_selections) {
            let option_idx = *vector::borrow(&option_indices, i);
            assert!(option_idx < vector::length(&poll.options), E_INVALID_OPTION_INDEX);

            // Check for duplicates in selection
            let mut j = i + 1;
            while (j < num_selections) {
                assert!(*vector::borrow(&option_indices, i) != *vector::borrow(&option_indices, j),
                    E_ALREADY_VOTED_FOR_OPTION);
                j = j + 1;
            };
            i = i + 1;
        };

        // Check token requirements before mutable borrows
        let (should_reward, reward_amount, vote_weight) = validate_token_requirement(
            system,
            global_token_registry,
            voter,
            &poll.token_requirement
        );

        // Now we can do mutable borrows
        let election = table::borrow_mut(&mut system.elections, election_id);
        let poll = table::borrow_mut(&mut election.polls, poll_id);

        // Create weights vector - all options get same weight
        let mut weights = vector::empty<u64>();
        let mut k = 0;
        while (k < num_selections) {
            vector::push_back(&mut weights, vote_weight);
            k = k + 1;
        };

        // Record the votes with weights
        table::add(&mut poll.voters, voter, VoteRecord {
            options_voted: clone_vector(&option_indices),
            weights: weights,
            timestamp: current_time
        });

        // Update vote counts for all selected options
        let mut m = 0;
        while (m < num_selections) {
            let option_idx = *vector::borrow(&option_indices, m);
            let count = vector::borrow_mut(&mut poll.vote_counts, option_idx);
            *count = *count + vote_weight;
            poll.total_votes = poll.total_votes + vote_weight;
            m = m + 1;
        };

        // Now process reward if needed
        if (should_reward) {
            process_voter_reward(election, voter, reward_amount, ctx);
        };

        event::emit(VoteCastEvent {
            system_id,
            election_id,
            poll_id,
            voter,
            option_indices: clone_vector(&option_indices),
            weights
        });
    }

    // --- Token Management ---
    // Global token registry management
    public entry fun register_global_token_type(
        registry: &mut TokenRegistry,
        token_type_name: vector<u8>,
        module_address: address,
        module_name: vector<u8>,
        struct_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(sender(ctx) == registry.admin, E_NOT_ADMIN);

        let token_id = hash_token_type(&token_type_name);
        // Make sure token type doesn't already exist
        assert!(!table::contains(&registry.token_types, token_id), E_TOKEN_TYPE_EXISTS);

        let token_info = TokenInfo {
            module_address,
            module_name: clone_bytes(&module_name),
            struct_name: clone_bytes(&struct_name)
        };

        table::add(&mut registry.token_types, token_id, token_info);

        event::emit(TokenTypeRegisteredEvent {
            registry_type: b"global",
            system_id: option::none(),
            token_type_name: clone_bytes(&token_type_name),
            module_address
        });
    }

    // System-specific token registration
    public entry fun register_system_token_type(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        token_type_name: vector<u8>,
        module_address: address,
        module_name: vector<u8>,
        struct_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        let token_id = hash_token_type(&token_type_name);
        // Make sure token type doesn't already exist in this system
        assert!(!table::contains(&system.system_token_types, token_id), E_TOKEN_TYPE_EXISTS);

        let token_info = TokenInfo {
            module_address,
            module_name: clone_bytes(&module_name),
            struct_name: clone_bytes(&struct_name)
        };

        table::add(&mut system.system_token_types, token_id, token_info);

        event::emit(TokenTypeRegisteredEvent {
            registry_type: b"system",
            system_id: option::some(system_id),
            token_type_name: clone_bytes(&token_type_name),
            module_address
        });
    }

    // --- Close Poll ---
    public entry fun close_poll(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        election_id: u64,
        poll_id: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        let current_time = timestamp_ms(clock);
        let election = table::borrow_mut(&mut system.elections, election_id);
        let poll = table::borrow_mut(&mut election.polls, poll_id);

        // Only allow closing if voting period ended or admin decides to close early
        assert!(current_time > poll.end_time || sender(ctx) == system.admin, E_VOTING_IN_PROGRESS);

        poll.closed = true;

        // Find winning options
        let winning_options = get_winning_options(poll);

        event::emit(PollClosedEvent {
            system_id,
            election_id,
            poll_id,
            winning_options
        });
    }

    // --- Admin Functions ---
    public entry fun transfer_system_admin(
        system: &mut ElectionSystem,
        admin_cap: &mut ElectionSystemAdmin,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        system.admin = new_admin;
        admin_cap.owner = new_admin;
    }

    public entry fun transfer_token_registry_admin(
        registry: &mut TokenRegistry,
        new_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(sender(ctx) == registry.admin, E_NOT_ADMIN);
        registry.admin = new_admin;
    }

    public entry fun extend_voting_period(
        system: &mut ElectionSystem,
        admin_cap: &ElectionSystemAdmin,
        election_id: u64,
        poll_id: u64,
        new_end_time: u64,
        ctx: &mut TxContext
    ) {
        // Verify admin capability matches this system
        let system_id = object::uid_to_inner(&system.id);
        assert!(admin_cap.election_system_id == system_id, E_NOT_ADMIN);
        assert!(admin_cap.owner == sender(ctx), E_NOT_ADMIN);

        let election = table::borrow_mut(&mut system.elections, election_id);
        let poll = table::borrow_mut(&mut election.polls, poll_id);

        assert!(!poll.closed, E_VOTING_CLOSED);
        assert!(new_end_time > poll.end_time, E_INVALID_DURATION);

        poll.end_time = new_end_time;
    }

    // --- Utility Functions ---
    fun clone_bytes(src: &vector<u8>): vector<u8> {
        let mut clone = vector::empty<u8>();
        let len = vector::length(src);
        let mut i = 0;
        while (i < len) {
            vector::push_back(&mut clone, *vector::borrow(src, i));
            i = i + 1;
        };
        clone
    }

    fun clone_vector<T: copy>(src: &vector<T>): vector<T> {
        let mut clone = vector::empty<T>();
        let len = vector::length(src);
        let mut i = 0;
        while (i < len) {
            vector::push_back(&mut clone, *vector::borrow(src, i));
            i = i + 1;
        };
        clone
    }
    // --- Helper Functions for Token and Voting Logic ---

    // --- Helper Functions for Token and Voting Logic ---

    // First, create a helper function that handles all the token checking before any mutable borrows
    fun validate_token_requirement(
        system: &ElectionSystem,
        global_registry: &TokenRegistry,
        voter: address,
        token_requirement: &Option<TokenRequirement>
    ): (bool, u64, u64) {
        // Default values
        let mut should_reward = false;
        let mut reward_amount = 0u64;
        let mut vote_weight = 1u64;

        if (option::is_some(token_requirement)) {
            let req = option::borrow(token_requirement);

            // Handle built-in tokens first (like SUI)
            let mut token_balance = 0u64;

            if (is_builtin_token(&req.token_type)) {
                token_balance = check_sui_balance(voter);
            } else {
                // Try to look up token in system tokens first
                let token_id = hash_token_type(&req.token_type);
                if (table::contains(&system.system_token_types, token_id)) {
                    let token_info = table::borrow(&system.system_token_types, token_id);
                    token_balance = check_token_balance_dynamic(
                        token_info.module_address,
                        &token_info.module_name,
                        &token_info.struct_name,
                        voter
                    );
                } else if (table::contains(&global_registry.token_types, token_id)) {
                    // Then try global registry
                    let token_info = table::borrow(&global_registry.token_types, token_id);
                    token_balance = check_token_balance_dynamic(
                        token_info.module_address,
                        &token_info.module_name,
                        &token_info.struct_name,
                        voter
                    );
                };
            };

            // Abort if insufficient balance
            assert!(token_balance >= req.min_balance, E_INSUFFICIENT_TOKEN_BALANCE);

            // Calculate vote weight based on token balance IF weighted voting is enabled
            if (req.use_weighted_voting) {
                vote_weight = calculate_vote_weight(token_balance, req.min_balance);
            };

            // Process reward if specified
            should_reward = req.reward_amount > 0;
            reward_amount = req.reward_amount;
        };

        (should_reward, reward_amount, vote_weight)
    }

    // Calculate vote weight based on token balance
    fun calculate_vote_weight(token_balance: u64, min_balance: u64): u64 {
        // Basic square root calculation for weighted voting
        // This creates a curve where more tokens = more voting power,
        // but with diminishing returns

        // If balance is less than min, return 1
        if (token_balance < min_balance) {
            return 1
        };

        // Simple implementation: weight = sqrt(balance / min_balance)
        // Since Move doesn't have floating point, we approximate sqrt
        // using integer math with scaled precision

        // Scale factor to simulate floating point (multiply by 1000)
        let scaled = (token_balance * 1000) / min_balance;

        // Find integer square root of scaled value
        let mut x = scaled;
        let mut y = (x + 1) / 2;

        while (y < x) {
            x = y;
            y = (x + scaled / x) / 2;
        };

        // Unscale back to get integer result (divide by ~32 to scale back)
        // This divisor is chosen to provide reasonable weights
        (x / 32) + 1
    }

    // Process voter reward
    fun process_voter_reward(
        election: &mut Election,
        voter: address,
        reward_amount: u64,
        ctx: &mut TxContext
    ) {
        // Check if we have enough balance in treasury to reward
        if (balance::value(&election.reward_treasury) >= reward_amount && reward_amount > 0) {
            // Split the balance and send it to voter
            let reward_coin = coin::from_balance(
                balance::split(&mut election.reward_treasury, reward_amount),
                ctx
            );
            transfer::public_transfer(reward_coin, voter);

            event::emit(VoterRewardEvent {
                voter,
                amount: reward_amount
            });
        }
    }

    // Hash token type name to create a token identifier
    fun hash_token_type(token_type: &vector<u8>): u64 {
        // Simple hashing based on bytes in the token type name
        // In a production system, a more sophisticated hashing algorithm would be used
        let mut hash = 0u64;
        let len = vector::length(token_type);
        let mut i = 0;

        while (i < len) {
            let byte = *vector::borrow(token_type, i);
            hash = ((hash << 5) + hash) + (byte as u64);
            i = i + 1;
        };

        hash
    }

    // Check if a token type is one of our built-in tokens (like SUI)
    fun is_builtin_token(token_type: &vector<u8>): bool {
        // For now we just check if it's SUI
        string::utf8(*token_type) == string::utf8(b"SUI")
    }

    // This is a placeholder - in a real implementation, this would need to use
    // Sui's dynamic field or adapter pattern to check balance of arbitrary tokens
    fun check_token_balance_dynamic(
        _module_address: address,
        _module_name: &vector<u8>,
        _struct_name: &vector<u8>,
        _user: address
    ): u64 {
        // This would use Move's dynamic dispatch features to check
        // the balance of the specified token
        // For now, we'll just return a placeholder value
        // In production, this should be implemented properly
        1000
    }

    // Simple placeholder for checking SUI balance
    // In a real implementation, this would use Sui's APIs
    fun check_sui_balance(_user: address): u64 {
        // For illustration only - in production code this would
        // use Sui's balance checking APIs
        1000
    }

    // Get winning options for a poll (handles ties and multi-select)
    fun get_winning_options(poll: &Poll): vector<u64> {
        let mut winning_options = vector::empty<u64>();
        let option_count = vector::length(&poll.options);

        // If no votes cast, return empty vector
        if (poll.total_votes == 0) {
            return winning_options
        };

        // Find the maximum vote count
        let mut max_votes = 0u64;
        let mut i = 0;
        while (i < option_count) {
            let vote_count = *vector::borrow(&poll.vote_counts, i);
            if (vote_count > max_votes) {
                max_votes = vote_count;
            };
            i = i + 1;
        };

        // Include all options that have the maximum vote count (handling ties)
        let mut j = 0;
        while (j < option_count) {
            let vote_count = *vector::borrow(&poll.vote_counts, j);
            if (vote_count == max_votes) {
                vector::push_back(&mut winning_options, j);
            };
            j = j + 1;
        };

        winning_options
    }

    // --- Query Functions ---
    // These view functions allow clients to retrieve data without modifying state

    public fun get_poll_results(
        system: &ElectionSystem,
        election_id: u64,
        poll_id: u64
    ): (vector<u64>, u64, bool) {
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        (clone_vector(&poll.vote_counts), poll.total_votes, poll.closed)
    }

    public fun get_poll_details(
        system: &ElectionSystem,
        election_id: u64,
        poll_id: u64
    ): (vector<u8>, u64, u64, bool, u8, u64) {
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        (
            clone_bytes(&poll.question),
            poll.start_time,
            poll.end_time,
            poll.closed,
            poll.poll_type,
            poll.max_selections
        )
    }

    public fun has_user_voted(
        system: &ElectionSystem,
        election_id: u64,
        poll_id: u64,
        user: address
    ): bool {
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        table::contains(&poll.voters, user)
    }

    public fun get_user_vote_details(
        system: &ElectionSystem,
        election_id: u64,
        poll_id: u64,
        user: address
    ): (vector<u64>, vector<u64>, u64) {
        let election = table::borrow(&system.elections, election_id);
        let poll = table::borrow(&election.polls, poll_id);

        let vote_record = table::borrow(&poll.voters, user);

        (
            clone_vector(&vote_record.options_voted),
            clone_vector(&vote_record.weights),
            vote_record.timestamp
        )
    }

    public fun get_treasury_balance(
        system: &ElectionSystem,
        election_id: u64
    ): u64 {
        let election = table::borrow(&system.elections, election_id);
        balance::value(&election.reward_treasury)
    }
}