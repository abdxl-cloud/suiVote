# Smart Contracts

This section delves into the Sui Move smart contracts that power the SuiVote application.

## Overview

The smart contracts are responsible for:

*   Defining the structure of votes and polls.
*   Managing the creation of new votes.
*   Handling the casting of votes by users.
*   Storing and retrieving vote data securely on the Sui blockchain.
*   Enforcing voting rules, such as deadlines and eligibility (e.g., token requirements, whitelists).

## Key Contract(s)

*   **`voting.move`**: The primary contract containing the core logic for the voting system. (Further details in [Voting Logic](./voting-logic.md))

## Directory Structure

The contracts are located in the `/contracts` directory of the project:

```
contracts/
├── Move.toml         # Package manifest
├── Move.lock         # Resolved dependencies
├── sources/
│   └── voting.move   # Main contract file
├── build/            # Compiled artifacts (generated)
└── tests/
    └── contracts_tests.move # Unit tests for the contracts
```

Understanding these contracts is crucial for developers looking to extend the platform's features or audit its security.