"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronDown, Copy, ExternalLink, LogOut, AlertCircle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useWallet } from "@suiet/wallet-kit"

interface WalletConnectButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

// WalletConnectButton component with improved error handling
export function WalletConnectButton({ variant = "default", size = "default", className }: WalletConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showNoWalletDialog, setShowNoWalletDialog] = useState(false)

  const { connected, connecting, disconnect, address, detectedWallets, select, configuredWallets } = useWallet()

  const handleConnect = async () => {
    setIsLoading(true)
    try {
      // Check if there are any wallets available
      const availableWallets = [...configuredWallets, ...detectedWallets].filter((wallet) => wallet.installed)

      if (availableWallets.length === 0) {
        // No wallets detected
        setShowNoWalletDialog(true)
        return
      }

      // Select the first available wallet
      await select(availableWallets[0].name)

      // Only show success toast if we have an address
      if (address) {
        toast({
          title: "Wallet connected",
          description: `Connected to wallet.`,
        })
      }
    } catch (error: any) {
      console.error("Failed to connect wallet:", error)

      // Convert error to string for better pattern matching
      const errorString = (error.message || error.toString()).toLowerCase()

      // Check for specific error conditions
      if (errorString.includes("no sui wallets detected") || detectedWallets.length === 0) {
        setShowNoWalletDialog(true)
      }
      // Handle user rejection specifically
      else if (errorString.includes("user rejection") || errorString.includes("user denied")) {
        toast({
          title: "Connection cancelled",
          description: "You cancelled the wallet connection request.",
          // Using regular variant instead of destructive for user cancellations
        })
      }
      // Handle timeout errors
      else if (errorString.includes("timeout")) {
        toast({
          title: "Connection timed out",
          description: "The wallet connection request timed out. Please try again.",
          variant: "destructive",
        })
      }
      // Handle all other errors
      else {
        toast({
          title: "Connection failed",
          description: errorString || "Failed to connect wallet. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast({
        title: "Wallet disconnected",
        description: "Your wallet has been disconnected.",
      })
    } catch (error) {
      console.error("Failed to disconnect wallet:", error)
    }
  }

  // Render account info and disconnect button if connected
  const renderConnectedState = () => {
    if (!connected || !address) return null

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <img src="/images/sui-logo.png" alt="Sui" className="h-4 w-4" />
            {address.slice(0, 6)}...{address.slice(-4)}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(address)
              toast({
                title: "Address copied",
                description: "Wallet address copied to clipboard",
              })
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`https://explorer.sui.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Explorer
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDisconnect}>
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // NoWalletDialog component to guide users to install a wallet
  const NoWalletDialog = () => (
    <Dialog open={showNoWalletDialog} onOpenChange={setShowNoWalletDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            No Sui Wallet Detected
          </DialogTitle>
          <DialogDescription>You need to install a Sui wallet to connect to this app.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="space-y-4">
            {/* Suiet Wallet - Mobile-friendly layout */}
            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex-shrink-0 bg-black rounded-md flex items-center justify-center">
                  <img src="/images/suiet-logo.jpeg" alt="Suiet" className="h-10 w-10 rounded-md" />
                </div>
                <div className="flex-grow">
                  <h3 className="text-base font-semibold">Suiet Wallet</h3>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href="https://suiet.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </Button>
              </div>
            </div>

            {/* Sui Wallet - Mobile-friendly layout */}
            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden">
                  <img src="/images/sui-wallet-logo.png" alt="Sui Wallet" className="h-10 w-10 object-cover" />
                </div>
                <div className="flex-grow">
                  <h3 className="text-base font-semibold">Sui Wallet</h3>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href="https://suiwallet.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </Button>
              </div>
            </div>

            {/* Ethos Wallet - Mobile-friendly layout */}
            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex-shrink-0 rounded-md overflow-hidden">
                  <img src="/images/ethos-logo.jpeg" alt="Ethos" className="h-10 w-10 object-cover" />
                </div>
                <div className="flex-grow">
                  <h3 className="text-base font-semibold">Ethos Wallet</h3>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href="https://ethoswallet.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-center">
          <Button variant="outline" onClick={() => setShowNoWalletDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // Show connect button when not connected, otherwise show account info
  return (
    <>
      {connected ? (
        renderConnectedState()
      ) : (
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={handleConnect}
          disabled={connecting || isLoading}
        >
          <img src="/images/sui-logo.png" alt="Sui" className="h-4 w-4 mr-2" />
          {connecting || isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting
            </>
          ) : (
            "Connect"
          )}
        </Button>
      )}
      <NoWalletDialog />
    </>
  )
}
