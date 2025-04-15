#[allow(duplicate_alias)]
module contracts::Voting {
    use sui::tx_context::sender;
    use sui::clock::{Clock, timestamp_ms};
    use sui::event;
    use sui::object;
    use sui::transfer;
    use sui::table::{Self, Table};

    // --- Error Code Constants ---
    const E_EMPTY_OPTIONS: u64 = 1;
    const E_INVALID_OPTION_INDEX: u64 = 2;
    const E_ALREADY_VOTED: u64 = 3;
    const E_NOT_ADMIN: u64 = 4;
    const E_VOTING_CLOSED: u64 = 5;
    const E_INVALID_DURATION: u64 = 6;

    // --- Custom Option-like Data ---
    public struct OptionData has copy, drop, store {
        text: vector<u8>,
        media_hash: vector<u8>
    }

    // --- Core Structs ---
    public struct Poll has key, store {
        id: object::UID,
        question: vector<u8>,
        options: vector<OptionData>,
        vote_counts: vector<u64>,
        voters: Table<address, bool>,
        start_time: u64,
        end_time: u64
    }

    public struct Election has key, store {
        id: object::UID,
        name: vector<u8>,
        description: vector<u8>,
        polls: Table<u64, Poll>,
        created_at: u64
    }

    public struct ElectionRegistry has key {
        id: object::UID,
        admin: address,
        elections: Table<u64, Election>,
        next_election_id: u64
    }

    // --- Events ---
    public struct ElectionCreatedEvent has copy, drop {
        election_id: u64,
        name: vector<u8>
    }

    public struct PollCreatedEvent has copy, drop {
        election_id: u64,
        poll_id: u64,
        question: vector<u8>
    }

    public struct VoteCastEvent has copy, drop {
        election_id: u64,
        poll_id: u64,
        voter: address,
        option_index: u64
    }

    // --- Initialization ---
    entry fun initialize_registry(ctx: &mut sui::tx_context::TxContext) {
        let registry = ElectionRegistry {
            id: object::new(ctx),
            admin: sender(ctx),
            elections: table::new(ctx),
            next_election_id: 1
        };
        transfer::share_object(registry);
    }

    // --- Election Management ---
    public entry fun create_election(
        registry: &mut ElectionRegistry,
        name: vector<u8>,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sender(ctx) == registry.admin, E_NOT_ADMIN);
        
        let election_id = registry.next_election_id;
        let new_election = Election {
            id: object::new(ctx),
            name: clone_bytes(&name),
            description: clone_bytes(&description),
            polls: table::new(ctx),
            created_at: timestamp_ms(clock)
        };

        table::add(&mut registry.elections, election_id, new_election);
        registry.next_election_id = election_id + 1;

        event::emit(ElectionCreatedEvent {
            election_id,
            name: clone_bytes(&name)
        });
    }

    // --- Poll Management ---
    public entry fun add_poll_to_election(
        registry: &mut ElectionRegistry,
        election_id: u64,
        question: vector<u8>,
        texts: vector<vector<u8>>,
        media_hashes: vector<vector<u8>>,
        start_time: u64,
        duration: u64,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sender(ctx) == registry.admin, E_NOT_ADMIN);
        
        assert!(vector::length(&texts) > 0, E_EMPTY_OPTIONS);
        assert!(duration > 0, E_INVALID_DURATION);
        let len = vector::length(&texts);
    // Optionally, ensure start_time is not in the past if using the current clock
    // let current_time = timestamp_ms(clock);
    // assert!(start_time >= current_time, E_INVALID_START_TIME);

        let election = table::borrow_mut(&mut registry.elections, election_id);
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

        let new_poll = Poll {
            id: object::new(ctx),
            question: clone_bytes(&question),
            options,
            vote_counts,
            voters: table::new(ctx),
            start_time,
            end_time: start_time + duration
        };

        table::add(&mut election.polls, poll_id, new_poll);
        event::emit(PollCreatedEvent {
            election_id,
            poll_id,
            question: clone_bytes(&question)
        });
    }

    // --- Voting Logic ---
    public entry fun vote_in_poll(
        registry: &mut ElectionRegistry,
        election_id: u64,
        poll_id: u64,
        option_index: u64,
        clock: &Clock,
        ctx: &mut sui::tx_context::TxContext
    ) {
        let current_time = timestamp_ms(clock);
        let voter = sender(ctx);
        
        let election = table::borrow_mut(&mut registry.elections, election_id);
        let poll = table::borrow_mut(&mut election.polls, poll_id);

        assert!(current_time >= poll.start_time, E_VOTING_CLOSED);
        assert!(current_time <= poll.end_time, E_VOTING_CLOSED);
        assert!(option_index < vector::length(&poll.options), E_INVALID_OPTION_INDEX);
        assert!(!table::contains(&poll.voters, voter), E_ALREADY_VOTED);

        table::add(&mut poll.voters, voter, true);
        let count = vector::borrow_mut(&mut poll.vote_counts, option_index);
        *count = *count + 1;

        event::emit(VoteCastEvent {
            election_id,
            poll_id,
            voter,
            option_index
        });
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

    // --- Admin Functions ---
    public entry fun transfer_admin(
        registry: &mut ElectionRegistry,
        new_admin: address,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(sender(ctx) == registry.admin, E_NOT_ADMIN);
        registry.admin = new_admin;
    }

    // --- Getter Functions for Testing ---
    public fun get_admin(registry: &ElectionRegistry): address {
        registry.admin
    }

        // Add these getter functions for test access
    public fun get_elections(registry: &ElectionRegistry): &Table<u64, Election> {
        &registry.elections
    }

    public fun get_polls(election: &Election): &Table<u64, Poll> {
        &election.polls
    }

    public fun get_vote_counts(poll: &Poll): &vector<u64> {
        &poll.vote_counts
    }

    public fun get_voters(poll: &Poll): &Table<address, bool> {
        &poll.voters
    }

}