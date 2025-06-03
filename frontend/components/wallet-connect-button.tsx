"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Copy, ExternalLink, LogOut, AlertCircle, Wallet } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets } from "@mysten/dapp-kit"

interface WalletConnectButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

// WalletConnectButton component with improved error handling and wallet selection
export function WalletConnectButton({ variant = "default", size = "default", className }: WalletConnectButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showNoWalletDialog, setShowNoWalletDialog] = useState(false)
  const [showWalletSelectionDialog, setShowWalletSelectionDialog] = useState(false)
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null)

  const currentAccount = useCurrentAccount()
  const { mutate: connectWallet } = useConnectWallet()
  const { mutate: disconnectWallet } = useDisconnectWallet()
  const wallets = useWallets()
  
  const connected = !!currentAccount
  const connecting = isLoading
  const address = currentAccount?.address || null

  // Get wallet icon URL
  const getWalletIcon = (wallet: any) => {
    // Use wallet's provided icon if available
    if (wallet.iconUrl) {
      return wallet.iconUrl
    }

    // Use wallet's icon property if available
    if (wallet.icon) {
      return wallet.icon
    }

    // Default icon
    return "/images/sui-logo.png"
  }
  const getAvailableWallets = () => {
    // In Mysten dApp Kit, wallets are automatically filtered to show only available ones
    return wallets.filter((wallet) => wallet.features['standard:connect'])
  }

  const handleConnect = async () => {
    const availableWallets = getAvailableWallets()

    if (availableWallets.length === 0) {
      // No wallets detected
      setShowNoWalletDialog(true)
      return
    }

    if (availableWallets.length === 1) {
      // Only one wallet available, connect directly
      await handleConnectWallet(availableWallets[0])
    } else {
      // Multiple wallets available, show selection dialog
      setShowWalletSelectionDialog(true)
    }
  }

  const handleConnectWallet = async (wallet: any) => {
    setIsLoading(true)
    setConnectingWallet(wallet.name)
    try {
      connectWallet(
        { wallet },
        {
          onSuccess: () => {
            // Close the dialog immediately after successful selection
            setShowWalletSelectionDialog(false)
            
            // Show success toast
            toast({
              title: "Wallet connected",
              description: `Connected to ${wallet.name}.`,
            })
          },
          onError: (error: any) => {
            console.error("Failed to connect wallet:", error)

            const errorString = (error.message || error.toString()).toLowerCase()

            // Handle user rejection
            if (errorString.includes("user rejection") || errorString.includes("user denied")) {
              toast({
                title: "Connection cancelled",
                description: "You cancelled the wallet connection request.",
              })
              // Keep the wallet selection dialog open so user can try another wallet
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
          },
        }
      )
    } finally {
      setIsLoading(false)
      setConnectingWallet(null)
    }
  }

  const handleDisconnect = async () => {
    try {
      disconnectWallet(
        {},
        {
          onSuccess: () => {
            toast({
              title: "Wallet disconnected",
              description: "Your wallet has been disconnected.",
            })
          },
          onError: (error) => {
            console.error("Failed to disconnect wallet:", error)
          },
        }
      )
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

  // WalletSelectionDialog component for choosing between available wallets
  const WalletSelectionDialog = () => {
    const availableWallets = getAvailableWallets()

    return (
      <Dialog open={showWalletSelectionDialog} onOpenChange={setShowWalletSelectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Select a Wallet
            </DialogTitle>
            <DialogDescription>Choose a wallet to connect to the app.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {availableWallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto p-4"
                  onClick={() => handleConnectWallet(wallet)}
                  disabled={connectingWallet === wallet.name}
                >
                  <img 
                    src={getWalletIcon(wallet)} 
                    alt={wallet.name} 
                    className="h-8 w-8 rounded-md object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/images/sui-logo.png"
                    }}
                  />
                  <span className="flex-grow text-left">
                    <div className="font-medium">{wallet.name}</div>
                    {wallet.installed && (
                      <div className="text-xs text-muted-foreground">Installed</div>
                    )}
                  </span>
                  {connectingWallet === wallet.name && (
                    <div className="relative h-4 w-4">
                  <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                </div>
                  )}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalletSelectionDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // NoWalletDialog component to guide users to install a wallet
  const NoWalletDialog = () => {
    const allWallets = wallets;
    const uniqueWallets = allWallets.filter((wallet, index, self) =>
      index === self.findIndex((w) => w.name === wallet.name)
    );
  
    return (
      <Dialog open={showNoWalletDialog} onOpenChange={setShowNoWalletDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              No Sui Wallet Detected
            </DialogTitle>
            <DialogDescription>
              You need to install a Sui wallet to connect to this app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2">
              {uniqueWallets.map((wallet) => (
                <div 
                  key={wallet.name} 
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                >
                  <div className="h-8 w-8 flex-shrink-0 rounded-md overflow-hidden">
                    <img 
                      src={getWalletIcon(wallet)} 
                      alt={wallet.name} 
                      className="h-8 w-8 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/sui-logo.png";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{wallet.name}</h3>
                  </div>
                  {(wallet.downloadUrl || wallet.homepage) && (
                    <Button 
                      asChild 
                      variant="outline" 
                      size="sm"
                      className="shrink-0"
                    >
                      <a
                        href={
                          wallet.downloadUrl
                            ? (typeof wallet.downloadUrl === 'string' 
                                ? wallet.downloadUrl 
                                : wallet.downloadUrl.browserExtension || wallet.downloadUrl.browser || Object.values(wallet.downloadUrl)[0])
                            : wallet.homepage
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Install</span>
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowNoWalletDialog(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

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
              <div className="relative mr-2 h-4 w-4">
                <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
              </div>
              Connecting
            </>
          ) : (
            "Connect"
          )}
        </Button>
      )}
      <WalletSelectionDialog />
      <NoWalletDialog />
    </>
  )
}