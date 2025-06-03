"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Share2,
  Home,
  BarChart2,
  AlertCircle,
  Clock,
  Trophy,
  Sparkles,
  Copy,
  Calendar,
  Users,
  Target,
  Zap,
  Hash
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShareDialog } from "@/components/share-dialog"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import Link from "next/link"
import { SUI_CONFIG } from "@/config/sui-config"
import { cn } from "@/lib/utils"

interface VoteDetails {
  id: string
  title: string
  description?: string
  status: 'active' | 'upcoming' | 'ended'
  totalVotes: number
  pollsCount?: number
  endTimestamp?: number
  showLiveStats?: boolean
  creator?: string
}

interface PageState {
  voteDetails: VoteDetails | null
  txDigest: string
  loading: boolean
  error: string | null
  shareDialogOpen: boolean
  showConfetti: boolean
  copied: boolean
}

// Confetti component
const Confetti = () => {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
    color: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 5)]
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: piece.color,
            left: `${piece.x}%`,
            top: '-10px'
          }}
          initial={{ y: -10, rotate: 0, opacity: 1 }}
          animate={{
            y: window.innerHeight + 10,
            rotate: 360,
            opacity: 0
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  )
}

// Floating particles background
const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-r from-green-400/20 to-blue-400/20"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

export default function VoteSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const suivote = useSuiVote()
  
  const [state, setState] = useState<PageState>({
    voteDetails: null,
    txDigest: "",
    loading: true,
    error: null,
    shareDialogOpen: false,
    showConfetti: false,
    copied: false
  })

  // Trigger confetti on successful load
  useEffect(() => {
    if (state.voteDetails && !state.loading && !state.error) {
      setState(prev => ({ ...prev, showConfetti: true }))
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, showConfetti: false }))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [state.voteDetails, state.loading, state.error])

  // Initialize transaction digest from URL or localStorage
  useEffect(() => {
    console.log("[Success Page] Initializing transaction digest")
    
    if (typeof window === "undefined") return
    
    const urlParams = new URLSearchParams(window.location.search)
    const digest = urlParams.get("digest")
    
    if (digest) {
      console.log("[Success Page] Found digest in URL:", digest)
      setState(prev => ({ ...prev, txDigest: digest }))
      localStorage.setItem(`vote_${params.id}_txDigest`, digest)
    } else {
      const storedDigest = localStorage.getItem(`vote_${params.id}_txDigest`)
      if (storedDigest) {
        console.log("[Success Page] Found digest in localStorage:", storedDigest)
        setState(prev => ({ ...prev, txDigest: storedDigest }))
      }
    }
  }, [params.id])

  // Fetch vote details and set up real-time updates
  useEffect(() => {
    if (!params.id) {
      console.log("[Success Page] No vote ID provided")
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: "No vote ID provided" 
      }))
      return
    }

    if (!suivote) {
      console.log("[Success Page] SuiVote service not ready")
      return
    }

    console.log("[Success Page] Starting data fetch for vote:", params.id)
    
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    const fetchData = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))
        
        console.log("[Success Page] Fetching vote details...")
        const details = await suivote.getVoteDetails(params.id as string)
        
        if (!isMounted) return
        
        console.log("[Success Page] Vote details received:", {
          title: details?.title,
          status: details?.status,
          totalVotes: details?.totalVotes
        })
        
        if (!details) {
          throw new Error("Vote not found")
        }
        
        setState(prev => ({ 
          ...prev, 
          voteDetails: details, 
          loading: false 
        }))
        
        // Update document title
        document.title = `Vote Submitted - ${details.title} - SuiVote`
        
        // Set up real-time updates
        console.log("[Success Page] Setting up real-time subscription")
        unsubscribe = suivote.subscribeToVoteUpdates(params.id as string, (updatedDetails) => {
          if (isMounted) {
            console.log("[Success Page] Received real-time update:", updatedDetails?.title)
            setState(prev => ({ 
              ...prev, 
              voteDetails: updatedDetails 
            }))
          }
        })
        
      } catch (error) {
        if (!isMounted) return
        
        console.error("[Success Page] Error fetching vote details:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to load vote details"
        
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: errorMessage 
        }))
      }
    }

    fetchData()

    return () => {
      console.log("[Success Page] Cleaning up")
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [params.id])

  // Helper functions
  const formatDate = (timestamp: number): string => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return "Date unavailable"
    }
  }

  const truncateAddress = (address: string): string => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const getTransactionExplorerUrl = (): string => {
    if (!state.txDigest) return "#"
    
    const network = SUI_CONFIG.NETWORK.toLowerCase()
    const baseUrl = "https://explorer.sui.io/txblock"
    
    return network === "mainnet" 
      ? `${baseUrl}/${state.txDigest}`
      : `${baseUrl}/${state.txDigest}?network=${network}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return "text-green-600 dark:text-green-400"
      case 'upcoming':
        return "text-blue-600 dark:text-blue-400"
      case 'ended':
        return "text-gray-600 dark:text-gray-400"
      default:
        return "text-muted-foreground"
    }
  }

  // Event handlers
  const handleShare = () => {
    setState(prev => ({ ...prev, shareDialogOpen: true }))
  }

  const handleViewResults = () => {
    if (state.voteDetails?.showLiveStats) {
      router.push(`/vote/${params.id}`)
    }
  }

  const handleCopyTxHash = async () => {
    if (state.txDigest) {
      try {
        await navigator.clipboard.writeText(state.txDigest)
        setState(prev => ({ ...prev, copied: true }))
        toast.success("Transaction hash copied to clipboard!")
        setTimeout(() => {
          setState(prev => ({ ...prev, copied: false }))
        }, 2000)
      } catch (error) {
        toast.error("Failed to copy transaction hash")
      }
    }
  }

  // Loading state
  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <FloatingParticles />
        <div className="container max-w-4xl py-10 px-4 md:px-6 relative z-10">
          <div className="mb-8">
            <Skeleton className="h-10 w-40" />
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="relative inline-block">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center"
              >
                <Sparkles className="h-10 w-10 text-white" />
              </motion.div>
              <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-green-400 to-blue-500 opacity-20 animate-ping" />
            </div>
            <Skeleton className="h-12 w-80 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </motion.div>
          
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl mb-8">
            <CardContent className="p-8 space-y-6">
              <div className="bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-xl p-6">
                <Skeleton className="h-6 w-48 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
          
          <div className="flex items-center justify-center text-muted-foreground">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Zap className="h-5 w-5 mr-3 text-blue-500" />
            </motion.div>
            <span className="text-lg font-medium">Processing your vote...</span>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-red-900/20 dark:to-gray-900">
        <div className="container max-w-4xl py-10 px-4 md:px-6">
          <div className="mb-8">
            <Button asChild variant="outline" size="lg" className="shadow-lg">
              <Link href="/polls">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Back to Polls
              </Link>
            </Button>
          </div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-red-400 to-orange-500 flex items-center justify-center"
            >
              <AlertCircle className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">
              Oops! Something went wrong
            </h1>
          </motion.div>
          
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-0 shadow-2xl mb-8">
            <CardContent className="p-8 text-center">
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-lg">Error Loading Vote</AlertTitle>
                <AlertDescription className="text-base mt-2">{state.error}</AlertDescription>
              </Alert>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                  size="lg"
                  className="shadow-lg"
                >
                  <Clock className="mr-2 h-5 w-5" />
                  Try Again
                </Button>
                <Button asChild size="lg" className="shadow-lg">
                  <Link href="/polls">
                    <Home className="mr-2 h-5 w-5" />
                    Return to Polls
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Success state
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
      <FloatingParticles />
      <AnimatePresence>
        {state.showConfetti && <Confetti />}
      </AnimatePresence>
      
      <div className="container max-w-5xl py-10 px-4 md:px-6 relative z-10">
        {/* Back button */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Button asChild variant="outline" size="lg" className="shadow-lg backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
            <Link href="/polls">
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Polls
            </Link>
          </Button>
        </motion.div>

        {/* Hero Success Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="relative inline-block mb-8">
            <motion.div 
              className="w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 10 }}
            >
              <Trophy className="h-16 w-16 text-white" />
            </motion.div>
            <motion.div
              className="absolute inset-0 w-32 h-32 mx-auto rounded-full bg-gradient-to-r from-green-400 to-teal-500 opacity-20"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-4 w-4 text-yellow-800" />
            </motion.div>
          </div>
          
          <motion.h1 
            className="text-5xl md:text-6xl font-semibold text-foreground mb-6 font-poppins"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            Vote Submitted!
          </motion.h1>
          
          <motion.p 
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-inter"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            🎉 Congratulations! Your vote on <span className="font-medium text-primary">"{state.voteDetails?.title}"</span> has been securely recorded on the blockchain.
          </motion.p>
        </motion.div>

        {/* Main Success Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-12"
        >
          <Card className="bg-card border border-border shadow-sm overflow-hidden">
            <div className="bg-primary h-2" />
            
            <CardContent className="p-8 md:p-12">
              {/* Success Alert */}
              <Alert className="bg-success/10 border-success/20 mb-8">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <AlertDescription className="text-success font-medium text-lg font-inter">
                  🔒 Your vote has been permanently recorded and cannot be changed. Thank you for participating in democratic governance!
                </AlertDescription>
              </Alert>
              
              {/* Vote ID */}
              <div className="bg-muted/50 rounded-xl p-6 mb-8 border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2 font-poppins">
                  <Hash className="h-5 w-5 text-primary" />
                  Vote ID
                </h3>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <code className="text-sm font-mono text-foreground break-all">
                    {params.id}
                  </code>
                </div>
              </div>
              
              {/* Transaction Details */}
              {state.txDigest && (
                <motion.div 
                  className="bg-muted/50 rounded-xl p-6 mb-8 border border-border"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                      <Zap className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground font-poppins">Blockchain Transaction</h3>
                      <p className="text-sm text-muted-foreground font-inter">Permanently recorded on Sui Network</p>
                    </div>
                  </div>
                  
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <code className="text-xs font-mono text-foreground truncate flex-1 bg-muted px-3 py-2 rounded">
                        {state.txDigest}
                      </code>
                      <Button 
                        onClick={handleCopyTxHash}
                        size="sm" 
                        variant="outline"
                        className={cn(
                          "transition-all duration-200",
                          state.copied ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400" : ""
                        )}
                      >
                        {state.copied ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    <Button asChild size="sm" className="w-full">
                      <a 
                        href={getTransactionExplorerUrl()} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View on Sui Explorer
                      </a>
                    </Button>
                  </div>
                </motion.div>
              )}
              
              {/* Action Buttons */}
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <Button asChild size="lg" className="h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg font-inter">
                  <Link href="/polls" className="flex items-center justify-center gap-3">
                    <Home className="h-5 w-5" />
                    <span>Browse More Polls</span>
                  </Link>
                </Button>
                
                {state.voteDetails?.showLiveStats && (
                  <Button 
                    asChild
                    size="lg"
                    variant="outline" 
                    className="h-14 border-2 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20 shadow-lg font-inter"
                  >
                    <Link href={`/vote/${params.id}`} className="flex items-center justify-center gap-3">
                      <BarChart2 className="h-5 w-5" />
                      <span>View Live Results</span>
                    </Link>
                  </Button>
                )}
                
                <Button 
                  onClick={handleShare} 
                  size="lg"
                  variant="outline" 
                  className="h-14 border-2 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/20 shadow-lg font-inter"
                >
                  <Share2 className="h-5 w-5 mr-3" />
                  <span>Share This Vote</span>
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Vote Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mb-8"
        >
          <Card className="bg-card border border-border shadow-sm">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl flex items-center gap-3 font-poppins">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary-foreground" />
                </div>
                Vote Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 font-poppins">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      Title
                    </h3>
                    <p className="text-muted-foreground text-lg font-inter">{state.voteDetails?.title}</p>
                  </div>
                  
                  {state.voteDetails?.description && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 font-poppins">
                        <span className="w-2 h-2 rounded-full bg-success"></span>
                        Description
                      </h3>
                      <p className="text-muted-foreground font-inter">{state.voteDetails.description}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                      <Users className="h-6 w-6 text-success mx-auto mb-2" />
                      <p className="text-2xl font-semibold text-success font-poppins">{state.voteDetails?.totalVotes || 0}</p>
                      <p className="text-sm text-success font-inter">Total Votes</p>
                    </div>
                    
                    {state.voteDetails?.pollsCount && (
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                        <Target className="h-6 w-6 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-semibold text-primary font-poppins">{state.voteDetails.pollsCount}</p>
                        <p className="text-sm text-primary font-inter">Options</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="px-3 py-1 text-sm font-inter">
                      <span className={cn("w-2 h-2 rounded-full mr-2", {
                        "bg-success": state.voteDetails?.status === 'active',
                        "bg-primary": state.voteDetails?.status === 'upcoming',
                        "bg-muted-foreground": state.voteDetails?.status === 'ended'
                      })} />
                      {state.voteDetails?.status?.charAt(0).toUpperCase() + state.voteDetails?.status?.slice(1)}
                    </Badge>
                    
                    {state.voteDetails?.endTimestamp && (
                      <Badge variant="outline" className="px-3 py-1 text-sm font-inter">
                        <Calendar className="w-3 h-3 mr-2" />
                        Ends: {formatDate(state.voteDetails.endTimestamp)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        {/* Footer */}
        <motion.div 
          className="text-center text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="font-medium font-inter">Recorded on {SUI_CONFIG.NETWORK} Network</span>
          </div>
          <p className="text-sm font-inter">
            {!state.voteDetails?.showLiveStats && "Results will be available once the vote closes."}
          </p>
        </motion.div>
        
        {/* Share dialog */}
        <ShareDialog
          open={state.shareDialogOpen}
          onOpenChange={(open) => setState(prev => ({ ...prev, shareDialogOpen: open }))}
          title={state.voteDetails?.title || "Vote Submitted"}
          url={typeof window !== "undefined" ? `${window.location.origin}/vote/${params.id}` : ""}
        />
      </div>
    </div>
  )
}