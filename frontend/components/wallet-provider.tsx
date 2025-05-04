// components/wallet-provider.tsx
"use client"

import { WalletProvider } from '@suiet/wallet-kit';
import { ReactNode } from 'react';

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
}
