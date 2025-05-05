"use client"

import { useState, useEffect } from "react"
import {
  Wallet,
  Search,
  Plus,
  Check,
  X,
  Loader2,
  ExternalLink,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { type TokenInfo, tokenService } from "@/services/token-service"

interface TokenSelectorProps {
  value: string
  onValueChange: (value: string) => void
  onAmountChange?: (amount: string) => void
  amount?: string
  error?: string
  required?: boolean
  className?: string
}

export function TokenSelector({
  value,
  onValueChange,
  onAmountChange,
  amount,
  error,
  required,
  className,
}: TokenSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"popular" | "search" | "custom">("popular")
  const [customTokenAddress, setCustomTokenAddress] = useState("")
  const [customTokenError, setCustomTokenError] = useState<string | null>(null)
  const [validatingToken, setValidatingToken] = useState(false)
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Fetch tokens on mount
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setIsLoading(true)
        const tokensList = await tokenService.getPopularTokens()
        setTokens(tokensList)

        // If a token is already selected, find it in the list
        if (value && value !== "none") {
          const selectedToken = await tokenService.getTokenInfo(value)
          if (selectedToken) {
            setSelectedToken(selectedToken)
          }
        }
      } catch (error) {
        console.error("Failed to load tokens:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTokens()
  }, [value])

  // Handle search query changes with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        const results = await tokenService.searchTokens(searchQuery)
        setSearchResults(results)
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle token selection
  const handleSelectToken = (token: TokenInfo | null) => {
    if (token) {
      setSelectedToken(token)
      onValueChange(token.id)
    } else {
      setSelectedToken(null)
      onValueChange("none")
    }
    setIsDialogOpen(false)
  }

  // Validate custom token
  const validateCustomToken = async () => {
    if (!customTokenAddress.trim()) {
      setCustomTokenError("Please enter a token address")
      return
    }

    try {
      setValidatingToken(true)
      setCustomTokenError(null)

      const result = await tokenService.validateTokenAddress(customTokenAddress)

      if (!result.isValid) {
        setCustomTokenError(result.error || "Invalid token address")
        return
      }

      if (result.tokenInfo) {
        // Add to tokens list if not already there
        if (!tokens.some((t) => t.id === result.tokenInfo!.id)) {
          setTokens((prev) => [...prev, result.tokenInfo!])
        }

        // Show warning if there was a partial validation
        if (result.error) {
          setCustomTokenError(`Warning: ${result.error}`)
          // Still proceed with selection despite the warning
        }

        handleSelectToken(result.tokenInfo)
      }
    } catch (error) {
      console.error("Error validating token:", error)
      setCustomTokenError(error instanceof Error ? error.message : "Failed to validate token")
    } finally {
      setValidatingToken(false)
    }
  }

  // Format price change with color
  const formatPriceChange = (change?: number) => {
    if (change === undefined) return null

    const isPositive = change >= 0
    const color = isPositive ? "text-green-600" : "text-red-600"
    const icon = isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />

    return (
      <span className={`flex items-center ${color}`}>
        {icon}
        <span className="ml-1">{Math.abs(change).toFixed(2)}%</span>
      </span>
    )
  }

  // Format price with currency symbol
  const formatPrice = (price?: number) => {
    if (price === undefined) return null
    return `$${price < 0.01 ? price.toFixed(6) : price.toFixed(2)}`
  }

  // Get current token display
  const getCurrentTokenDisplay = () => {
    if (value === "none" || !value) {
      return "No Token Required"
    }

    if (selectedToken) {
      return (
        <div className="flex items-center gap-2">
          {selectedToken.iconUrl ? (
            <img
              src={selectedToken.iconUrl || "/placeholder.svg"}
              alt={selectedToken.symbol}
              className="w-4 h-4 rounded-full"
            />
          ) : (
            <div className="w-4 h-4 bg-muted rounded-full flex items-center justify-center text-xs">
              {selectedToken.symbol.substring(0, 1)}
            </div>
          )}
          <span>{selectedToken.symbol}</span>
        </div>
      )
    }

    return "Loading token..."
  }

  // Render token item
  const renderTokenItem = (token: TokenInfo, isSelected: boolean) => (
    <Button
      key={token.id}
      variant="ghost"
      className="w-full justify-start font-normal h-14 px-4"
      onClick={() => handleSelectToken(token)}
    >
      <div className="flex items-center w-full">
        <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />

        <div className="flex items-center gap-3">
          {token.iconUrl ? (
            <img src={token.iconUrl || "/placeholder.svg"} alt={token.symbol} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              {token.symbol.substring(0, 1)}
            </div>
          )}

          <div className="flex flex-col items-start">
            <div className="font-medium">{token.symbol}</div>
            <div className="text-xs text-muted-foreground">
              {token.name || "Unknown Token"}
              {token.id.includes("::") && <span className="ml-1 opacity-50">(Custom Type)</span>}
            </div>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end">
          {token.price !== undefined && <div className="text-sm">{formatPrice(token.price)}</div>}
          {token.priceChange24h !== undefined && (
            <div className="text-xs">{formatPriceChange(token.priceChange24h)}</div>
          )}
        </div>

        {!token.verified && (
          <Badge variant="outline" className="ml-2 text-amber-600 border-amber-200 bg-amber-50">
            Unverified
          </Badge>
        )}
      </div>
    </Button>
  )

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor="token-selector" className="text-sm">
          Required Token {required && <span className="text-red-500">*</span>}
        </Label>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsDialogOpen(true)}>
          Change
        </Button>
      </div>

      <Button
        id="token-selector"
        variant="outline"
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          "w-full h-10 px-3 text-left font-normal justify-between",
          error && "border-red-500 focus-visible:ring-red-500",
        )}
      >
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          {isLoading && value !== "none" ? (
            <div className="flex items-center gap-2">
              <Skeleton className="w-20 h-4" />
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : (
            getCurrentTokenDisplay()
          )}
        </div>

        {selectedToken && !selectedToken.verified && (
          <Badge variant="outline" className="ml-2 text-amber-600 border-amber-200 bg-amber-50">
            Unverified
          </Badge>
        )}
      </Button>

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {selectedToken && onAmountChange && (
        <div className="pt-2 space-y-2">
          <Label htmlFor="token-amount" className="text-sm">
            Required Amount <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="token-amount"
              type="number"
              min="0"
              step="any"
              placeholder="Enter amount"
              value={amount || ""}
              onChange={(e) => onAmountChange(e.target.value)}
              className="flex-1"
            />
            <div className="flex-shrink-0 text-sm font-medium text-muted-foreground w-16 text-center">
              {selectedToken.symbol}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedToken.decimals > 0 && `${selectedToken.decimals} decimals • `}
            Voters need at least this amount to participate
          </p>
        </div>
      )}

      {/* Token Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>Choose a token or input a custom token address</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "popular" | "search" | "custom")}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="popular" className="space-y-4 pt-4">
              <div className="rounded-md border">
                <div className="flex items-center justify-between p-2 bg-muted/30">
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal h-9 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => handleSelectToken(null)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                    No token required
                  </Button>
                </div>

                <Separator />

                <ScrollArea className="h-72">
                  {isLoading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : tokens.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No tokens found. Try searching or add a custom token.
                    </div>
                  ) : (
                    <div className="divide-y">{tokens.map((token) => renderTokenItem(token, value === token.id))}</div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="search" className="space-y-4 pt-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, symbol or address"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="rounded-md border">
                <ScrollArea className="h-72">
                  {isSearching ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !searchQuery.trim() ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Enter a token name, symbol, or address to search
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No tokens found. Try a different search term or add a custom token.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {searchResults.map((token) => renderTokenItem(token, value === token.id))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="custom-token-address">Token Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="custom-token-address"
                    placeholder="0x... or package::module::struct"
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    className={cn(customTokenError && "border-red-500 focus-visible:ring-red-500")}
                  />
                  <Button
                    onClick={validateCustomToken}
                    disabled={validatingToken || !customTokenAddress.trim()}
                    className="flex-shrink-0"
                  >
                    {validatingToken ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add
                  </Button>
                </div>

                {customTokenError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{customTokenError}</AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground">
                  Enter a valid Sui token address in SuiVision format (0x...) or standard format
                  (package::module::struct)
                </p>
              </div>

              <div className="rounded-md border p-4 bg-muted/30">
                <h4 className="text-sm font-medium mb-2">How to find a token address:</h4>
                <ol className="text-xs space-y-2 text-muted-foreground list-decimal pl-4">
                  <li>Go to SuiVision or Sui Explorer</li>
                  <li>Search for the token by name or symbol</li>
                  <li>Copy the token ID (0x... format) or full type path (package::module::struct)</li>
                  <li>Paste the complete address here</li>
                </ol>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 flex-1"
                    onClick={() => window.open("https://suivision.xyz/coins", "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    SuiVision
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 flex-1"
                    onClick={() => window.open("https://explorer.sui.io", "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Sui Explorer
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
