# SuiVote

A decentralized voting platform built on the **Sui blockchain**, combining **Move smart contracts** and **SUI Walrus** for efficient off-chain storage(testing). SuiVote enables anyone—wallet or non-wallet users—to create polls, vote securely, and verify results in a trustless environment.

---

## 🚀 Features

- **Trustless Voting** – All votes are recorded on-chain with cryptographic integrity.
- **Off-Chain Metadata** – Poll content is stored using SUI Walrus to reduce on-chain bloat.
- **Wallet & Guest Access** – Supports both Sui wallet users and guest participants via relayer services.
- **Live Results** – Real-time result charts with verifiable backend data.
- **Secure & Scalable** – Designed for performance, privacy, and integrity at scale.

---

## 🔧 Tech Stack

- **Blockchain**: Sui + Move  
- **Frontend**: React + TypeScript + TailwindCSS  
- **Storage**: SUI Walrus (Blob-based off-chain data)  
- **Backend (optional)**: Node.js + Express (for guest vote relayer)  
- **Wallet Integration**: WalletKit / @mysten/sui.js

---

## 📦 Project Structure

```
/contracts        → Move smart contracts  
/frontend         → React app (poll creation, voting, results)  
/backend (opt.)   → Guest vote relayer and admin tools  
/docs             → Architecture, API, and implementation details
```

---

## 📅 Development Phases

1. Smart contract design (Move)
2. Off-chain data integration (Walrus)
3. Frontend build + wallet integration
4. Optional backend relayer setup
5. Testing & security audits
6. Deployment & user feedback

---

## 🧪 Status

🛠️ **In Development**  
Currently building core contracts and integrating storage.

---

## 📄 License

MIT – Free to use, modify, and distribute.

---

Let me know if you'd like to add installation instructions, contribution guidelines, or test commands.
