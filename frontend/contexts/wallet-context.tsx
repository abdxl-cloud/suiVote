"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets } from "@mysten/dapp-kit"
import { toast } from "@/components/ui/use-toast"

// Note: We're not importing the CSS file directly to avoid the MIME type error

interface WalletContextType {
  connecting: boolean
  connected: boolean
  address: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  walletName: string | null
  availableWallets: string[]
}

const WalletContext = createContext<WalletContextType>({
  connecting: false,
  connected: false,
  address: null,
  connect: async () => {},
  disconnect: async () => {},
  walletName: null,
  availableWallets: [],
})

export const useWallet = () => useContext(WalletContext)

// Create a wrapper component that uses the Mysten dApp Kit hooks
function WalletContextWrapper({ children }: { children: ReactNode }) {
  const currentAccount = useCurrentAccount()
  const { mutate: connectWallet } = useConnectWallet()
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const wallets = useWallets()
  const [connecting, setConnecting] = useState(false)

  // Map Mysten dApp Kit state to our context
  const connected = !!currentAccount
  const address = currentAccount?.address || null
  const walletName = currentAccount?.label || "Sui Wallet"
  const availableWallets = wallets.map(wallet => wallet.name)

  // Store wallet name when connected for future reference
  useEffect(() => {
    if (connected && currentAccount?.label) {
      localStorage.setItem('lastConnectedWallet', currentAccount.label)
    }
  }, [connected, currentAccount?.label])

  // Connect to wallet with error handling
  const connect = async () => {
    try {
      setConnecting(true)
      
      // If there are available wallets, connect to the first one
      // In a real implementation, you might want to show a selection dialog
      if (wallets.length > 0) {
        connectWallet(
          { wallet: wallets[0] },
          {
            onSuccess: () => {
              // Store the connected wallet name
              localStorage.setItem('lastConnectedWallet', wallets[0].name)
              toast({
                title: "Wallet connected",
                description: `Connected to ${wallets[0].name}.`,
              })
            },
            onError: (error) => {
              console.error("Error connecting to wallet:", error)
              toast({
                title: "Connection failed",
                description: "Failed to connect to wallet. Please try again.",
                variant: "destructive",
              })
            },
          }
        )
      } else {
        throw new Error("No wallets available")
      }

      return true
    } catch (error) {
      console.error("Error connecting to wallet:", error)
      throw error
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect from wallet
  const disconnect = async () => {
    try {
      disconnectWallet(
        {},
        {
          onSuccess: () => {
            // Remove wallet from localStorage when disconnecting
            localStorage.removeItem('lastConnectedWallet')
            toast({
              title: "Wallet disconnected",
              description: "Your wallet has been disconnected.",
            })
          },
          onError: (error) => {
            console.error("Error disconnecting from wallet:", error)
          },
        }
      )
    } catch (error) {
      console.error("Error disconnecting from wallet:", error)
      throw error
    }
  }

  return (
    <WalletContext.Provider
      value={{
        connecting,
        connected,
        address,
        connect,
        disconnect,
        walletName,
        availableWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

// Export the provider component
export function WalletContextProvider({ children }: { children: ReactNode }) {
  return <WalletContextWrapper>{children}</WalletContextWrapper>
}
