// components/wallet-provider.tsx
"use client"

import {
  WalletProvider,
  defineSlushWallet,
  AllDefaultWallets,
} from "@suiet/wallet-kit";
import { ReactNode } from 'react';

const slushWebWalletConfig = defineSlushWallet({
  appName: "suiVote",
});


export function SuiWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider defaultWallets={[
      ...AllDefaultWallets,
      slushWebWalletConfig,
    ]}>
      {children}
    </WalletProvider>
  );
}
