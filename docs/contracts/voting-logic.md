# Voting Logic (`voting.move`)

This document outlines the core logic implemented in the `voting.move` smart contract, which is the backbone of the SuiVote application.

## Key Concepts

*   **Vote:** Represents a single voting event or proposal. It contains metadata like title, description, start/end times, and associated polls.
*   **Poll:** A specific question within a vote, with multiple options for users to choose from.
*   **Option:** A choosable answer within a poll.
*   **Voter:** A user participating in a vote.

## Core Structs

(This section should be populated with details from `voting.move`)

*   `Vote`
*   `Poll`
*   `Option`
*   `Ballot` (or similar struct for recording votes)
*   `AdminCap` (for administrative privileges)

## Main Functions

(This section should be populated with details from `voting.move`)

*   **Vote Creation:**
    *   `create_vote(...)`: Allows an admin to create a new vote with its polls and options.
*   **Voting Process:**
    *   `cast_vote(...)`: Allows a user to cast their vote for one or more options in a poll.
    *   `cast_multiple_votes(...)` (if applicable): Allows voting on multiple polls in a single transaction.
*   **Vote Management:**
    *   `close_vote(...)`: Function to end a vote after its deadline.
    *   `extend_voting_period(...)`: (If applicable) Function to extend the duration of a vote.
*   **Data Retrieval (View Functions):**
    *   `get_vote_details(...)`
    *   `get_poll_options(...)`
    *   `has_voted(...)`
    *   `get_results(...)`

## State Management

*   How vote data is stored (e.g., using Sui objects, dynamic fields).
*   How voter participation is tracked.

## Access Control

*   How administrative functions are protected (e.g., using `AdminCap`).
*   Who can create votes, cast votes, and view results.

## Event Emission

*   Events emitted for key actions like vote creation, vote casting, and vote closure.

## Further Details

For the exact implementation, please refer to the source code: [`contracts/sources/voting.move`](../../contracts/sources/voting.move).