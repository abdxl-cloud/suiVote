# Frontend State Management

Effective state management is crucial for a reactive and maintainable frontend. SuiVote employs a combination of React's built-in mechanisms and custom hooks.

## Core Strategies

1.  **Local Component State (`useState`, `useReducer`):**
    *   For state that is specific to a single component and doesn't need to be shared, React's `useState` hook is the primary tool. Examples include managing form inputs, UI toggles (e.g., visibility of a dropdown), or temporary UI feedback.
    *   For more complex state logic within a component, `useReducer` can be used to provide a more structured way to manage state updates, similar to Redux but localized to the component.

2.  **Custom Hooks (e.g., `useSuiVote`, `useToast`):**
    *   Custom hooks are extensively used to encapsulate and reuse stateful logic. The most significant example is `useSuiVote` (`hooks/use-suivote.ts`).
    *   `useSuiVote`: This hook manages the state related to fetching vote data, interacting with Sui smart contracts (creating transactions, signing, executing), and tracking transaction status. It often uses `useState` internally to hold data like `voteDetails`, `polls`, `loading` status, `error` messages, and `transactionDigest`.
    *   By centralizing this logic, components can consume blockchain-related state and functionality without directly handling the complexities of Sui interactions.

3.  **React Context API (`contexts/`):
    *   The React Context API is used for global state that needs to be accessible by many components at different levels of the component tree, without prop drilling.
    *   A key example is the wallet connection status, provided by `@suiet/wallet-kit`'s `WalletProvider`. This makes the wallet object (including connection status, address, and signing functions) available throughout the app via the `useWallet` hook.
    *   Custom contexts could be created if other global states are identified (e.g., theme, user preferences if not tied to wallet).

4.  **URL State (via Next.js Router):**
    *   The Next.js router (`useParams`, `useRouter`, `useSearchParams`) is used to manage state derived from the URL, such as the current vote ID (`params.id`) or query parameters (`searchParams.get('digest')`).
    *   This is essential for deep linking and ensuring the UI reflects the current URL.

## State Colocation

The general principle is to keep state as close as possible to where it's used. If state is only needed by one component, it stays local. If it's needed by a few components within a subtree, it might be lifted to a common ancestor. If it's truly global, Context API is considered.

## Data Fetching and Caching

*   Data fetching from the Sui blockchain is primarily handled within the `useSuiVote` hook and the `suivote-service.ts`.
*   `useEffect` is commonly used to trigger data fetching when component mounts or when certain dependencies (like `voteId` or `wallet.address`) change.
*   While SuiVote doesn't seem to implement a sophisticated client-side caching layer like React Query or SWR out-of-the-box for blockchain data, repeated calls to `getVoteDetails` or similar functions will refetch data. For a production application with heavy traffic, implementing a caching strategy could be beneficial to reduce redundant calls and improve performance.

## Example: Vote Page State (`app/vote/[id]/page.tsx`)

This page demonstrates several state management techniques:

*   `useState` for UI state like `loading`, `submitting`, `activePollIndex`, `selections` for user's choices, `validationErrors`.
*   `useParams` to get the `voteId` from the URL.
*   `useWallet` (from `@suiet/wallet-kit` via Context) to get wallet status and address.
*   `useSuiVote` (custom hook) to fetch vote details, polls, options, and to handle vote submission logic.
    *   The `vote`, `polls` data returned by `useSuiVote` are then stored in the page's local state using `useState`.
*   `useEffect` to trigger `fetchVoteData` when `params.id` or `wallet.connected` changes.

This multi-faceted approach allows SuiVote to manage different types of state effectively, from simple UI toggles to complex asynchronous blockchain interactions.