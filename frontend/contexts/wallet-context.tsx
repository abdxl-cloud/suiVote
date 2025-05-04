"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useWallet as useSuietWallet } from "@suiet/wallet-kit"
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

// Create a wrapper component that uses the Suiet wallet hook
function WalletContextWrapper({ children }: { children: ReactNode }) {
  const suietWallet = useSuietWallet()
  const [connecting, setConnecting] = useState(false)
  const [availableWallets, setAvailableWallets] = useState<string[]>([])

  // Map Suiet wallet state to our context
  const connected = !!suietWallet.connected
  const address = suietWallet.address || null
  const walletName = suietWallet.name || "Sui Wallet"

  // Connect to wallet with error handling
  const connect = async () => {
    try {
      setConnecting(true)
      await suietWallet.select()
      await suietWallet.connect()

      // Verify connection
      if (!suietWallet.address) {
        throw new Error("Failed to connect to wallet. No address found.")
      }

      toast({
        title: "Wallet connected",
        description: `Connected to ${suietWallet.name || "wallet"}.`,
      })

      return true
    } catch (error) {
      console.error("Error connecting to wallet:", error)

      // Check if the error is about no wallets detected
      if (error instanceof Error && error.message.includes("No wallet detected")) {
        setAvailableWallets([])
      }

      throw error
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect from wallet
  const disconnect = async () => {
    try {
      await suietWallet.disconnect()
      toast({
        title: "Wallet disconnected",
        description: "Your wallet has been disconnected.",
      })
    } catch (error) {
      console.error("Error disconnecting from wallet:", error)
      throw error
    }
  }

  // Update available wallets when component mounts
  useEffect(() => {
    const updateWallets = async () => {
      try {
        // Get available wallets if the Suiet API provides this
        const wallets = suietWallet.supportedWallets || []
        setAvailableWallets(wallets.map((w) => w.name))
      } catch (error) {
        console.error("Error getting available wallets:", error)
        setAvailableWallets([])
      }
    }

    updateWallets()
  }, [suietWallet.supportedWallets])

  return (
    <WalletContext.Provider
      value={{
        connecting: connecting || suietWallet.connecting,
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

// Export the provider component that includes the Suiet WalletProvider
export function WalletContextProvider({ children }: { children: ReactNode }) {
  // We're not using the Suiet WalletProvider directly here to avoid the CSS import
  // Instead, we'll use the hook directly in our wrapper
  return <WalletContextWrapper>{children}</WalletContextWrapper>
}
