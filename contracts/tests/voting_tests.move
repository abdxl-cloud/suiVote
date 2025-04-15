#[test_only]
#[allow(duplicate_alias)]
module contracts::voting_tests {
    use sui::test_scenario::{Self};
    use sui::clock;
    use sui::table;
    use std::vector;
    use contracts::Voting;

    const TEST_ADMIN: address = @0xA;
    const TEST_USER: address = @0xB;
    const TEST_NAME: vector<u8> = b"2024 Presidential Election";
    const TEST_DESC: vector<u8> = b"National presidential election";
    const TEST_QUESTION: vector<u8> = b"Favorite Candidate?";
    const OPTION1_TEXT: vector<u8> = b"Alice";
    const OPTION1_MEDIA: vector<u8> = b"Qm...";
    const OPTION2_TEXT: vector<u8> = b"Bob";
    const OPTION2_MEDIA: vector<u8> = b"Qm...";

    #[test]
    fun test_full_voting_flow() {
        let mut scenario = test_scenario::begin(TEST_ADMIN);
        
        // Initialize registry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            Voting::initialize_registry(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, TEST_ADMIN);
        // Create election and add poll
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::create_election(
                &mut registry,
                TEST_NAME,
                TEST_DESC,
                &clock,
                ctx
            );
            
            // Add poll
            let texts = vector[OPTION1_TEXT, OPTION2_TEXT];
            let media = vector[OPTION1_MEDIA, OPTION2_MEDIA];
            Voting::add_poll_to_election(
                &mut registry,
                1,  // election_id
                TEST_QUESTION,
                texts,
                media,
                0,   // start_time
                86400000,  // duration
                ctx
            );
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        // Test voting
        test_scenario::next_tx(&mut scenario, TEST_USER);
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::vote_in_poll(
                &mut registry,
                1,  // election_id
                1,  // poll_id
                0,  // option_index
                &clock,
                ctx
            );
            
            // Verify results
            let elections = Voting::get_elections(&registry);
            let election = table::borrow(elections, 1);
            let polls = Voting::get_polls(election);
            let poll = table::borrow(polls, 1);
            let vote_counts = Voting::get_vote_counts(poll);
            let voters = Voting::get_voters(poll);
            
            assert!(*vector::borrow(vote_counts, 0) == 1, 0);
            assert!(table::contains(voters, TEST_USER), 1);
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = Voting::E_NOT_ADMIN)]
    fun test_non_admin_create_election() {
        let mut scenario = test_scenario::begin(TEST_ADMIN);
        
        // Initialize registry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            Voting::initialize_registry(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, TEST_USER);
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::create_election(
                &mut registry,
                TEST_NAME,
                TEST_DESC,
                &clock,
                ctx
            );
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = Voting::E_ALREADY_VOTED)]
    fun test_double_voting_prevention() {
        let mut scenario = test_scenario::begin(TEST_ADMIN);
        
        // Initialize registry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            Voting::initialize_registry(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, TEST_ADMIN);
        // Setup
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::create_election(&mut registry, TEST_NAME, TEST_DESC, &clock, ctx);
            
            let texts = vector[OPTION1_TEXT];
            let media = vector[OPTION1_MEDIA];
            Voting::add_poll_to_election(
                &mut registry,
                1,
                TEST_QUESTION,
                texts,
                media,
                0,
                86400000,
                ctx
            );
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        // First vote
        test_scenario::next_tx(&mut scenario, TEST_USER);
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::vote_in_poll(&mut registry, 1, 1, 0, &clock, ctx);
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        // Second vote (should fail)
        test_scenario::next_tx(&mut scenario, TEST_USER);
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::vote_in_poll(&mut registry, 1, 1, 0, &clock, ctx);
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_admin_transfer() {
        let mut scenario = test_scenario::begin(TEST_ADMIN);
        
        // Initialize registry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            Voting::initialize_registry(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, TEST_ADMIN);
        // Transfer admin
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            
            Voting::transfer_admin(&mut registry, TEST_USER, ctx);
            
            assert!(Voting::get_admin(&registry) == TEST_USER, 0);
            
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = Voting::E_INVALID_OPTION_INDEX)]
    fun test_invalid_option_voting() {
        let mut scenario = test_scenario::begin(TEST_ADMIN);
        
        // Initialize registry
        {
            let ctx = test_scenario::ctx(&mut scenario);
            Voting::initialize_registry(ctx);
        };
        
        test_scenario::next_tx(&mut scenario, TEST_ADMIN);
        // Setup
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::create_election(&mut registry, TEST_NAME, TEST_DESC, &clock, ctx);
            
            let texts = vector[OPTION1_TEXT];
            let media = vector[OPTION1_MEDIA];
            Voting::add_poll_to_election(
                &mut registry,
                1,
                TEST_QUESTION,
                texts,
                media,
                0,
                86400000,
                ctx
            );
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        // Attempt invalid vote
        test_scenario::next_tx(&mut scenario, TEST_USER);
        {
            let mut registry = test_scenario::take_shared<Voting::ElectionRegistry>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let clock = clock::create_for_testing(ctx);
            
            Voting::vote_in_poll(&mut registry, 1, 1, 1, &clock, ctx);
            
            clock::destroy_for_testing(clock);
            test_scenario::return_shared(registry);
        };

        test_scenario::end(scenario);
    }
}