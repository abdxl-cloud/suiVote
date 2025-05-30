"use client"

import { useState, useEffect } from "react"
import {
  Wallet,
  Search,
  X,
  Loader2,
  Check,
  AlertCircle,
  Info,
  Copy,
  ExternalLink,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { tokenService, type TokenInfo } from "@/services/token-service"

// Simplified token interface focused on coin type
interface CoinType {
  id: string // The coin type identifier
  symbol: string
  name: string
  iconUrl?: string
  verified?: boolean
  decimals?: number
  price?: number
  priceChange24h?: number
  marketCap?: number
  holders?: number
  totalSupply?: string
  volume24H?: number
  website?: string
  createdTime?: number
}

// Convert TokenInfo to CoinType
const convertTokenInfoToCoinType = (tokenInfo: TokenInfo): CoinType => ({
  id: tokenInfo.id,
  symbol: tokenInfo.symbol,
  name: tokenInfo.name,
  iconUrl: tokenInfo.iconUrl,
  verified: tokenInfo.verified,
  decimals: tokenInfo.decimals,
  price: tokenInfo.price,
  priceChange24h: tokenInfo.priceChange24h,
  marketCap: tokenInfo.marketCap,
  holders: tokenInfo.holders,
  totalSupply: tokenInfo.totalSupply,
  volume24H: tokenInfo.volume24H,
  website: tokenInfo.website,
  createdTime: tokenInfo.createdTime,
})

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
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<CoinType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [customTokenError, setCustomTokenError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<CoinType | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [popularTokens, setPopularTokens] = useState<CoinType[]>([])

  // Load popular tokens on mount
  useEffect(() => {
    const loadPopularTokens = async () => {
      console.log('🔄 Loading popular tokens...')
      try {
        const tokens = await tokenService.getPopularTokens(5)
        console.log('📊 Raw tokens from service:', tokens)
        const coinTypes = tokens.map(convertTokenInfoToCoinType)
        console.log('🪙 Converted coin types:', coinTypes)
        setPopularTokens(coinTypes)
        setSearchResults(coinTypes)
      } catch (error) {
        console.error("❌ Failed to load popular tokens:", error)
        // Fallback to empty array
        setPopularTokens([])
        setSearchResults([])
      }
    }
    
    loadPopularTokens()
  }, [])

  // Find selected token on mount and when value changes
  useEffect(() => {
    const loadSelectedToken = async () => {
      console.log('🔍 Loading selected token for value:', value)
      if (value && value !== "none") {
        try {
          // Try to get token info from the service
          const tokenInfo = await tokenService.getTokenInfo(value)
          console.log('📋 Token info received:', tokenInfo)
          if (tokenInfo) {
            const convertedToken = convertTokenInfoToCoinType(tokenInfo)
            console.log('🔄 Converted token:', convertedToken)
            setSelectedToken(convertedToken)
            return
          }
        } catch (error) {
          console.error("❌ Failed to load selected token:", error)
        }
        
        // Fallback for invalid tokens
        if (value.includes("::")) {
          const parts = value.split("::")
          const symbol = parts[parts.length - 1]?.toUpperCase() || "UNKNOWN"
          const fallbackToken = {
            id: value,
            symbol,
            name: `Custom Token (${symbol})`,
            verified: false
          }
          console.log('⚠️ Using fallback token:', fallbackToken)
          setSelectedToken(fallbackToken)
        }
      } else {
        console.log('🚫 No token selected')
        setSelectedToken(null)
      }
    }
    
    loadSelectedToken()
  }, [value])

  // Handle search with validation
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(popularTokens)
      setCustomTokenError(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    
    const timer = setTimeout(async () => {
      setCustomTokenError(null)

      try {
        // Check if it's a coin type format
        const isCoinType = searchQuery.includes("::") || searchQuery.startsWith("0x")
        
        if (isCoinType) {
          // Use the token service to validate the coin type
          const validationResult = await tokenService.validateTokenAddress(searchQuery.trim())
          
          if (validationResult.isValid && validationResult.tokenInfo) {
            const coinType = convertTokenInfoToCoinType(validationResult.tokenInfo)
            setSearchResults([coinType])
            
            // Show warning if there's a validation error
            if (validationResult.error) {
              setCustomTokenError(`Note: ${validationResult.error}`)
            }
          } else {
            setSearchResults([])
            setCustomTokenError(validationResult.error || "Invalid coin type format")
          }
        } else {
          // Search using the token service
          const searchResults = await tokenService.searchTokens(searchQuery.trim(), 10)
          const coinTypes = searchResults.map(convertTokenInfoToCoinType)
          
          setSearchResults(coinTypes)
          
          if (coinTypes.length === 0) {
            setCustomTokenError("No tokens found matching your search. Try a different name, symbol, or paste a valid coin type.")
          }
        }
      } catch (error) {
        console.error("Search error:", error)
        setSearchResults([])
        setCustomTokenError(error instanceof Error ? error.message : "Search failed")
      } finally {
        setIsSearching(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery, popularTokens])

  // Validate coin type format (kept as fallback, but token service handles validation)
  const validateCoinType = (coinType: string): boolean => {
    // Basic validation for Sui coin type format
    const coinTypeRegex = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/
    return coinTypeRegex.test(coinType.trim()) || coinType.match(/^0x[a-fA-F0-9]{64}$/) !== null
  }

  // Truncate coin type for display
  const truncateCoinType = (coinType: string): string => {
    if (coinType.includes("::")) {
      const parts = coinType.split("::")
      if (parts.length === 3) {
        const [packageId, module, struct] = parts
        const shortPackage = packageId.length > 10 ? 
          `${packageId.substring(0, 6)}...${packageId.substring(packageId.length - 4)}` : 
          packageId
        return `${shortPackage}::${module}::${struct}`
      }
    }
    return coinType.length > 20 ? 
      `${coinType.substring(0, 10)}...${coinType.substring(coinType.length - 6)}` : 
      coinType
  }

  // Format large numbers
  const formatNumber = (num: number | string | undefined): string => {
    if (!num) return ""
    const numValue = typeof num === 'string' ? parseFloat(num) : num
    if (numValue >= 1_000_000_000) {
      return `${(numValue / 1_000_000_000).toFixed(1)}B`
    } else if (numValue >= 1_000_000) {
      return `${(numValue / 1_000_000).toFixed(1)}M`
    } else if (numValue >= 1_000) {
      return `${(numValue / 1_000).toFixed(1)}K`
    }
    return numValue.toFixed(2)
  }

  // Format price change with color
  const formatPriceChange = (change: number | undefined) => {
    if (!change) return null
    const isPositive = change > 0
    const color = isPositive ? "text-green-600" : "text-red-600"
    const sign = isPositive ? "+" : ""
    return (
      <span className={`text-xs ${color} font-medium`}>
        {sign}{change.toFixed(2)}%
      </span>
    )
  }

  // Handle token selection
  const handleSelectToken = (token: CoinType | null) => {
    if (token) {
      setSelectedToken(token)
      onValueChange(token.id)
    } else {
      setSelectedToken(null)
      onValueChange("none")
    }
    setIsDialogOpen(false)
  }

  // Copy coin type to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You can add a toast notification here
  }

  // Get current token display with enhanced info and modern design
  const getCurrentTokenDisplay = () => {
    if (value === "none" || !value) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>No Token Required</span>
        </div>
      )
    }

    if (selectedToken) {
      return (
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Token Icon */}
          <div className="relative flex-shrink-0">
            {selectedToken.iconUrl && typeof selectedToken.iconUrl === 'string' ? (
              <img
                src={selectedToken.iconUrl}
                alt={selectedToken.symbol}
                className="w-8 h-8 rounded-full ring-1 ring-border"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                {selectedToken.symbol.charAt(0)}
              </div>
            )}
            {selectedToken.verified && (
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                <Check className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          {/* Token Info */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{selectedToken.symbol}</span>
              <span className="text-xs text-muted-foreground truncate">{selectedToken.name}</span>
            </div>
            {selectedToken.price && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">${selectedToken.price.toFixed(4)}</span>
                {selectedToken.priceChange24h !== undefined && (
                  <span className={cn(
                    "font-medium",
                    selectedToken.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {selectedToken.priceChange24h >= 0 ? "+" : ""}{selectedToken.priceChange24h.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading token...</span>
      </div>
    )
  }

  // Render token item with modern, enhanced UI
  const renderTokenItem = (token: CoinType, isSelected: boolean) => (
    <div
      key={token.id}
      className={cn(
        "relative group cursor-pointer rounded-lg border transition-all duration-200 hover:shadow-md hover:border-primary/20",
        "bg-gradient-to-r from-background to-muted/20",
        isSelected && "border-primary shadow-sm bg-primary/5"
      )}
      onClick={() => handleSelectToken(token)}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Token Icon */}
            <div className="relative">
              {token.iconUrl && typeof token.iconUrl === 'string' ? (
                <img 
                  src={token.iconUrl} 
                  alt={token.symbol} 
                  className="w-10 h-10 rounded-full ring-2 ring-background shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/40 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                  {token.symbol.charAt(0)}
                </div>
              )}
              {token.verified && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>

            {/* Token Name & Symbol */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-foreground">{token.symbol}</h3>
                {!token.verified && (
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200">
                    Custom
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-medium">{token.name}</p>
            </div>
          </div>

          {/* Selection Indicator */}
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 group-hover:border-primary/50"
          )}>
            {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
        </div>

        {/* Price & Market Data */}
        {(token.price || token.marketCap || token.holders) && (
          <div className="space-y-2 mb-3">
            {/* Price Row */}
            {token.price && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">
                    ${token.price.toFixed(token.price < 1 ? 6 : 2)}
                  </span>
                  {token.priceChange24h !== undefined && (
                    <div className={cn(
                      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                      token.priceChange24h >= 0 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Market Stats Grid */}
            {(token.marketCap || token.holders || token.volume24H) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {token.marketCap && (
                  <div className="bg-muted/50 rounded-md p-2">
                    <div className="text-muted-foreground font-medium">Market Cap</div>
                    <div className="font-semibold text-foreground">${formatNumber(token.marketCap)}</div>
                  </div>
                )}
                {token.holders && (
                  <div className="bg-muted/50 rounded-md p-2">
                    <div className="text-muted-foreground font-medium">Holders</div>
                    <div className="font-semibold text-foreground">{formatNumber(token.holders)}</div>
                  </div>
                )}
                {token.volume24H && (
                  <div className="bg-muted/50 rounded-md p-2 col-span-2">
                    <div className="text-muted-foreground font-medium">24h Volume</div>
                    <div className="font-semibold text-foreground">${formatNumber(token.volume24H)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Coin Type Address */}
        <div className="flex items-center justify-between bg-muted/30 rounded-md p-2 group/address">
          <code className="text-xs font-mono text-muted-foreground truncate flex-1 mr-2">
            {truncateCoinType(token.id)}
          </code>
          <button
            className="opacity-0 group-hover/address:opacity-100 transition-opacity p-1 hover:bg-background rounded"
            onClick={(e) => {
              e.stopPropagation()
              copyToClipboard(token.id)
            }}
            title="Copy coin type"
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
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
          "w-full h-auto py-3 px-4 text-left font-normal justify-between min-w-0 bg-background hover:bg-muted/50 transition-colors",
          error && "border-red-500 focus-visible:ring-red-500",
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Wallet className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          {getCurrentTokenDisplay()}
        </div>

        {selectedToken && !selectedToken.verified && (
          <Badge variant="secondary" className="ml-2 text-amber-700 bg-amber-100 border-amber-200 flex-shrink-0 text-xs">
            Custom
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
              {selectedToken.decimals !== undefined && `${selectedToken.decimals} decimals • `}
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

      {/* Token Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-2xl mx-auto overflow-hidden">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">Select Token</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose from available tokens or enter a custom coin type
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 min-w-0">
            {/* Search Input */}
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="Search by name, symbol or enter coin type"
                className="pl-10 pr-10 h-11 text-sm w-full min-w-0 bg-background border-2 focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center z-10"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Instructions */}
            <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-1.5 h-auto text-left">
                  <div className="flex items-center gap-2">
                    <Info className="h-3 w-3 flex-shrink-0" />
                    <span className="text-xs">How to find coin types</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {showInstructions ? "Hide" : "Show"}
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-1">
                <Alert>
                  <Info className="h-3 w-3" />
                  <AlertDescription className="text-xs space-y-2">
                    <div>
                      <p className="font-medium">What is a coin type?</p>
                      <p className="text-muted-foreground">Unique token identifier on Sui:</p>
                      <div className="bg-muted p-1.5 rounded text-xs font-mono break-all">
                        0xpackage::module::struct
                      </div>
                    </div>
                    
                    <div>
                      <p className="font-medium">How to find:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Visit Sui Explorer</li>
                        <li>Go to token page</li>
                        <li>Copy "Type" field</li>
                      </ul>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      <a 
                        href="https://suiexplorer.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        Open Sui Explorer
                      </a>
                    </div>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>

            {customTokenError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm break-words">{customTokenError}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border bg-card overflow-hidden">
              {/* No Token Option */}
              <div
                className={cn(
                  "p-4 cursor-pointer transition-colors border-b bg-gradient-to-r from-background to-muted/10 hover:bg-muted/30",
                  value === "none" && "bg-primary/5 border-l-4 border-l-primary"
                )}
                onClick={() => handleSelectToken(null)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <X className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">No Token Required</h3>
                      <p className="text-sm text-muted-foreground">Anyone can participate</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    value === "none" ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}>
                    {value === "none" && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>
              </div>

              {/* Token List */}
              <ScrollArea className="max-h-80">
                {isSearching ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-3 p-4 rounded-lg border">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-full max-w-48" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">No tokens found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Try a different search term or enter a coin type address
                    </p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {searchResults.map((token) => renderTokenItem(token, value === token.id))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <p className="font-medium mb-1">💡 How to find coin types:</p>
              <p>Visit the Sui Explorer, go to a token page, and copy the "Type" field in the format:</p>
              <code className="bg-background px-2 py-1 rounded text-xs font-mono mt-1 inline-block">
                0xpackage::module::struct
              </code>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}