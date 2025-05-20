# Frontend Architecture

This document describes the architecture of the SuiVote frontend application.

## Overview

The frontend is built using Next.js with the App Router, providing a modern, server-component-first approach to building React applications. It interacts with Sui smart contracts via the `useSuiVote` custom hook and related services.

## Key Architectural Decisions

*   **Next.js App Router:** Chosen for its benefits in server-side rendering (SSR), static site generation (SSG), improved routing, and support for React Server Components.
*   **TypeScript:** For static typing, leading to more maintainable and less error-prone code.
*   **Tailwind CSS & shadcn/ui:** For rapid UI development with a utility-first CSS framework and pre-built, accessible components.
*   **Modular Structure:** Code is organized into directories like `app` (routing), `components` (UI), `hooks` (reusable logic), `services` (blockchain interaction), and `config` (settings).

## Main Components and Flow

1.  **Pages (`app/` directory):** Each route (e.g., `/vote/[id]`, `/create`) has its own directory containing `page.tsx` (the main UI for the route) and potentially `layout.tsx` or `loading.tsx`.
    *   Client Components (`"use client"`) are used for pages requiring interactivity, state, or browser APIs.
    *   Server Components are used where possible for improved performance.

2.  **UI Components (`components/`):**
    *   **Custom Components:** Specific to SuiVote (e.g., `WalletConnectButton`, `ShareDialog`).
    *   **shadcn/ui Components (`components/ui/`):** Base UI elements like buttons, cards, inputs, etc., which are customizable.

3.  **Hooks (`hooks/`):
    *   `useSuiVote.ts`:** The central hook for interacting with the SuiVote smart contracts. It encapsulates logic for fetching vote data, casting votes, and checking user status. This promotes reusability and separation of concerns.
    *   Other utility hooks (e.g., `useMediaQuery`, `useMobile`).

4.  **Services (`services/`):
    *   `suivote-service.ts`:** Contains functions that directly interact with the Sui blockchain using `@mysten/sui/client` and construct transaction blocks. This service is primarily used by the `useSuiVote` hook.
    *   `token-service.ts`:** (If applicable) For fetching token metadata or balances.

5.  **State Management:**
    *   **Local Component State (`useState`, `useReducer`):** Used for managing UI state within individual components.
    *   **React Context API (`contexts/`):** Used for global state like wallet connection status (`WalletProvider` from `@suiet/wallet-kit`).
    *   **Custom Hooks:** As seen with `useSuiVote`, custom hooks often manage their own related state and expose it to components.

6.  **Sui Blockchain Interaction:**
    *   **Wallet Connection:** Handled by `@suiet/wallet-kit` and its `WalletProvider` and `useWallet` hook.
    *   **Contract Calls:** Orchestrated by `useSuiVote`, which uses `suivote-service.ts` to build transaction blocks and `useWallet` to sign and execute them.
    *   **Data Fetching:** Primarily through view functions exposed by the smart contracts, called via the `SuiClient`.

## Data Flow Example (Casting a Vote)

1.  User interacts with a voting UI component on a page (e.g., `app/vote/[id]/page.tsx`).
2.  The page component, using the `useSuiVote` hook, calls a function like `handleSubmitVote`.
3.  `handleSubmitVote` (within `page.tsx` or `useSuiVote`) validates input and prepares data.
4.  It then calls a method from `useSuiVote` (e.g., `castVoteTransaction` or `castMultipleVotesTransaction`).
5.  The `useSuiVote` method uses `suivote-service.ts` to construct the appropriate transaction block.
6.  The `useSuiVote` hook then uses `wallet.signAndExecuteTransactionBlock` (from `@suiet/wallet-kit`) to prompt the user to sign and submit the transaction.
7.  The UI updates based on the transaction status (loading, success, error).

## Configuration (`config/`)

*   `sui-config.ts`: Stores crucial information like the Sui network (devnet, testnet, mainnet), `PACKAGE_ID` of the deployed smart contracts, and `ADMIN_ID`.

This architecture aims for a balance between modern React practices, type safety, efficient blockchain interaction, and maintainability.