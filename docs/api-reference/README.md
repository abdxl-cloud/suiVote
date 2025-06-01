# API Reference

This section provides reference information for any APIs exposed by the SuiVote project.

## Smart Contract View Functions

The primary "API" for interacting with SuiVote data is through the view functions exposed by the Sui smart contracts (primarily `voting.move`). These functions allow frontend applications and other services to read data directly from the blockchain without requiring a traditional backend API.

Key view functions (refer to [`contracts/voting-logic.md`](../contracts/voting-logic.md) for more details):

*   `get_vote_details(vote_id: ID): VoteDetails`
    *   Retrieves detailed information about a specific vote.
*   `get_vote_polls(vote_id: ID): vector<PollMetadata>`
    *   Retrieves metadata for all polls associated with a vote.
*   `get_poll_options(vote_id: ID, poll_index: u64): vector<OptionDetails>`
    *   Retrieves the options for a specific poll within a vote.
*   `has_voted(user_address: address, vote_id: ID): bool`
    *   Checks if a specific user has already voted in a given vote.
*   `is_voter_whitelisted(vote_id: ID, user_address: address): bool`
    *   Checks if a voter is whitelisted for a specific vote (if whitelisting is enabled).
*   `get_vote_results(vote_id: ID, poll_index: u64): vector<OptionResult>`
    *   Retrieves the current vote counts for each option in a poll (availability may depend on `showLiveStats` setting).

These functions are typically called using the `SuiClient` from the `@mysten/sui/client` library in the frontend.

## Frontend Services (`frontend/services/`)

The `frontend/services/suivote-service.ts` file contains helper functions that wrap these blockchain calls, providing a more convenient interface for the frontend components and hooks (like `useSuiVote`). While not a public API, it's an important part of how the frontend interacts with the contracts.

## External APIs

SuiVote may interact with external APIs for specific functionalities, such as:

*   **Token Price Feeds:** (If applicable) For displaying token values.
*   **IPFS/Arweave:** (If applicable) For storing larger media files associated with votes or polls.

If such integrations exist, their details would be documented here.

Currently, SuiVote does not expose its own backend REST or GraphQL API beyond the on-chain smart contract interactions.