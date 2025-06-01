# Running the Project

Once you have installed all prerequisites and dependencies, you can run the SuiVote application.

## 1. Running the Frontend

The frontend is a Next.js application.

Navigate to the `frontend` directory and start the development server:

```bash
cd frontend
pnpm run dev
```

This will typically start the frontend application on `http://localhost:3000` (or another port if 3000 is in use). Open this URL in your web browser to see the application.

## 2. Setting up the Sui Environment

Before deploying contracts, ensure your Sui environment is configured correctly:

*   **Switch to the desired network (e.g., devnet, testnet):**
    ```bash
    sui client switch --env <your_env_alias>
    # Example: sui client switch --env devnet
    ```
*   **Ensure you have an active address and sufficient SUI for gas fees:**
    ```bash
    sui client active-address
    sui client gas
    ```
    If you need SUI for devnet or testnet, use the respective faucet.

## 3. Deploying the Smart Contracts

The Sui smart contracts are located in the `contracts` directory.

Navigate to the `contracts` directory and build the contracts:

```bash
cd ../contracts 
sui move build
```

If the build is successful, you can deploy (publish) the contracts to the Sui network:

```bash
sui client publish --gas-budget <amount> 
# Example: sui client publish --gas-budget 100000000
```

Upon successful publication, the Sui CLI will output details about the deployed package, including the `Package ID` and any created objects (like the `AdminCap` or initial state objects). **You will need to update your frontend configuration with these new IDs.**

### Updating Frontend Configuration

After publishing the contracts, you'll receive a `Package ID` and potentially other object IDs (e.g., `Admin ID` if your contract creates one upon publish).

1.  Open the frontend configuration file, likely located at `frontend/src/config/sui-config.ts` or a similar path.
2.  Update the `PACKAGE_ID` and any other relevant IDs (like `ADMIN_ID`) with the values you received from the `sui client publish` command output.

    Example (`sui-config.ts`):

    ```typescript
    export const SUI_CONFIG = {
      NETWORK: "devnet", // or "testnet", "mainnet"
      PACKAGE_ID: "YOUR_NEW_PACKAGE_ID_HERE",
      ADMIN_ID: "YOUR_NEW_ADMIN_OBJECT_ID_HERE",
      // ... other configurations
    };
    ```

3.  Save the configuration file. The frontend development server might automatically reload, or you may need to restart it.

## 4. Interacting with the Application

With the frontend running and contracts deployed (and configuration updated), you should be able to interact with the SuiVote application through your browser.

*   Create new votes.
*   Participate in existing votes.
*   View vote results (if applicable).

Refer to the specific application features for more details on usage.