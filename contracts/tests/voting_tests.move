#[test_only]
module contracts::voting_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use contracts::VotingSystem::{
        TokenRegistry,
        ElectionSystem,
        ElectionSystemAdmin,
        initialize_token_registry,
        create_election_system,
        create_election,
        add_poll_to_election,
        vote_in_poll_single,
        vote_in_poll_multiple,
        fund_election,
        close_poll,
        get_poll_results,
        has_user_voted,
        get_user_vote_details,
        get_treasury_balance
    };

    // Test addresses
    const ADMIN: address = @0x1;
    const VOTER1: address = @0x2;
    const VOTER2: address = @0x3;


    #[test]
    fun test_create_system_and_elections() {
        let mut scenario = scenario();
        test_create_system_and_elections_(&mut scenario);
        ts::end(scenario);
    }

    fun test_create_system_and_elections_(scenario: &mut Scenario) {
        // Begin with the admin
        ts::next_tx(scenario, ADMIN);
        {
            // Create a clock
            let clock = clock::create_for_testing(ts::ctx(scenario));

            // Initialize global token registry
            initialize_token_registry(ts::ctx(scenario));

            // Create an election system
            create_election_system(
                b"Test Election System",
                b"A test election system",
                &clock,
                ts::ctx(scenario)
            );

            // Clean up clock
            clock::destroy_for_testing(clock);
        };

        // Take election system admin and create an election
        ts::next_tx(scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(scenario));

            let mut system = ts::take_shared<ElectionSystem>(scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(scenario);

            // Create an election
            create_election(
                &mut system,
                &admin_cap,
                b"First Election",
                b"This is the first test election",
                &clock,
                ts::ctx(scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(scenario, admin_cap);
            clock::destroy_for_testing(clock);
        };
    }

    #[test]
    fun test_add_poll_and_vote_single() {
        let mut scenario = scenario();

        // First create the system and an election
        test_create_system_and_elections_(&mut scenario);

        // Admin adds a poll
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            // Set start time to now
            let start_time = clock::timestamp_ms(&clock);
            // Duration 1 day in milliseconds
            let duration = 86400000;

            // Create options for the poll
            let options_text = vector[
                b"Option 1",
                b"Option 2",
                b"Option 3"
            ];
            let options_media = vector[
                b"media_hash_1",
                b"media_hash_2",
                b"media_hash_3"
            ];

            // Add a new poll (single selection)
            add_poll_to_election(
                &mut system,
                &admin_cap,
                1, // election_id
                b"Which option do you prefer?",
                options_text,
                options_media,
                start_time,
                duration,
                0, // POLL_TYPE_SINGLE
                1, // max_selections (will be set to 1 anyway for single selection)
                b"", // no token requirement
                0,   // no min balance
                0,   // no reward
                false, // no weighted voting
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Voter1 votes for option 0
        ts::next_tx(&mut scenario, VOTER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_single(
                &mut system,
                1, // election_id
                1, // poll_id
                0, // option_index (option 1)
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Check if user has voted
            assert!(has_user_voted(&system, 1, 1, VOTER1), 0);

            // Get vote details
            let (options_voted, weights, _timestamp) = get_user_vote_details(&system, 1, 1, VOTER1);
            assert!(options_voted == vector[0], 1);
            assert!(weights == vector[1], 2); // weight 1 (default)

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Voter2 votes for option 1
        ts::next_tx(&mut scenario, VOTER2);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_single(
                &mut system,
                1, // election_id
                1, // poll_id
                1, // option_index (option 2)
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Check if user has voted
            assert!(has_user_voted(&system, 1, 1, VOTER2), 3);

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Check poll results
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut system = ts::take_shared<ElectionSystem>(&scenario);

            // Get results
            let (vote_counts, total_votes, closed) = get_poll_results(&system, 1, 1);

            // Verify results
            assert!(vote_counts == vector[1u64, 1u64, 0u64], 4);
            assert!(total_votes == 2, 5);
            assert!(!closed, 6);

            // Return shared object
            ts::return_shared(system);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_add_poll_and_vote_multiple() {
        let mut scenario = scenario();

        // First create the system and an election
        test_create_system_and_elections_(&mut scenario);

        // Admin adds a multiple-selection poll
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            // Set start time to now
            let start_time = clock::timestamp_ms(&clock);
            // Duration 1 day in milliseconds
            let duration = 86400000;

            // Create options for the poll
            let options_text = vector[
                b"Option 1",
                b"Option 2",
                b"Option 3",
                b"Option 4"
            ];
            let options_media = vector[
                b"media_hash_1",
                b"media_hash_2",
                b"media_hash_3",
                b"media_hash_4"
            ];

            // Add a new poll (multiple selection)
            add_poll_to_election(
                &mut system,
                &admin_cap,
                1, // election_id
                b"Select up to 2 options you prefer:",
                options_text,
                options_media,
                start_time,
                duration,
                1, // POLL_TYPE_MULTIPLE
                2, // max_selections is 2
                b"", // no token requirement
                0,   // no min balance
                0,   // no reward
                false, // no weighted voting
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Voter1 votes for options 0 and 2
        ts::next_tx(&mut scenario, VOTER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_multiple(
                &mut system,
                1, // election_id
                1, // poll_id
                vector[0, 2], // voting for Option 1 and Option 3
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Check if user has voted
            assert!(has_user_voted(&system, 1, 1, VOTER1), 7);

            // Get vote details
            let (options_voted, weights, _timestamp) = get_user_vote_details(&system, 1, 1, VOTER1);
            assert!(options_voted == vector[0u64, 2u64], 8);
            assert!(weights == vector[1u64, 1u64], 9); // weight 1 (default) for each option

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Voter2 votes for option 1 only
        ts::next_tx(&mut scenario, VOTER2);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_multiple(
                &mut system,
                1, // election_id
                1, // poll_id
                vector[1], // voting for Option 2 only
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Check if user has voted
            assert!(has_user_voted(&system, 1, 1, VOTER2), 10);

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Check poll results
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut system = ts::take_shared<ElectionSystem>(&scenario);

            // Get results
            let (vote_counts, total_votes, closed) = get_poll_results(&system, 1, 1);

            // Verify results
            assert!(vote_counts == vector[1u64, 1u64, 1u64, 0u64], 11);
            assert!(total_votes == 3, 12);
            assert!(!closed, 13);

            // Return shared object
            ts::return_shared(system);
        };

        ts::end(scenario);
    }

        
    #[test]
    fun test_fund_election_and_close_poll() {
        let mut scenario = scenario();

        // First create the system and an election
        test_create_system_and_elections_(&mut scenario);

        // Add a poll
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            // Set start time to now
            let start_time = clock::timestamp_ms(&clock);
            // Duration 1 day in milliseconds
            let duration = 86400000;

            // Create options for the poll
            let options_text = vector[b"Yes", b"No"];
            let options_media = vector[b"yes_img", b"no_img"];

            // Add a new poll
            add_poll_to_election(
                &mut system,
                &admin_cap,
                1, // election_id
                b"Do you approve?",
                options_text,
                options_media,
                start_time,
                duration,
                0, // POLL_TYPE_SINGLE
                1, // max_selections (will be set to 1 anyway for single selection)
                b"", // no token requirement
                0,   // no min balance
                0,   // no reward
                false, // no weighted voting
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Fund election
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);

            // Create a SUI coin to fund the election
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));

            // Fund the election
            fund_election(
                &mut system,
                &admin_cap,
                1, // election_id
                payment,
                ts::ctx(&mut scenario)
            );

            // Check treasury balance
            let balance = get_treasury_balance(&system, 1);
            assert!(balance == 1000, 15);

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
        };

        // Some people vote
        ts::next_tx(&mut scenario, VOTER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_single(
                &mut system,
                1, // election_id
                1, // poll_id
                0, // option_index (Yes)
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        ts::next_tx(&mut scenario, VOTER2);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_single(
                &mut system,
                1, // election_id
                1, // poll_id
                1, // option_index (No)
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Get results before closing
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut system = ts::take_shared<ElectionSystem>(&scenario);

            // Get results
            let (vote_counts, total_votes, closed) = get_poll_results(&system, 1, 1);

            // Verify results
            assert!(vote_counts == vector[1u64, 1u64], 16);
            assert!(total_votes == 2, 17);
            assert!(!closed, 18);

            // Return shared object
            ts::return_shared(system);
        };

        // Close poll
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

            // Set time to after the end time
            clock::set_for_testing(&mut clock, 1000000000000);

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);

            close_poll(
                &mut system,
                &admin_cap,
                1, // election_id
                1, // poll_id
                &clock,
                ts::ctx(&mut scenario)
            );

            // Check that poll is now closed
            let (_, _, closed) = get_poll_results(&system, 1, 1);
            assert!(closed, 19);

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_vote_with_token_requirements() {
        let mut scenario = scenario();

        // First create the system and an election
        test_create_system_and_elections_(&mut scenario);

        // Admin adds a poll with token requirements
        ts::next_tx(&mut scenario, ADMIN);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let admin_cap = ts::take_from_sender<ElectionSystemAdmin>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            // Set start time to now
            let start_time = clock::timestamp_ms(&clock);
            // Duration 1 day in milliseconds
            let duration = 86400000;

            // Create options for the poll
            let options_text = vector[b"Option A", b"Option B"];
            let options_media = vector[b"img_a", b"img_b"];

            // Add a new poll with SUI token requirement
            add_poll_to_election(
                &mut system,
                &admin_cap,
                1, // election_id
                b"Token-gated poll:",
                options_text,
                options_media,
                start_time,
                duration,
                0, // POLL_TYPE_SINGLE
                1, // max_selections
                b"SUI", // token requirement: SUI
                100,   // min balance: 100 SUI
                10,    // reward: 10 SUI
                true,  // weighted voting enabled
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Fund the election for rewards
            let payment = coin::mint_for_testing<SUI>(1000, ts::ctx(&mut scenario));
            fund_election(
                &mut system,
                &admin_cap,
                1, // election_id
                payment,
                ts::ctx(&mut scenario)
            );

            // Return shared objects
            ts::return_shared(system);
            ts::return_to_sender(&mut scenario, admin_cap);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        // Note: Since our contract has placeholder implementations for token balance checking,
        // we can't fully test token gating and weighted voting, but we can validate the flow works
        // In a real test, we would need to properly set up token balances

        // Voter1 votes in the token-gated poll (should succeed in our mock environment)
        ts::next_tx(&mut scenario, VOTER1);
        {
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let mut system = ts::take_shared<ElectionSystem>(&scenario);
            let global_registry = ts::take_shared<TokenRegistry>(&scenario);

            vote_in_poll_single(
                &mut system,
                1, // election_id
                1, // poll_id
                0, // option_index (Option A)
                &clock,
                &global_registry,
                ts::ctx(&mut scenario)
            );

            // Check if user has voted
            assert!(has_user_voted(&system, 1, 1, VOTER1), 21);

            // Return shared objects
            ts::return_shared(system);
            ts::return_shared(global_registry);
            clock::destroy_for_testing(clock);
        };

        ts::end(scenario);
    }
    

    // Helper function to create a test scenario
    fun scenario(): Scenario {
        ts::begin(ADMIN)
    }
}