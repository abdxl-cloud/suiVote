"use client"

import { useState, useEffect } from "react"
import {
  Wallet,
  Search,
  X,
  Loader2,
  Check,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
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
  // Props for token-weighted voting
  enableTokenWeighted?: boolean
  onTokenWeightedChange?: (enabled: boolean) => void
  tokenWeight?: string
  onTokenWeightChange?: (weight: string) => void
}

export function TokenSelector({
  value,
  onValueChange,
  onAmountChange,
  amount,
  error,
  required,
  className,
  // Token weighted props with defaults
  enableTokenWeighted = false,
  onTokenWeightedChange,
  tokenWeight = "1",
  onTokenWeightChange,
}: TokenSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [validatingCustomToken, setValidatingCustomToken] = useState(false)
  const [customTokenError, setCustomTokenError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [popularTokens, setPopularTokens] = useState<TokenInfo[]>([])

  // Fetch popular tokens on mount for initial display
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setIsLoading(true)
        const tokensList = await tokenService.getPopularTokens(10)
        setPopularTokens(tokensList)

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
    // If empty query, show popular tokens
    if (!searchQuery.trim()) {
      setSearchResults(popularTokens)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true)
        setCustomTokenError(null)

        // Check if searchQuery looks like a token address (begins with 0x or contains ::)
        const isTokenAddress = searchQuery.startsWith("0x") || searchQuery.includes("::")
        
        if (isTokenAddress) {
          // Try to validate as a token address
          const result = await tokenService.validateTokenAddress(searchQuery.trim())
          
          if (result.isValid && result.tokenInfo) {
            setSearchResults([result.tokenInfo])
            
            // Show warning if there's a partial validation
            if (result.error) {
              setCustomTokenError(`Warning: ${result.error}`)
            }
          } else {
            setSearchResults([])
            setCustomTokenError(result.error || "Invalid token address")
          }
        } else {
          // Normal search by name or symbol
          const results = await tokenService.searchTokens(searchQuery)
          setSearchResults(results.length > 0 ? results : [])
          
          if (results.length === 0) {
            setCustomTokenError("No tokens found matching your search. Try a different name, symbol, or paste a valid token address.")
          }
        }
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
        setCustomTokenError(error instanceof Error ? error.message : "Search failed")
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, popularTokens])

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
        <div className="pt-2 space-y-4">
          <div className="space-y-2">
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
          
          {/* Token-weighted voting section */}
          {onTokenWeightedChange && onTokenWeightChange && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="token-weighted" className="text-sm cursor-pointer">
                  Enable token-weighted voting
                </Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="token-weighted" className="text-sm cursor-pointer">
                    {enableTokenWeighted ? "On" : "Off"}
                  </Label>
                  <Switch
                    id="token-weighted"
                    checked={enableTokenWeighted}
                    onCheckedChange={onTokenWeightedChange}
                  />
                </div>
              </div>
              
              {enableTokenWeighted && (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="token-weight" className="text-sm">
                    Tokens per vote <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="token-weight"
                      type="number"
                      min="1"
                      step="any"
                      placeholder="1"
                      value={tokenWeight}
                      onChange={(e) => onTokenWeightChange(e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex-shrink-0 text-sm font-medium text-muted-foreground w-16 text-center">
                      {selectedToken.symbol}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each {tokenWeight} {selectedToken.symbol} equals 1 vote
                  </p>
                </div>
              )}
            </div>
          )}
          

        </div>
      )}

      {/* Unified Token Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>
              Search by name, symbol, or paste a token address
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, symbol or paste address (0x... or package::module::struct)"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
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

            {customTokenError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{customTokenError}</AlertDescription>
              </Alert>
            )}

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
                {isLoading || isSearching ? (
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
                ) : searchResults.length === 0 && !searchQuery.trim() ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Enter a token name, symbol, or address to search
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No tokens found. Try a different search term.
                  </div>
                ) : (
                  <div className="divide-y">
                    {searchResults.map((token) => renderTokenItem(token, value === token.id))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <p className="text-xs text-muted-foreground">
              Enter a valid Sui token address in SuiVision format (0x...) or standard format
              (package::module::struct) to add custom tokens.
            </p>
          </div>

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