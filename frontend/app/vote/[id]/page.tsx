"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Share2,
  Wallet,
  Loader2,
  ExternalLink,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ShareDialog } from "@/components/share-dialog"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { useWallet } from "@suiet/wallet-kit"
import { useSuiVote } from "@/hooks/use-suivote"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { format } from "date-fns"
import { SUI_CONFIG } from "@/config/sui-config"

// Transaction status enum
enum TransactionStatus {
  IDLE = "idle",
  BUILDING = "building",
  SIGNING = "signing",
  EXECUTING = "executing",
  CONFIRMING = "confirming",
  SUCCESS = "success",
  ERROR = "error",
}

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const suivote = useSuiVote()

  const [vote, setVote] = useState(null)
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [hasUserVoted, setHasUserVoted] = useState(false)
  const [userHasRequiredTokens, setUserHasRequiredTokens] = useState(true)
  const [showingResults, setShowingResults] = useState(false)

  // New state for transaction status tracking
  const [txStatus, setTxStatus] = useState(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState(null)

  // State to track selections for each poll
  const [selections, setSelections] = useState({})

  // Function to fetch vote details and polls
  const fetchVoteData = async () => {
    try {
      setLoading(true)

      if (!params.id) {
        throw new Error("Vote ID is required")
      }

      // Get vote details
      const voteDetails = await suivote.getVoteDetails(params.id)
      if (!voteDetails) {
        throw new Error("Vote not found")
      }

      // If the vote is closed, redirect to the closed page
      // Only redirect if showLiveStats is false
      if (voteDetails.status === "closed" && !voteDetails.showLiveStats) {
        router.push(`/vote/${params.id}/closed`)
        return
      }

      setVote(voteDetails)
      // Get polls for the vote
      const pollsData = await suivote.getVotePolls(params.id)
      
      // Fetch options for each poll
      const pollsWithOptions = await Promise.all(
        pollsData.map(async (poll, index) => {
          // Get options for this poll (index + 1 because poll indices are 1-based)
          const options = await suivote.getPollOptions(params.id, index + 1)
          
          // Calculate percentage for each option based on votes
          const totalVotesForPoll = options.reduce((sum, option) => sum + option.votes, 0)
          const optionsWithPercentage = options.map(option => ({
            ...option,
            percentage: totalVotesForPoll > 0 ? (option.votes / totalVotesForPoll) * 100 : 0
          }))
          
          return {
            ...poll,
            options: optionsWithPercentage || []
          }
        })
      )
      
      setPolls(pollsWithOptions || [])

      // Initialize selections
      const initialSelections = {}
      pollsWithOptions.forEach((poll) => {
        initialSelections[poll.id] = poll.isMultiSelect ? [] : ""
      })
      setSelections(initialSelections)

      // Check if user has already voted
      if (wallet.connected && wallet.address) {
        const votedStatus = await suivote.hasVoted(wallet.address, params.id)
        setHasUserVoted(votedStatus)
        setSubmitted(votedStatus)
        
        // If user has voted and showLiveStats is false, redirect to success page
        if (votedStatus && !voteDetails.showLiveStats && voteDetails.status === "active") {
          router.push(`/vote/${params.id}/success`)
          return
        }
        
        // If user has voted and showLiveStats is true, show results
        if (votedStatus && voteDetails.showLiveStats) {
          setShowingResults(true)
        }
      }

      // Check if user has required tokens - only check if requiredToken is defined
      if (wallet.connected && wallet.address && voteDetails.requiredToken) {
        const hasTokens = await suivote.checkTokenBalance(
          wallet.address, 
          voteDetails.requiredToken, 
          voteDetails.requiredAmount || 0
        )
        setUserHasRequiredTokens(hasTokens)
      }

      // Update document title and metadata
      document.title = `${voteDetails.title} - SuiVote`

      // Create meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute("content", voteDetails.description || `Vote on ${voteDetails.title}`)
      } else {
        const meta = document.createElement("meta")
        meta.name = "description"
        meta.content = voteDetails.description || `Vote on ${voteDetails.title}`
        document.head.appendChild(meta)
      }

      // Create meta for social sharing
      const ogTitle = document.querySelector('meta[property="og:title"]')
      if (ogTitle) {
        ogTitle.setAttribute("content", `${voteDetails.title} - SuiVote`)
      } else {
        const meta = document.createElement("meta")
        meta.setAttribute("property", "og:title")
        meta.content = `${voteDetails.title} - SuiVote`
        document.head.appendChild(meta)
      }

      const ogDescription = document.querySelector('meta[property="og:description"]')
      if (ogDescription) {
        ogDescription.setAttribute("content", voteDetails.description || `Vote on ${voteDetails.title}`)
      } else {
        const meta = document.createElement("meta")
        meta.setAttribute("property", "og:description")
        meta.content = voteDetails.description || `Vote on ${voteDetails.title}`
        document.head.appendChild(meta)
      }
    } catch (error) {
      console.error("Error fetching vote data:", error)
      toast.error("Error loading vote", {
        description: error instanceof Error ? error.message : "Failed to load vote data"
      })
      
      setValidationErrors({
        general: error instanceof Error ? error.message : "Failed to load vote data"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVoteData()
  }, [params.id, router])

  // Re-check if user has voted when wallet changes
  useEffect(() => {
    if (wallet.connected && wallet.address && params.id && vote) {
      // Check if user has already voted
      suivote.hasVoted(wallet.address, params.id).then(voted => {
        setHasUserVoted(voted)
        setSubmitted(voted)
        
        // If user has voted and showLiveStats is false, redirect to success page
        if (voted && !vote.showLiveStats && vote.status === "active") {
          router.push(`/vote/${params.id}/success`)
        }
        
        // If user has voted and showLiveStats is true, show results
        if (voted && vote.showLiveStats) {
          setShowingResults(true)
        }
      })
      
      // Check if user has required tokens - only check if requiredToken is defined
      if (vote.requiredToken) {
        suivote.checkTokenBalance(
          wallet.address, 
          vote.requiredToken, 
          vote.requiredAmount || 0
        ).then(hasTokens => {
          setUserHasRequiredTokens(hasTokens)
          if (!hasTokens && vote.requiredToken) {
            toast.warning("Token requirement not met", {
              description: `This vote requires at least ${vote.requiredAmount} ${vote.requiredToken?.split("::")?.pop() || "tokens"}`
            })
          }
        })
      }
    } else {
      setHasUserVoted(false)
      setShowingResults(false)
    }
  }, [wallet.connected, wallet.address, params.id, vote])
  
  // Handle option selection
  const handleOptionSelect = (pollId, optionId, isMultiSelect) => {
    setSelections(prev => {
      const newSelections = { ...prev }
      
      if (isMultiSelect) {
        // For multi-select polls
        const currentSelections = newSelections[pollId] || []
        
        if (currentSelections.includes(optionId)) {
          // If already selected, remove it
          newSelections[pollId] = currentSelections.filter(id => id !== optionId)
        } else {
          // If not selected, add it (respecting maxSelections)
          const poll = polls.find(p => p.id === pollId)
          if (poll && currentSelections.length < poll.maxSelections) {
            newSelections[pollId] = [...currentSelections, optionId]
          }
        }
      } else {
        // For single-select polls
        newSelections[pollId] = [optionId]
      }
      
      return newSelections
    })
    
    // Clear validation error for this poll if it exists
    if (validationErrors[pollId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[pollId]
        return newErrors
      })
    }
  }

  // Validate vote submission
  const validateVote = () => {
    if (!vote) return false

    const newErrors = {}
    let isValid = true

    // Check if user is connected
    if (!wallet.connected) {
      newErrors.wallet = "Please connect your wallet to vote"
      isValid = false
    }

    // Check if user has required tokens - only check if requiredToken is defined
    if (vote.requiredToken && !userHasRequiredTokens) {
      newErrors.tokens = `You need at least ${vote.requiredAmount} ${vote.requiredToken?.split("::")?.pop() || "tokens"} to vote`
      isValid = false
    }

    // Check if vote is active
    if (vote.status !== "active") {
      newErrors.status = vote.status === "upcoming" ? "This vote has not started yet" : "This vote has ended"
      isValid = false
    }

    // Check if all required polls have selections
    polls.forEach(poll => {
      if (poll.isRequired && (!selections[poll.id] || selections[poll.id].length === 0)) {
        newErrors[poll.id] = "This poll requires a response"
        isValid = false
      }
    })

    setValidationErrors(newErrors)
    return isValid
  }

  // Handle vote submission
  const handleSubmitVote = async () => {
    if (!validateVote()) return

    try {
      setSubmitting(true)
      setTxStatus(TransactionStatus.BUILDING)

      // Prepare the poll indices and option selections
      const pollIndices = []
      const optionIndicesPerPoll = []

      for (let i = 0; i < polls.length; i++) {
        const poll = polls[i]
        const selection = selections[poll.id]

        if (selection && selection.length > 0) {
          // Add the poll index (1-based index)
          pollIndices.push(i + 1)

          // Get option indices (convert from IDs to indices)
          const optionIndices = selection.map(optionId => {
            // Find the index of this option
            const optionIndex = poll.options?.findIndex(opt => opt.id === optionId)
            // Return 1-based index
            return optionIndex !== undefined && optionIndex >= 0 ? optionIndex + 1 : 0
          }).filter(idx => idx > 0)
          
          optionIndicesPerPoll.push(optionIndices)
        }
      }

      let transaction;
      // If we have only one poll to vote on, use castVoteTransaction
      if (pollIndices.length === 1) {
        transaction = suivote.castVoteTransaction(
          params.id, 
          pollIndices[0], 
          optionIndicesPerPoll[0],
          vote.paymentAmount
        )
      } else {
        // Use castMultipleVotesTransaction for multiple polls
        transaction = suivote.castMultipleVotesTransaction(
          params.id,
          pollIndices,
          optionIndicesPerPoll,
          vote.paymentAmount
        )
      }
      
      setTxStatus(TransactionStatus.SIGNING)
      
      // Execute the transaction
      const response = await suivote.executeTransaction(transaction)
      console.log("Vote transaction response:", response)
      
      // Update transaction status
      setTxStatus(TransactionStatus.EXECUTING)
      setTxDigest(response.digest)
      
      // Wait a bit to simulate confirmation
      setTxStatus(TransactionStatus.CONFIRMING)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mark transaction as successful
      setTxStatus(TransactionStatus.SUCCESS)
      
      // Update local state
      setSubmitted(true)
      setHasUserVoted(true)
      
      toast.success("Vote submitted successfully!", {
        description: "Thank you for participating in this vote."
      })
      
      // Refresh polls data to get updated results
      if (vote.showLiveStats) {
        setShowingResults(true)
        // Refetch vote data to get updated results
        fetchVoteData()
      } else {
        // Redirect to success page if showLiveStats is false
        router.push(`/vote/${params.id}/success`)
      }
    } catch (error) {
      console.error("Error submitting vote:", error)
      setTxStatus(TransactionStatus.ERROR)
      
      toast.error("Error submitting vote", {
        description: error instanceof Error ? error.message : "Failed to submit vote"
      })
      
      setValidationErrors({
        ...validationErrors,
        submit: error instanceof Error ? error.message : "Failed to submit vote"
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Helper functions for UI
  
  // Format date
  const formatDate = (timestamp) => {
    try {
      return format(new Date(timestamp), "PPP")
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Date unavailable" 
    }
  }

  // Format time
  const formatTime = (timestamp) => {
    try {
      return format(new Date(timestamp), "p")
    } catch (e) {
      console.error("Error formatting time:", e)
      return "Time unavailable"
    }
  }

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!vote) return ""

    const now = Date.now()
    const endDate = vote.endTimestamp

    if (now > endDate) return "Ended"

    const remainingMs = endDate - now
    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      return `${days}d ${hours}h remaining`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else {
      return `${minutes}m remaining`
    }
  }

  // Get vote status badge
  const getStatusBadge = () => {
    if (!vote) return null

    switch (vote.status) {
      case "active":
        return <Badge className="bg-sui-500">Active</Badge>
      case "upcoming":
        return <Badge className="bg-blue-500">Upcoming</Badge>
      case "ended":
      case "closed":
        return <Badge className="bg-gray-500">Ended</Badge>
      default:
        return null
    }
  }

  // Truncate address for display
  const truncateAddress = (address) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // Get transaction explorer URL
  const getTransactionExplorerUrl = () => {
    if (!txDigest) return "#"

    const network = SUI_CONFIG.NETWORK.toLowerCase()
    if (network === "mainnet") {
      return `https://explorer.sui.io/txblock/${txDigest}`
    } else {
      return `https://explorer.sui.io/txblock/${txDigest}?network=${network}`
    }
  }

  // Get token display name with fallback
  const getTokenDisplayName = (tokenAddress) => {
    if (!tokenAddress) return "tokens";
    return tokenAddress?.split("::")?.pop() || "tokens";
  }

  // Handle share dialog
  const handleShare = () => {
    setShareDialogOpen(true)
  }

  // Loading state
  if (loading) {
    return (
      <div className="container max-w-4xl py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-sui-500" />
          <p className="text-lg font-medium">Loading vote data...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (validationErrors.general || !vote) {
    return (
      <div className="container max-w-4xl py-8 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{validationErrors.general || "Failed to load vote data. Please try again later."}</AlertDescription>
        </Alert>

        <Button asChild variant="outline">
          <Link href="/polls">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Polls
          </Link>
        </Button>
      </div>
    )
  }

  // Upcoming vote state
  if (vote && vote.status === "upcoming") {
    return (
      <div className="container max-w-4xl py-8 px-4">
        {/* Back button */}
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/polls">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Polls
            </Link>
          </Button>
        </div>

        {/* Vote header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{vote.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-blue-500">Upcoming</Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Starts {formatDate(vote.startTimestamp)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleShare}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share this vote</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {vote.description && <p className="text-muted-foreground">{vote.description}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formatDate(vote.startTimestamp)} - {formatDate(vote.endTimestamp)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formatTime(vote.startTimestamp)} - {formatTime(vote.endTimestamp)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Upcoming vote alert */}
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle>This vote has not started yet</AlertTitle>
          <AlertDescription>
            This vote will be available for participation starting on {formatDate(vote.startTimestamp)} at{" "}
            {formatTime(vote.startTimestamp)}.
          </AlertDescription>
        </Alert>

        {/* Creator info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mb-6"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-sui-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Created by</p>
                  <p className="text-xs text-muted-foreground">
                    {vote.creatorName || truncateAddress(vote.creator)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Requirements card */}
        {(vote.requiredToken || vote.paymentAmount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Voting Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vote.requiredToken && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-sui-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Token Requirement</p>
                        <p className="text-xs text-muted-foreground">
                          Minimum {vote.requiredAmount} {getTokenDisplayName(vote.requiredToken)}
                        </p>
                      </div>
                    </div>
                  )}

                  {vote.paymentAmount > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-sui-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Payment Required</p>
                        <p className="text-xs text-muted-foreground">{vote.paymentAmount / 1_000_000_000} SUI per vote</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Polls preview */}
        <div className="space-y-6">
          {polls.map((poll, index) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{poll.title}</CardTitle>
                      {poll.description && <CardDescription className="mt-1">{poll.description}</CardDescription>}
                    </div>
                    {poll.isRequired && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  {poll.isMultiSelect && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Select up to {poll.maxSelections} option{poll.maxSelections !== 1 ? "s" : ""}
                    </p>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="space-y-4 opacity-70">
                    {poll.options.map((option) => (
                      <div key={option.id} className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full border border-muted-foreground flex items-center justify-center">
                          {poll.isMultiSelect ? (
                            <div className="h-3 w-3 rounded-sm border border-muted-foreground" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                          )}
                        </div>
                        <div className="text-base">{option.text}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Vote metadata */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mt-8"
        >
          <Separator className="my-4" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Created by:</span>
              <a
                href={`https://explorer.sui.io/address/${vote.creator}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-sui-500 transition-colors"
              >
                {vote.creatorName || truncateAddress(vote.creator)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <span>Vote ID:</span>
              <a
                href={`https://explorer.sui.io/object/${params.id}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-sui-500 transition-colors"
              >
                {truncateAddress(params.id)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          title={vote.title}
          url={typeof window !== "undefined" ? window.location.href : ""}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 px-4">
      {/* Back button */}
      <div className="mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/polls">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Polls
          </Link>
        </Button>
      </div>

      {/* Vote header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{vote.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              {getStatusBadge()}
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {vote.totalVotes} votes
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {getTimeRemaining()}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share this vote</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {vote.description && <p className="text-muted-foreground">{vote.description}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {formatDate(vote.startTimestamp)} - {formatDate(vote.endTimestamp)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {formatTime(vote.startTimestamp)} - {formatTime(vote.endTimestamp)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Requirements card */}
      {(vote.requiredToken || vote.paymentAmount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mb-6"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Voting Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vote.requiredToken && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-sui-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Token Requirement</p>
                      <p className="text-xs text-muted-foreground">
                        Minimum {vote.requiredAmount} {getTokenDisplayName(vote.requiredToken)}
                      </p>
                    </div>
                  </div>
                )}

                {vote.paymentAmount > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-sui-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payment Required</p>
                      <p className="text-xs text-muted-foreground">{vote.paymentAmount / 1_000_000_000} SUI per vote</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Creator info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="mb-6"
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-sui-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-sui-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Created by</p>
                <p className="text-xs text-muted-foreground">
                  {vote.creatorName || truncateAddress(vote.creator)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Wallet connection alert */}
      {!wallet.connected && vote.status === "active" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Wallet connection required</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span>Connect your wallet to participate in this vote.</span>
              <WalletConnectButton />
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    
      {/* Token requirement alert */}
      {wallet.connected && !userHasRequiredTokens && vote.requiredToken && vote.status === "active" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Insufficient token balance</AlertTitle>
            <AlertDescription>
              You need at least {vote.requiredAmount} {getTokenDisplayName(vote.requiredToken)} to participate in
              this vote.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {wallet.connected && !userHasRequiredTokens && vote.requiredToken && vote.status === "active" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Token Requirement</AlertTitle>
            <AlertDescription>
              <p className="mb-2">This vote is token-gated. You need at least {vote.requiredAmount} {getTokenDisplayName(vote.requiredToken)} to participate.</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  className="bg-background/80 border-white/20 hover:bg-background"
                >
                  <a href={`https://explorer.sui.io/address/${wallet.address}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Your Wallet 
                  </a>
                </Button>
                {vote.requiredToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="bg-background/80 border-white/20 hover:bg-background"
                  >
                    <a href={`https://explorer.sui.io/coin/${encodeURIComponent(vote.requiredToken)}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5" />
                      Get Token
                    </a>
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
      
      {/* Already voted alert */}
      {hasUserVoted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle>You've already voted</AlertTitle>
            <AlertDescription>
              Thank you for participating in this vote. 
              {vote.showLiveStats ? " You can see the live results below." : ""}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Validation error alert */}
      {validationErrors.submit && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error submitting vote</AlertTitle>
            <AlertDescription>{validationErrors.submit}</AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Transaction Status Section */}
      {txStatus !== TransactionStatus.IDLE && txStatus !== TransactionStatus.SUCCESS && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="mb-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {txStatus === TransactionStatus.ERROR ? "Transaction Failed" : "Processing Transaction"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress 
                value={
                  txStatus === TransactionStatus.BUILDING ? 20 :
                  txStatus === TransactionStatus.SIGNING ? 40 :
                  txStatus === TransactionStatus.EXECUTING ? 60 :
                  txStatus === TransactionStatus.CONFIRMING ? 80 : 0
                }  
                className="h-2"
              />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {txStatus === TransactionStatus.BUILDING ? 
                      <Loader2 className="h-4 w-4 animate-spin" /> : 
                      txStatus > TransactionStatus.BUILDING ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                        <div className="h-4 w-4" />
                    }
                    Building Transaction
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {txStatus === TransactionStatus.SIGNING ? 
                      <Loader2 className="h-4 w-4 animate-spin" /> : 
                      txStatus > TransactionStatus.SIGNING ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                        <div className="h-4 w-4" />
                    }
                    Signing Transaction
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {txStatus === TransactionStatus.EXECUTING ? 
                      <Loader2 className="h-4 w-4 animate-spin" /> : 
                      txStatus > TransactionStatus.EXECUTING ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                        <div className="h-4 w-4" />
                    }
                    Executing Transaction
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {txStatus === TransactionStatus.CONFIRMING ? 
                      <Loader2 className="h-4 w-4 animate-spin" /> : 
                      txStatus > TransactionStatus.CONFIRMING ? 
                        <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
                        <div className="h-4 w-4" />
                    }
                    Confirming Transaction
                  </span>
                </div>
              </div>
              
              {txDigest && (
                <div className="text-sm flex items-center gap-2 mt-2">
                  <span className="font-medium">Transaction ID:</span>
                  <code className="bg-muted p-1 rounded text-xs">{truncateAddress(txDigest)}</code>
                  <a 
                    href={getTransactionExplorerUrl()} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sui-500 hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              
              {txStatus === TransactionStatus.ERROR && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationErrors.submit || "Transaction failed. Please try again."}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Polls */}
      <div className="space-y-6">
        {polls.map((poll, index) => (
          <motion.div
            key={poll.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
          >
            <Card className={cn(validationErrors[poll.id] && "border-red-500")}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{poll.title}</CardTitle>
                    {poll.description && <CardDescription className="mt-1">{poll.description}</CardDescription>}
                  </div>
                  {poll.isRequired && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {poll.isMultiSelect && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Select up to {poll.maxSelections} option{poll.maxSelections !== 1 ? "s" : ""}
                  </p>
                )}
              </CardHeader>

              <CardContent>
                {validationErrors[poll.id] && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{validationErrors[poll.id]}</AlertDescription>
                  </Alert>
                )}

                {poll.isMultiSelect ? (
                  // Multi-select poll (checkboxes)
                  <div className="space-y-4">
                    {poll.options?.map((option) => {
                      const isSelected = (selections[poll.id] || []).includes(option.id)
                      const isDisabled =
                        hasUserVoted ||
                        vote.status !== "active" ||
                        (!isSelected && (selections[poll.id] || []).length >= poll.maxSelections)

                      return (
                        <div key={option.id} className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <Checkbox
                              id={option.id}
                              checked={isSelected}
                              onCheckedChange={() => handleOptionSelect(poll.id, option.id, true)}
                              disabled={isDisabled || !wallet.connected || !userHasRequiredTokens}
                              className="mt-1"
                            />
                            <div className="grid gap-1.5 leading-none w-full">
                              <Label
                                htmlFor={option.id}
                                className={cn("text-base font-normal", isDisabled && "opacity-70")}
                              >
                                {option.text}
                              </Label>

                              {/* Show results if user has voted or vote has ended or showLiveStats is true */}
                              {(showingResults || vote.status === "ended" || vote.status === "closed" || vote.showLiveStats) && (
                                <div className="mt-2 space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{option.votes} votes</span>
                                    <span className="font-medium">{option.percentage.toFixed(1)}%</span>
                                  </div>
                                  <Progress value={option.percentage} className="h-2 bg-sui-100">
                                    <div className="h-full bg-sui-500" style={{ width: `${option.percentage}%` }} />
                                  </Progress>
                                </div>
                              )}
                            </div>
                          </div>

                          {option.mediaUrl && (
                            <div className="ml-6 mt-2">
                              <img
                                src={option.mediaUrl || "/placeholder.svg"}
                                alt={option.text}
                                className="rounded-md max-h-48 object-cover"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Single-select poll (radio buttons)
                  <RadioGroup
                    value={(selections[poll.id] || [])[0] || ""}
                    onValueChange={(value) => handleOptionSelect(poll.id, value, false)}
                    className="space-y-4"
                    disabled={hasUserVoted || vote.status !== "active" || !wallet.connected || !userHasRequiredTokens}
                  >
                    {poll.options?.map((option) => (
                      <div key={option.id} className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <RadioGroupItem
                            value={option.id}
                            id={option.id}
                            disabled={hasUserVoted || vote.status !== "active" || !wallet.connected || !userHasRequiredTokens}
                            className="mt-1"
                          />
                          <div className="grid gap-1.5 leading-none w-full">
                            <Label
                              htmlFor={option.id}
                              className={cn(
                                "text-base font-normal",
                                (hasUserVoted || vote.status !== "active" || !wallet.connected || !userHasRequiredTokens) &&
                                  "opacity-70"
                              )}
                            >
                              {option.text}
                            </Label>

                            {/* Show results if user has voted or vote has ended or showLiveStats is true */}
                            {(showingResults || vote.status === "ended" || vote.status === "closed" || vote.showLiveStats) && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{option.votes} votes</span>
                                  <span className="font-medium">{option.percentage.toFixed(1)}%</span>
                                </div>
                                <Progress value={option.percentage} className="h-2 bg-sui-100">
                                  <div className="h-full bg-sui-500" style={{ width: `${option.percentage}%` }} />
                                </Progress>
                              </div>
                            )}
                          </div>
                        </div>

                        {option.mediaUrl && (
                          <div className="ml-6 mt-2">
                            <img
                              src={option.mediaUrl || "/placeholder.svg"}
                              alt={option.text}
                              className="rounded-md max-h-48 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Vote actions */}
      {vote.status === "active" && !hasUserVoted && !showingResults && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-lg bg-muted/30"
        >
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {vote.requireAllPolls
                ? "All polls must be answered to submit your vote."
                : "Required polls must be answered to submit your vote."}
            </p>
          </div>

          <Button
            onClick={handleSubmitVote}
            disabled={submitting || !wallet.connected || !userHasRequiredTokens || txStatus !== TransactionStatus.IDLE}
            className="w-full sm:w-auto gap-2 bg-sui-500 hover:bg-sui-600"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit Vote
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Vote metadata */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-8"
      >
        <Separator className="my-4" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Created by:</span>
            <a
              href={`https://explorer.sui.io/address/${vote.creator}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-sui-500 transition-colors"
            >
              {vote.creatorName || truncateAddress(vote.creator)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <span>Vote ID:</span>
            <a
              href={`https://explorer.sui.io/object/${params.id}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-sui-500 transition-colors"
            >
              {truncateAddress(params.id)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Share dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={vote.title}
        url={typeof window !== "undefined" ? window.location.href : ""}
      />
    </div>
  )
}