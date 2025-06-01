# Frontend

This section covers the frontend application of SuiVote, built with Next.js and TypeScript.

## Overview

The frontend provides a user-friendly interface for:

*   Creating new votes and polls.
*   Discovering and participating in ongoing votes.
*   Viewing vote results.
*   Connecting Sui wallets for interaction with the blockchain.

## Technology Stack

*   **Framework:** [Next.js](https://nextjs.org/) (React framework)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components.
*   **State Management:** React Context API, `useState`, `useEffect`, and custom hooks (e.g., `useSuiVote`).
*   **Sui Integration:** `@suiet/wallet-kit` for wallet connections, `@mysten/sui/client` for direct blockchain interactions.
*   **Deployment:** (To be detailed in [Deployment](./deployment.md))

## Key Features

*   Responsive design for various screen sizes.
*   Real-time updates for vote status and results (where applicable).
*   Secure wallet integration for signing transactions.
*   Clear user flows for vote creation and participation.

## Directory Structure

The frontend code is primarily located in the `/frontend` directory:

```
frontend/
├── app/                  # Next.js App Router (pages, layouts)
│   ├── create/
│   ├── dashboard/
│   ├── edit/
│   ├── polls/
│   ├── success/
│   └── vote/
├── components/           # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Custom components
├── config/               # Application configuration (e.g., Sui network)
├── contexts/             # React Context providers
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── public/               # Static assets
├── services/             # Services for interacting with backend/blockchain
├── styles/               # Global styles
├── next.config.mjs       # Next.js configuration
├── package.json          # Project dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

Further details on specific aspects of the frontend are covered in the following pages:

*   [Architecture](./architecture.md)
*   [Key Components](./components.md)
*   [State Management](./state-management.md)
*   [Deployment](./deployment.md)