# Installation

Follow these steps to clone the SuiVote repository and install the necessary dependencies.

## 1. Clone the Repository

Open your terminal and run the following command to clone the project:

```bash
git clone https://github.com/your-username/suivote.git # Replace with your actual repository URL
cd suivote
```

## 2. Install Frontend Dependencies

The frontend is built with Next.js and uses pnpm as the package manager.

Navigate to the `frontend` directory and install the dependencies:

```bash
cd frontend
pnpm install
```

This will install all the packages listed in the `package.json` file.

## 3. Install Contract Dependencies (if any)

The Sui smart contracts are located in the `contracts` directory. Move contracts typically manage their dependencies via the `Move.toml` file.

Navigate to the `contracts` directory. If there are specific dependency installation steps beyond what the Sui CLI handles during the build process, they would be listed here. Often, dependencies are fetched when you build the contracts.

```bash
cd ../contracts 
# No explicit dependency installation command is usually needed here for Move projects
# Dependencies are typically resolved during the build process (e.g., sui move build)
```

After completing these steps, you should have all the necessary code and dependencies installed. You can now proceed to [Running the Project](./running-the-project.md).