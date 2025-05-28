"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@suiet/wallet-kit"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"

// UI Components
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  ArrowLeft,
  Share2,
  Wallet,
  Loader2,
  ExternalLink,
  Info,
  CheckCircle2,
  Lock,
  BarChart2,
  Shield,
  Copy,
  Award,
  MessageSquareText,
  User,
  Timer,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  Play,
  HelpCircle,
  Wifi,
  X,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ShareDialog } from "@/components/share-dialog"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { mapOptionIdsToIndices, verifyOptionMappings } from '@/components/vote-utils';

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

  // State
  const [vote, setVote] = useState(null)
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [showingResults, setShowingResults] = useState(false)
  const [activeTab, setActiveTab] = useState("vote")
  const [activePollIndex, setActivePollIndex] = useState(0)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})
  const [userCanVote, setUserCanVote] = useState(false)
  const [userHasRequiredTokens, setUserHasRequiredTokens] = useState(true)
  const [tokenBalance, setTokenBalance] = useState(0)

  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    hasStarted: false
  });
  const calculateTimeRemaining = (startTimestamp: number) => {
    const now = Date.now();
    const difference = startTimestamp - now;

    if (difference <= 0) {
      return { hasStarted: true };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((difference % (1000 * 60)) / 1000),
      hasStarted: false
    };
  };
  useEffect(() => {
    if (!vote || vote.status !== 'upcoming') return;

    const timer = setInterval(() => {
      const newTime = calculateTimeRemaining(vote.startTimestamp);

      if (newTime.hasStarted) {
        // If time has come, refresh the vote status
        clearInterval(timer);
        fetchVoteData();
        toast.success("Vote has started!");
      } else {
        setTimeRemaining(newTime);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [vote?.status, vote?.startTimestamp]);

  const CountdownTimer = () => {
    if (!timeRemaining || timeRemaining.hasStarted) return null;

    return (
      <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 font-mono">
          {timeRemaining.days > 0 && (
            <div className="text-center">
              <div className="text-xl font-bold">{timeRemaining.days}</div>
              <div className="text-xs text-muted-foreground">days</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-xl font-bold">{timeRemaining.hours}</div>
            <div className="text-xs text-muted-foreground">hours</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{timeRemaining.minutes}</div>
            <div className="text-xs text-muted-foreground">minutes</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{timeRemaining.seconds}</div>
            <div className="text-xs text-muted-foreground">seconds</div>
          </div>
        </div>
      </div>
    );
  };
  // Transaction state
  const [txStatus, setTxStatus] = useState(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState(null)
  const [txProgress, setTxProgress] = useState(0)

  // State to track selections for each poll
  const [selections, setSelections] = useState({})

  // Transaction dialog state
  const [txStatusDialogOpen, setTxStatusDialogOpen] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // Dialog component for transaction status
  const TransactionStatusDialog = () => (
    <Dialog
      open={txStatusDialogOpen}
      onOpenChange={(open) => {
        // Only allow closing the dialog if transaction is complete or failed
        if (!open && (txStatus === TransactionStatus.SUCCESS || txStatus === TransactionStatus.ERROR)) {
          // Reset transaction status to prevent reopening
          setTxStatus(TransactionStatus.IDLE);
          // Explicitly close the dialog
          setTxStatusDialogOpen(false);
          // If transaction was successful, refresh the page data
          if (txStatus === TransactionStatus.SUCCESS) {
            router.refresh();
            fetchVoteData();
          }
        } else if (!open) {
          return;
        } else {
          setTxStatusDialogOpen(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 mb-1">
            {txStatus === TransactionStatus.SUCCESS && (
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            )}
            {txStatus === TransactionStatus.ERROR && (
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            )}
            {txStatus !== TransactionStatus.SUCCESS && txStatus !== TransactionStatus.ERROR && (
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            <span>
              {txStatus === TransactionStatus.SUCCESS
                ? "Transaction Successful!"
                : txStatus === TransactionStatus.ERROR
                  ? "Transaction Failed"
                  : "Processing Transaction"}
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {txStatus === TransactionStatus.SUCCESS
              ? "Your transaction has been confirmed on the blockchain."
              : txStatus === TransactionStatus.ERROR
                ? "There was an error processing your transaction."
                : "Please wait while we process your transaction on the blockchain."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">


          <div className="space-y-3 mt-2">
            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.BUILDING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.BUILDING ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.BUILDING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.BUILDING ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.BUILDING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.BUILDING ? "font-medium" :
                      "text-muted-foreground"
                )}>
                  Building Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 1/4</span>
            </div>

            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.SIGNING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.SIGNING ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.SIGNING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.SIGNING ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.SIGNING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.SIGNING ? "font-medium" :
                      "text-muted-foreground"
                )}>
                  Signing Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 2/4</span>
            </div>

            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.EXECUTING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.EXECUTING ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.EXECUTING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.EXECUTING ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.EXECUTING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.EXECUTING ? "font-medium" :
                      "text-muted-foreground"
                )}>
                  Executing Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 3/4</span>
            </div>

            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.CONFIRMING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.CONFIRMING ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.CONFIRMING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.CONFIRMING ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.CONFIRMING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.CONFIRMING ? "font-medium" :
                      "text-muted-foreground"
                )}>
                  Confirming Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 4/4</span>
            </div>
          </div>

          {txStatus === TransactionStatus.SUCCESS && txDigest && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Transaction ID</span>
                <Link
                  href={`${SUI_CONFIG.explorerUrl}/txblock/${txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  View on Explorer
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-md">
                <code className="text-xs text-muted-foreground flex-1 truncate">{txDigest}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(txDigest)
                    toast.success("Transaction ID copied to clipboard")
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {txStatus === TransactionStatus.ERROR && transactionError && (
            <div className="mt-4 space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Transaction Failed</AlertTitle>
                <AlertDescription className="text-xs break-all max-h-32 overflow-y-auto">{transactionError}</AlertDescription>
              </Alert>

              {/* Error-specific guidance */}
              {transactionError.includes("rejected") || transactionError.includes("cancelled") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">You declined the transaction</p>
                      <p className="text-xs">You can try again when you're ready by clicking the "Try Again" button below.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("insufficient") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Insufficient funds</p>
                      <p className="text-xs">Please add more SUI to your wallet to cover the transaction fee, then try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("network") || transactionError.includes("timeout") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wifi className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Network issue detected</p>
                      <p className="text-xs">Please check your internet connection and try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("wallet") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Wallet connection issue</p>
                      <p className="text-xs">Please check that your wallet is connected and try again.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800/30">
                  <div className="flex gap-2 text-blue-800 dark:text-blue-300">
                    <HelpCircle className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Something went wrong</p>
                      <p className="text-xs">You can try again or come back later if the issue persists.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          {txStatus === TransactionStatus.SUCCESS ? (
            <Button
              type="button"
              onClick={() => {
                setTxStatusDialogOpen(false)
              }}
              className="w-full gap-2"
            >
              <Check className="h-4 w-4" />
              Close
            </Button>
          ) : txStatus === TransactionStatus.ERROR ? (
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTxStatusDialogOpen(false)
                }}
                className="flex-1 gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setTxStatus(TransactionStatus.IDLE)
                  setTransactionError(null)
                  setTxProgress(0)
                  handleSubmitVote()
                }}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : (
            <Button type="button" disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

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
      console.log("Vote Details:", voteDetails)

      // If the vote is closed, redirect to the closed page
      // Only redirect if showLiveStats is false
      if (voteDetails.status === "closed" && !voteDetails?.showLiveStats) {
        setLoading(false) // ← Add this line
        router.push(`/vote/${params.id}/closed`)
        return
      }

      // Check if vote is upcoming but start time has passed
      const currentTime = Date.now()
      if (voteDetails.status === "upcoming" && currentTime >= voteDetails.startTimestamp) {
        if (wallet.connected) {
          // Show a toast notification that the vote can be started
          toast.info("This vote's start time has passed and can now be activated", {
            description: "Click 'Start Vote' to begin the voting period",
            duration: 5000,
          })
        }

        // Update the UI to show that the vote can be started
        voteDetails.canBeStarted = true;
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
        initialSelections[poll.id] = []
      })
      setSelections(initialSelections)

      // Default values if wallet is not connected
      let votedStatus = false
      let hasRequiredTokens = !voteDetails.tokenRequirement // True if no token required
      let isWhitelisted = !voteDetails.hasWhitelist // True if no whitelist
      let calculatedTokenBalance = 0

      // Check if user has already voted and meets requirements
      if (wallet.connected && wallet.address) {
        // Check voting status
        votedStatus = await suivote.hasVoted(wallet.address, params.id)
        setHasVoted(votedStatus)
        setSubmitted(votedStatus)

        // If vote is open, user has voted, and live stats are disabled, redirect to success page
        if (votedStatus && !voteDetails?.showLiveStats && voteDetails.status === "active") {
          setLoading(false) // ← Add this line
          router.push(`/vote/${params.id}/success`)
          return
        }

        // If vote is open, user has voted, and live stats are enabled, show results
        if (votedStatus && voteDetails?.showLiveStats) {
          setShowingResults(true)
        }

        // Check token requirements and get actual token balance for weighted voting
        if (voteDetails.tokenRequirement) {
          hasRequiredTokens = await suivote.checkTokenBalance(
            wallet.address,
            voteDetails.tokenRequirement,
            voteDetails.tokenAmount
          )
        }

        // Check whitelist
        if (voteDetails.hasWhitelist) {
          isWhitelisted = await suivote.isVoterWhitelisted(params.id, wallet.address)
        }
      }

      // Update state with the fetched values
      setUserHasRequiredTokens(hasRequiredTokens)

      // Set whether user can vote based on all conditions
      const canVote = wallet.connected &&
        wallet.address &&
        voteDetails.status === "active" &&
        !votedStatus &&
        isWhitelisted &&
        hasRequiredTokens

      setUserCanVote(canVote)

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
  }, [params.id, wallet.connected, wallet.address])

  // Function to handle starting a vote
  const handleStartVote = async () => {
    if (!vote || !wallet.connected) return

    try {
      setTxStatusDialogOpen(true)
      setTransactionError(null)
      setTxStatus(TransactionStatus.BUILDING)
      setTxProgress(20)

      // Create the transaction
      const transaction = suivote.startVoteTransaction(params.id as string)

      // Update progress
      setTxStatus(TransactionStatus.SIGNING)
      setTxProgress(40)

      // Execute the transaction
      const response = await suivote.executeTransaction(transaction)

      // Update progress
      setTxStatus(TransactionStatus.EXECUTING)
      setTxProgress(60)
      setTxDigest(response.digest)

      // Wait for confirmation
      setTxStatus(TransactionStatus.CONFIRMING)
      setTxProgress(80)

      // Transaction successful
      setTxStatus(TransactionStatus.SUCCESS)
      setTxProgress(100)

      toast.success("Vote started successfully!", {
        description: "The vote is now active and ready to receive votes."
      })

      // Store transaction digest in localStorage
      if (response && response.digest) {
        localStorage.setItem(`vote_${params.id}_txDigest`, response.digest)
      }

      // Refresh the page after a short delay
      setTimeout(() => {
        // Reset transaction status to prevent reopening
        setTxStatus(TransactionStatus.IDLE);
        // Explicitly close the dialog
        setTxStatusDialogOpen(false)
        // Use router.refresh() to completely refresh the page data
        router.refresh()
        // Then reload the vote data
        fetchVoteData()
      }, 2000)

    } catch (error) {
      console.error("Error starting vote:", error)
      setTxStatus(TransactionStatus.ERROR)
      setTransactionError(error instanceof Error ? error.message : String(error))

      toast.error("Failed to start vote", {
        description: error instanceof Error ? error.message : "An unknown error occurred"
      })
    }
  }

  // Update progress bar based on transaction status
  useEffect(() => {
    switch (txStatus) {
      case TransactionStatus.IDLE: setTxProgress(0); break
      case TransactionStatus.BUILDING: setTxProgress(20); break
      case TransactionStatus.SIGNING: setTxProgress(40); break
      case TransactionStatus.EXECUTING: setTxProgress(60); break
      case TransactionStatus.CONFIRMING: setTxProgress(80); break
      case TransactionStatus.SUCCESS: setTxProgress(100); break
      case TransactionStatus.ERROR: break // Keep progress where it was
    }
  }, [txStatus])

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
          } else {
            // Show a toast to inform user they've reached max selections
            toast.info(`You can select up to ${poll.maxSelections} options for this poll`, {
              description: "Please deselect an option before selecting a new one"
            });
            // Return unchanged selections
            return prev;
          }
        }
      } else {
        // For single-select polls - always just one option
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

    // Check if user has already voted
    if (hasVoted) {
      newErrors.voted = "You have already voted in this poll"
      isValid = false
    }

    // Check if user has required tokens
    if (!userHasRequiredTokens && vote.tokenRequirement) {
      newErrors.tokens = `You need at least ${vote.tokenAmount} ${vote.tokenRequirement.split("::").pop()} to vote`
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

      // Additional validation for selection count
      if (selections[poll.id] && selections[poll.id].length > 0) {
        // For single-select polls, only one option should be selected
        if (!poll.isMultiSelect && selections[poll.id].length > 1) {
          newErrors[poll.id] = "This is a single-select poll. Please select only one option.";
          isValid = false;
        }

        // For multi-select polls, check against max selections
        if (poll.isMultiSelect && selections[poll.id].length > poll.maxSelections) {
          newErrors[poll.id] = `You can select up to ${poll.maxSelections} options for this poll.`;
          isValid = false;
        }
      }
    })

    setValidationErrors(newErrors)
    return isValid
  }

  /**
 * Handles the submission of all vote selections in a single transaction
 * with precise option mapping to ensure correct display of results
 */
  const handleSubmitVote = async () => {
    try {
      // Set UI state to submitting
      setSubmitting(true);
      setTxStatusDialogOpen(true);
      setTransactionError(null);
      setTxStatus(TransactionStatus.BUILDING);
      setTxProgress(20);

      // Clear any previous validation errors
      setValidationErrors({});

      console.log("[Vote Debug] Starting vote submission process");
      console.log("[Vote Debug] Current selections:", selections);

      // STEP 1: Validate wallet is connected
      if (!wallet || !wallet.address) {
        console.error("[Vote Debug] Wallet not connected");
        setTransactionError("Please connect your wallet to vote");
        setTxStatus(TransactionStatus.ERROR);
        setSubmitting(false);
        return;
      }

      // STEP 2: Validate all poll selections
      const validationErrors = {};
      let hasValidSelections = false;

      // Check each poll for validation issues
      polls.forEach(poll => {
        const selectedOptions = selections[poll.id] || [];

        // Check if required poll has selections
        if (poll.isRequired && selectedOptions.length === 0) {
          validationErrors[poll.id] = "This poll requires a response";
        }

        // Validate selection count based on poll type
        if (!poll.isMultiSelect && selectedOptions.length > 1) {
          validationErrors[poll.id] = "This poll allows only one selection";
        } else if (poll.isMultiSelect && poll.maxSelections &&
          selectedOptions.length > poll.maxSelections) {
          validationErrors[poll.id] = `Maximum ${poll.maxSelections} selections allowed`;
        }

        // Track if we have any valid selections
        if (selectedOptions.length > 0 && !validationErrors[poll.id]) {
          hasValidSelections = true;
        }
      });

      // Must have at least one valid selection
      if (!hasValidSelections) {
        validationErrors.general = "Please make at least one selection";
      }

      // If validation errors, show them and exit
      if (Object.keys(validationErrors).length > 0) {
        console.error("[Vote Debug] Validation failed:", validationErrors);
        setValidationErrors(validationErrors);
        setTxStatus(TransactionStatus.ERROR);
        setTransactionError("Please fix validation errors before submitting");
        setSubmitting(false);
        return;
      }

      // STEP 2.5: ISSUE 2 SOLUTION - Verify option mappings before proceeding
      console.log("[Vote Debug] Verifying option mappings...");
      verifyOptionMappings(polls, selections);

      // STEP 3: Prepare data for transaction
      // Arrays to store poll indices (1-based) and options
      const pollIndices = [];
      const optionIndicesPerPoll = [];

      console.log("[Vote Debug] Processing polls for transaction");

      // For each poll in this vote
      polls.forEach((poll, pollIdx) => {
        // Get the user's selections for this poll (if any)
        const selectedOptionIds = selections[poll.id] || [];

        // Skip polls with no selections
        if (selectedOptionIds.length === 0) {
          console.log(`[Vote Debug] No selection for poll: ${poll.title}`);
          return; // Skip this poll
        }

        // ISSUE 2 SOLUTION: Use utility function for precise option mapping
        const optionIndices = mapOptionIdsToIndices(poll, selectedOptionIds);

        // Verify mapping was successful
        if (optionIndices.length === 0) {
          console.error(`[Vote Debug] Failed to map options for poll: ${poll.title}`);
          return; // Skip this poll due to mapping failure
        }

        // Verify we got the same number of mapped indices as selected IDs
        if (optionIndices.length !== selectedOptionIds.length) {
          console.error(`[Vote Debug] Mapping count mismatch for poll: ${poll.title}`, {
            selectedCount: selectedOptionIds.length,
            mappedCount: optionIndices.length
          });
          return; // Skip this poll due to mapping inconsistency
        }

        // Store valid poll data for transaction
        pollIndices.push(pollIdx + 1); // 1-based poll index
        optionIndicesPerPoll.push(optionIndices);

        console.log(`[Vote Debug] Successfully processed poll ${pollIdx + 1}: ${poll.title}`);
      });

      // Verify we have something to submit after mapping
      if (pollIndices.length === 0) {
        console.error("[Vote Debug] No valid poll mappings to submit");
        setValidationErrors({ general: "Error processing your selections. Please try again." });
        setTxStatus(TransactionStatus.ERROR);
        setTransactionError("Error processing your selections. Please try again.");
        setSubmitting(false);
        return;
      }

      // STEP 4: Get token balance for token-weighted voting
      let tokenBalance = 0;
      if (vote.useTokenWeighting && vote.tokenRequirement) {
        console.log("[Vote Debug] Checking token balance for weighted voting");
        try {
          tokenBalance = await suivote.checkTokenBalance(
            wallet.address,
            vote.tokenRequirement.tokenAddress,
            vote.tokenRequirement.minAmount
          );
          console.log(`[Vote Debug] Token balance: ${tokenBalance}`);
        } catch (tokenError) {
          console.error("[Vote Debug] Error checking token balance:", tokenError);
          // Default to 0 balance on error
        }
      }

      // STEP 5: Create the transaction
      console.log("[Vote Debug] Creating transaction with mapped data");
      setTxStatus(TransactionStatus.BUILDING);

      // ISSUE 1 SOLUTION: Create a single batched transaction
      let transaction;

      // Log final transaction data
      console.log("[Vote Debug] Final transaction data:", {
        voteId: params.id,
        pollIndices: pollIndices,
        optionIndicesPerPoll: optionIndicesPerPoll,
        tokenBalance: tokenBalance,
        paymentAmount: vote.paymentAmount || 0
      });

      // If only one poll, use simple vote transaction
      if (pollIndices.length === 1) {
        console.log("[Vote Debug] Creating single poll transaction");
        transaction = suivote.castVoteTransaction(
          params.id,
          pollIndices[0],
          optionIndicesPerPoll[0],
          tokenBalance,
          vote.paymentAmount || 0
        );
      } else {
        // If multiple polls, use batched transaction
        console.log("[Vote Debug] Creating multi-poll batched transaction");
        transaction = suivote.castMultipleVotesTransaction(
          params.id,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          vote.paymentAmount || 0
        );
      }

      // STEP 6: Execute the transaction
      console.log("[Vote Debug] Sending transaction to wallet for signing");
      setTxStatus(TransactionStatus.SIGNING);
      setTxProgress(40);

      // Send single transaction to wallet (no multiple signatures needed)
      const response = await suivote.executeTransaction(transaction);

      // Update progress
      setTxStatus(TransactionStatus.EXECUTING);
      setTxProgress(60);
      setTxDigest(response.digest);

      // Wait for confirmation
      setTxStatus(TransactionStatus.CONFIRMING);
      setTxProgress(80);

      // Transaction successful
      console.log("[Vote Debug] Transaction complete:", response);
      setTxStatus(TransactionStatus.SUCCESS);
      setTxProgress(100);

      // Update UI on success
      toast.success("Vote submitted successfully!");

      // Update local state
      setSubmitted(true);
      setHasVoted(true);

      // Store transaction digest in localStorage for the success page
      if (response && response.digest) {
        setTxDigest(response.digest);
        localStorage.setItem(`vote_${params.id}_txDigest`, response.digest);
      }

      // Redirect to success page or show results based on vote settings
      setTimeout(() => {
        // Reset transaction status to prevent reopening
        setTxStatus(TransactionStatus.IDLE);
        // Explicitly close the dialog
        setTxStatusDialogOpen(false);
        if (vote?.showLiveStats) {
          // If live stats are enabled, just show results on this page
          setShowingResults(true);
          fetchVoteData(); // Refresh data to show updated results
        } else {
          // Otherwise redirect to success page
          router.push(`/vote/${params.id}/success?digest=${response.digest}`);
        }
      }, 1500);

    } catch (error) {
      // Detailed error logging
      console.error("[Vote Debug] Transaction failed:", error);
      console.error("[Vote Debug] Error details:", {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });

      // Update UI state
      setTxStatus(TransactionStatus.ERROR);
      setTxProgress(100); // Complete the progress bar even for errors

      // Format user-friendly error message
      let userErrorMessage = "Failed to submit vote";
      let errorType = "unknown";

      if (error.message) {
        // Check for common wallet interaction errors
        if (error.message.includes("insufficient gas") || error.message.includes("insufficient balance")) {
          userErrorMessage = "Insufficient SUI to complete transaction. Please add more SUI to your wallet and try again.";
          errorType = "insufficient_funds";
        } else if (error.message.includes("rejected") || error.message.includes("user reject") ||
          error.message.includes("user denied") || error.message.includes("user cancelled")) {
          userErrorMessage = "Transaction rejected by wallet. You can try again when ready.";
          errorType = "user_rejected";
        } else if (error.message.includes("user abort") || error.message.includes("cancelled") ||
          error.message.includes("canceled")) {
          userErrorMessage = "Transaction cancelled. You can try again when ready.";
          errorType = "user_cancelled";
        } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
          userErrorMessage = "Transaction timed out. Please check your network connection and try again.";
          errorType = "timeout";
        } else if (error.message.includes("network") || error.message.includes("connection")) {
          userErrorMessage = "Network error. Please check your internet connection and try again.";
          errorType = "network";
        } else if (error.message.includes("wallet not connected") || error.message.includes("wallet disconnected")) {
          userErrorMessage = "Wallet disconnected. Please reconnect your wallet and try again.";
          errorType = "wallet_disconnected";
        } else {
          // Clean up technical details for user display
          userErrorMessage = error.message
            .replace(/Error invoking RPC method '[^']+': /g, '')
            .replace(/\([^)]+\)/g, '')
            .trim();

          // If the message is too technical or long, provide a more generic message
          if (userErrorMessage.length > 100) {
            userErrorMessage = "An unexpected error occurred with the blockchain transaction. Please try again later.";
          }
        }
      }

      // Store error information for display
      setTransactionError(userErrorMessage);
      setSubmitting(false);

      // Show error toast with appropriate action guidance
      toast.error("Vote submission failed", {
        description: userErrorMessage,
        action: errorType === "user_rejected" || errorType === "user_cancelled" ? {
          label: "Try Again",
          onClick: () => handleSubmitVote()
        } : undefined,
        duration: 5000 // Show longer for errors so user can read the message
      });
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

    if (now > endDate) {
      return "Ended"
    }

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
        return (
          <Badge className="bg-green-500 hover:bg-green-600 text-white">
            Active
          </Badge>
        )
      case "upcoming":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600 text-white">
            Upcoming
          </Badge>
        )
      case "ended":
      case "closed":
        return (
          <Badge className="bg-gray-500 hover:bg-gray-600 text-white">
            Ended
          </Badge>
        )
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

  // Handle share dialog
  const handleShare = () => {
    setShareDialogOpen(true)
  }

  // Handle copy address
  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address)
    toast.success("Address copied to clipboard")
  }

  // Loading state
  if (loading) {
    return (
      <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse"></div>
              <div className="absolute inset-0 h-16 w-16 rounded-full border-t-4 border-primary animate-spin"></div>
            </div>
          </div>
          <div className="text-center space-y-3">
            <h3 className="text-xl font-medium">Loading Vote</h3>
            <p className="text-muted-foreground text-sm">Please wait while we retrieve the vote data...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (validationErrors.general || !vote) {
    return (
      <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Vote</AlertTitle>
          <AlertDescription>
            {validationErrors.general || "Failed to load vote data. Please try again later."}
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="gap-2">
          <Link href="/polls">
            <ArrowLeft className="h-4 w-4" />
            Back to Polls
          </Link>
        </Button>
      </div>
    )
  }

  // Upcoming vote state
  if (vote && vote.status === "upcoming") {
    return (
      <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <Button asChild variant="outline" size="sm" className="transition-all duration-200 hover:translate-x-[-2px]">
            <Link href="/polls">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Polls
            </Link>
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Card className="border border-muted/40 shadow-lg overflow-hidden rounded-xl transition-all duration-200 hover:shadow-xl hover:border-muted/60">
            <div className="h-2 bg-blue-500 w-full"></div>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl md:text-3xl">{vote.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    {vote.canBeStarted ? (
                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Ready to Start</Badge>
                    ) : (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Upcoming</Badge>
                    )}
                    <Badge variant="outline" className="gap-1 transition-all duration-200 hover:translate-x-[2px]">
                      <Calendar className="h-3 w-3" />
                      {vote.canBeStarted ? "Can be started now" : `Starts ${formatDate(vote.startTimestamp)}`}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pb-6">
              {vote.description && (
                <div className="mb-4 text-muted-foreground">
                  {vote.description}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Voting Period</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(vote.startTimestamp)} - {formatDate(vote.endTimestamp)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Starting In</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(vote.startTimestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>

              {Date.now() >= vote.startTimestamp && wallet.connected ? (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle>Vote Ready to Start</AlertTitle>
                    <AlertDescription>
                      This vote's scheduled start time has passed and it can now be activated.
                    </AlertDescription>
                  </Alert>

                  <Button
                    size="lg"
                    className="gap-2 w-full sm:w-auto"
                    onClick={handleStartVote}
                  >
                    <Play className="h-4 w-4" />
                    Start Vote
                  </Button>
                </div>
              ) : (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle>This vote has not started yet</AlertTitle>
                  <AlertDescription>
                    This vote will be available for participation starting on {formatDate(vote.startTimestamp)} at{" "}
                    {formatTime(vote.startTimestamp)}.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Vote details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Creator info */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Creator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium truncate">
                      {vote.creatorName || truncateAddress(vote.creator)}
                    </p>
                    <button
                      onClick={() => handleCopyAddress(vote.creator)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <a
                    href={`https://explorer.sui.io/address/${vote.creator}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                  >
                    View on Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requirements info */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Voting Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vote.hasWhitelist && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Whitelist Required</p>
                      <p className="text-xs text-muted-foreground">Only approved addresses can vote</p>
                    </div>
                  </div>
                )}

                {vote.tokenRequirement && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Token Requirement</p>
                      <p className="text-xs text-muted-foreground">
                        Minimum {vote.tokenAmount} {vote.tokenRequirement.split("::").pop()}
                      </p>
                    </div>
                  </div>
                )}

                {vote.paymentAmount > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payment Required</p>
                      <p className="text-xs text-muted-foreground">{vote.paymentAmount / 1000000000} SUI to vote</p>
                    </div>
                  </div>
                )}

                {!vote.hasWhitelist && !vote.tokenRequirement && vote.paymentAmount <= 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Open to All</p>
                      <p className="text-xs text-muted-foreground">
                        Anyone can participate once voting opens
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <BarChart2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Results Visibility</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {vote.showLiveStats ? (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Results visible after voting</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Results hidden until vote ends</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Polls preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Polls Preview</h2>
            <Badge variant="outline" className="gap-1 transition-all duration-200 hover:translate-x-[2px]">
              <MessageSquareText className="h-3 w-3" />
              {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
            </Badge>
          </div>

          <div className="space-y-6">
            {polls.map((poll, index) => (
              <Card key={poll.id} className="overflow-hidden">
                <div className="h-1 w-full bg-blue-500/70"></div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {poll.title}
                      </CardTitle>
                      {poll.description && <CardDescription className="mt-1">{poll.description}</CardDescription>}
                    </div>
                    {poll.isRequired && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-6">
                  <div className="space-y-2.5 opacity-70">
                    {(() => {
                      // Verify option mappings for poll preview
                      try {
                        verifyOptionMappings([poll], {});
                        console.log(`[Poll Preview] Options verified for poll: ${poll.title}`);
                      } catch (error) {
                        console.warn(`[Poll Preview] Option mapping verification failed for poll: ${poll.title}`, error);
                      }

                      return poll.options.slice(0, 3).map((option, optionIndex) => {
                        // Log option mapping info for preview
                        console.log(`[Poll Preview] Option ${optionIndex + 1}: ${option.text} (ID: ${option.id}, Index: ${optionIndex + 1})`);

                        return (
                          <div key={option.id} className="flex items-center gap-3">
                            <div className="h-5 w-5 rounded-full border border-muted-foreground flex items-center justify-center">
                              {poll.isMultiSelect ? (
                                <div className="h-3 w-3 rounded-sm border border-muted-foreground" />
                              ) : (
                                <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                              )}
                            </div>
                            <div className="text-base truncate flex-1 flex items-center gap-2">
                              {option.text}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {poll.options.length > 3 && (
                      <div className="text-sm text-muted-foreground mt-1 pl-8">
                        + {poll.options.length - 3} more options
                      </div>
                    )}
                  </div>

                  {poll.isMultiSelect && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 inline mr-1" />
                      Multiple selection enabled (up to {poll.maxSelections})
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Vote metadata */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="mt-8"
        >
          <Separator className="my-6" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Vote ID:</span>
              <a
                href={`https://explorer.sui.io/object/${params.id}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                {truncateAddress(params.id)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <Button onClick={handleShare} variant="ghost" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </motion.div>

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          title={vote.title}
          url={typeof window !== "undefined" ? window.location.href : ""}
        />

        {/* Transaction Status Dialog */}
        <TransactionStatusDialog />
      </div>
    )
  }

  // Main vote page - handles cases:
  // 1. Vote is open and user has not voted
  // 2. Vote is open, user has voted, and live stats are enabled
  // 4. Vote is closed and live stats are enabled
  return (
    <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <Button asChild variant="outline" size="sm" className="group transition-all duration-200 hover:shadow-md hover:translate-x-[-2px]">
          <Link href="/polls">
            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Polls
          </Link>
        </Button>
      </motion.div>

      {/* Vote header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Card className={cn(
          "border border-muted/40 shadow-xl overflow-hidden rounded-xl hover:shadow-2xl transition-all duration-300",
          vote.status === "active" ? "border-t-green-500" : "border-t-gray-500",
        )}>
          <div className={cn(
            "h-2.5 w-full",
            vote.status === "active" ? "bg-green-500" : "bg-gray-500",
          )}></div>
          <CardHeader className="pb-3 pt-5 px-5 md:px-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold">{vote.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {getStatusBadge()}
                  <Badge variant="outline" className="gap-1.5 py-1 px-3">
                    <Users className="h-3.5 w-3.5" />
                    {vote.totalVotes} votes
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1 px-3">
                    <Clock className="h-3.5 w-3.5" />
                    {getTimeRemaining()}
                  </Badge>
                  {vote.showLiveStats ? (
                    <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                      <Eye className="h-3.5 w-3.5" />
                      Live Results
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-gray-100/50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800">
                      <EyeOff className="h-3.5 w-3.5" />
                      Hidden Results
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2 hover:bg-primary/10 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pb-6 px-5 md:px-6">
            {vote.description && (
              <div className="mb-5 text-muted-foreground text-base leading-relaxed">
                {vote.description}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 hover:shadow-sm">
                <div className={cn(
                  "p-2.5 rounded-full",
                  vote.status === "active" ? "bg-green-100 dark:bg-green-900/30" :
                    vote.status === "closed" ? "bg-gray-100 dark:bg-gray-900/30" :
                      "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  <Calendar className={cn(
                    "h-5 w-5",
                    vote.status === "active" ? "text-green-600 dark:text-green-400" :
                      vote.status === "closed" ? "text-gray-600 dark:text-gray-400" :
                        "text-blue-600 dark:text-blue-400"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium">Voting Period</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(vote.startTimestamp)} - {formatDate(vote.endTimestamp)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 hover:shadow-sm">
                <div className={cn(
                  "p-2.5 rounded-full",
                  vote.status === "active" ? "bg-green-100 dark:bg-green-900/30" :
                    vote.status === "closed" ? "bg-gray-100 dark:bg-gray-900/30" :
                      "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  <Timer className={cn(
                    "h-5 w-5",
                    vote.status === "active" ? "text-green-600 dark:text-green-400" :
                      vote.status === "closed" ? "text-gray-600 dark:text-gray-400" :
                        "text-blue-600 dark:text-blue-400"
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {vote.status === "closed" ? "Ended" : getTimeRemaining()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vote.status === "closed" ?
                      `${formatDistanceToNow(new Date(vote.endTimestamp), { addSuffix: true })}` :
                      `${formatTime(vote.startTimestamp)} - ${formatTime(vote.endTimestamp)}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Status message based on conditions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {vote.status === "closed" ? (
                <Alert className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 mb-0 shadow-sm rounded-lg">
                  <div className="p-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mr-2">
                    <Lock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <AlertTitle className="font-semibold text-base">This vote has ended</AlertTitle>
                  <AlertDescription className="mt-1">
                    {vote.showLiveStats ?
                      "The voting period has concluded. Results are available below." :
                      "The voting period has concluded. Results will be displayed when released by the creator."
                    }
                  </AlertDescription>
                </Alert>
              ) : hasVoted ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mb-0 shadow-sm rounded-lg">
                  <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded-full mr-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <AlertTitle className="font-semibold text-base">Thank you for voting!</AlertTitle>
                  <AlertDescription className="mt-1">
                    {vote.showLiveStats ?
                      "Your vote has been recorded. Live results are shown below." :
                      "Your vote has been recorded. Results will be available when voting ends."
                    }
                  </AlertDescription>
                </Alert>
              ) : (
                vote.status === "active" && (
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-0 shadow-sm rounded-lg">
                    <div className="p-1.5 bg-blue-200 dark:bg-blue-800 rounded-full mr-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <AlertTitle className="font-semibold text-base">Active Vote</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4 mt-1">
                      <span>
                        {!wallet.connected ?
                          "Connect your wallet to participate in this vote." :
                          vote.hasWhitelist && !userCanVote ?
                            "Your wallet is not on the whitelist for this vote." :
                            vote.tokenRequirement && !userHasRequiredTokens ?
                              `You need at least ${vote.tokenAmount} ${vote.tokenRequirement.split("::").pop()} to vote.` :
                              "Cast your vote by selecting options below."
                        }
                      </span>
                      {!wallet.connected && <WalletConnectButton />}
                    </AlertDescription>
                  </Alert>
                )
              )}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs for navigation (only if there are multiple polls) */}
      {polls.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6"
        >
          <Tabs defaultValue="vote" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="vote">Vote</TabsTrigger>
              <TabsTrigger value="polls">All Polls ({polls.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>
      )}

      {/* Content based on tab selection */}
      <div className="space-y-6">
        {activeTab === "vote" ? (
          // Single poll view
          polls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-2"
            >
              {/* Poll navigation if more than one poll */}
              {polls.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-8 w-8 transition-all hover:scale-110"
                      onClick={() => {
                        if (activePollIndex > 0) {
                          setActivePollIndex(activePollIndex - 1)
                        }
                      }}
                      disabled={activePollIndex === 0}
                      title="Previous poll"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Poll {activePollIndex + 1} of {polls.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-8 w-8 transition-all hover:scale-110"
                      onClick={() => {
                        if (activePollIndex < polls.length - 1) {
                          setActivePollIndex(activePollIndex + 1)
                        }
                      }}
                      disabled={activePollIndex === polls.length - 1}
                      title="Next poll"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Badge
                    variant={polls[activePollIndex].isRequired ? "secondary" : "outline"}
                    className={cn(
                      "text-xs",
                      polls[activePollIndex].isRequired && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    {polls[activePollIndex].isRequired ? "Required" : "Optional"}
                  </Badge>
                </div>
              )}

              {/* Current active poll */}
              <Card className={cn(
                "transition-all duration-300 relative overflow-hidden border border-muted/40 shadow-md rounded-xl hover:shadow-lg",
                validationErrors[polls[activePollIndex].id] && "border-red-500"
              )}>
                <div className={cn(
                  "h-1.5 w-full",
                  validationErrors[polls[activePollIndex].id] ? "bg-red-500" :
                    polls[activePollIndex].isRequired ? "bg-amber-500" : "bg-blue-500",
                )}></div>
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl">
                    {polls[activePollIndex].title}
                  </CardTitle>
                  {polls[activePollIndex].description && (
                    <CardDescription className="mt-1">
                      {polls[activePollIndex].description}
                    </CardDescription>
                  )}
                  {polls[activePollIndex].isMultiSelect && (
                    <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Info className="h-4 w-4" />
                      Select up to {polls[activePollIndex].maxSelections} option
                      {polls[activePollIndex].maxSelections !== 1 ? "s" : ""}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pb-6">
                  {validationErrors[polls[activePollIndex].id] && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {validationErrors[polls[activePollIndex].id]}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Options with either radio buttons or checkboxes */}
                  <div className="space-y-4">
                    {(() => {
                      // Verify option mappings before rendering
                      const currentPoll = polls[activePollIndex];
                      console.log(`[Option Listing] Verifying options for poll: ${currentPoll.title}`);

                      try {
                        verifyOptionMappings([currentPoll], selections);
                        console.log(`[Option Listing] Options verified successfully for poll: ${currentPoll.title}`);
                      } catch (error) {
                        console.warn(`[Option Listing] Option mapping verification failed for poll: ${currentPoll.title}`, error);
                      }

                      // Get mapped option indices for current selections (for debugging)
                      const currentSelections = selections[currentPoll.id] || [];
                      if (currentSelections.length > 0) {
                        try {
                          const mappedIndices = mapOptionIdsToIndices(currentPoll, currentSelections);
                          console.log(`[Option Listing] Current selections mapping:`, {
                            pollTitle: currentPoll.title,
                            selectedIds: currentSelections,
                            mappedIndices: mappedIndices
                          });
                        } catch (error) {
                          console.warn(`[Option Listing] Failed to map current selections:`, error);
                        }
                      }

                      return currentPoll.isMultiSelect ? (
                        // Multi-select poll (checkboxes)
                        currentPoll.options.map((option, optionIndex) => {
                          const isSelected = currentSelections.includes(option.id)
                          const isDisabled =
                            hasVoted ||
                            vote.status !== "active" ||
                            !wallet.connected ||
                            !userCanVote ||
                            (!isSelected && currentSelections.length >= currentPoll.maxSelections)

                          // Log option mapping info for debugging
                          console.log(`[Option Listing] Option ${optionIndex + 1}: ${option.text} (ID: ${option.id}, Index: ${optionIndex + 1})`);

                          return (
                            <div key={option.id} className={cn(
                              "rounded-lg border p-4 transition-all duration-200 hover:bg-accent/30",
                              isSelected && "bg-primary/5 border-primary/30 shadow-sm",
                              isDisabled && "opacity-80",
                              showingResults && "relative overflow-hidden transition-all"
                            )}>
                              {/* Progress bar for results */}
                              {showingResults && (
                                <div
                                  className="absolute inset-0 bg-primary/5 origin-left transition-all duration-1000 ease-out"
                                  style={{ transform: `scaleX(${option.percentage / 100})` }}
                                ></div>
                              )}

                              <div className="relative z-10 flex items-start space-x-3">
                                <Checkbox
                                  id={option.id}
                                  checked={isSelected}
                                  onCheckedChange={() => {
                                    console.log(`[Option Selection] Checkbox changed for option: ${option.text} (ID: ${option.id}, Index: ${optionIndex + 1})`);
                                    handleOptionSelect(currentPoll.id, option.id, true);
                                  }}
                                  disabled={isDisabled}
                                  className={cn(
                                    "mt-1 h-5 w-5 rounded-sm",
                                    isSelected && "border-primary bg-primary text-primary-foreground",
                                  )}
                                />
                                <div className="grid gap-1.5 leading-none w-full">
                                  <Label
                                    htmlFor={option.id}
                                    className={cn("text-base font-normal", isDisabled && "opacity-70")}
                                  >
                                    <span className="flex items-center gap-2">
                                      {option.text}
                                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        #{optionIndex + 1}
                                      </span>
                                    </span>
                                  </Label>

                                  {/* Show results if conditions are met */}
                                  {showingResults && (
                                    <div className="mt-2 space-y-1">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">{option.votes} votes</span>
                                        <span className="font-medium">{option.percentage.toFixed(1)}%</span>
                                      </div>
                                    </div>
                                  )}

                                  {option.mediaUrl && (
                                    <div className="mt-3 rounded-md overflow-hidden">
                                      <img
                                        src={option.mediaUrl || "/placeholder.svg"}
                                        alt={option.text}
                                        className="w-full max-h-48 object-cover rounded-md border"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        // Single-select poll (radio buttons)
                        <RadioGroup
                          value={currentSelections[0] || ""}
                          onValueChange={(value) => {
                            const selectedOption = currentPoll.options.find(opt => opt.id === value);
                            const optionIndex = currentPoll.options.findIndex(opt => opt.id === value);
                            console.log(`[Option Selection] Radio changed for option: ${selectedOption?.text} (ID: ${value}, Index: ${optionIndex + 1})`);
                            handleOptionSelect(currentPoll.id, value, false);
                          }}
                          className="space-y-4"
                          disabled={hasVoted || vote.status !== "active" || !wallet.connected || !userCanVote}
                        >
                          {currentPoll.options.map((option, optionIndex) => {
                            const isSelected = currentSelections.includes(option.id)
                            const isDisabled =
                              hasVoted ||
                              vote.status !== "active" ||
                              !wallet.connected ||
                              !userCanVote

                            // Log option mapping info for debugging
                            console.log(`[Option Listing] Option ${optionIndex + 1}: ${option.text} (ID: ${option.id}, Index: ${optionIndex + 1})`);

                            return (
                              <div key={option.id} className={cn(
                                "rounded-lg border p-4 transition-all duration-200 hover:bg-accent/30",
                                isSelected && "bg-primary/5 border-primary/30 shadow-sm",
                                isDisabled && "opacity-80",
                                showingResults && "relative overflow-hidden transition-all"
                              )}>
                                {/* Progress bar for results */}
                                {showingResults && (
                                  <div
                                    className="absolute inset-0 bg-primary/5 origin-left transition-all duration-1000 ease-out"
                                    style={{ transform: `scaleX(${option.percentage / 100})` }}
                                  ></div>
                                )}

                                <div className="relative z-10 flex items-start space-x-3">
                                  <RadioGroupItem
                                    value={option.id}
                                    id={option.id}
                                    disabled={isDisabled}
                                    className="mt-1 h-5 w-5"
                                  />
                                  <div className="grid gap-1.5 leading-none w-full">
                                    <Label
                                      htmlFor={option.id}
                                      className={cn("text-base font-normal", isDisabled && "opacity-70")}
                                    >
                                      <span className="flex items-center gap-2">
                                        {option.text}
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                          #{optionIndex + 1}
                                        </span>
                                      </span>
                                    </Label>

                                    {/* Show results if conditions are met */}
                                    {showingResults && (
                                      <div className="mt-2 space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-muted-foreground">{option.votes} votes</span>
                                          <span className="font-medium">{option.percentage.toFixed(1)}%</span>
                                        </div>
                                      </div>
                                    )}

                                    {option.mediaUrl && (
                                      <div className="mt-3 rounded-md overflow-hidden">
                                        <img
                                          src={option.mediaUrl || "/placeholder.svg"}
                                          alt={option.text}
                                          className="w-full max-h-48 object-cover rounded-md border"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </RadioGroup>
                      );
                    })()}
                  </div>
                </CardContent>

                {polls.length > 1 && (
                  <CardFooter className="flex flex-col gap-5 p-6 pt-4 border-t">
                    <div className="flex justify-between items-center w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (activePollIndex > 0) {
                            setActivePollIndex(activePollIndex - 1)
                          }
                        }}
                        disabled={activePollIndex === 0}
                        className="gap-2 transition-all duration-300 hover:translate-x-[-2px] h-10 px-4 shadow-sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        
                      </Button>

                      

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (activePollIndex < polls.length - 1) {
                            setActivePollIndex(activePollIndex + 1)
                          }
                        }}
                        disabled={activePollIndex === polls.length - 1}
                        className="gap-2 transition-all duration-300 hover:translate-x-[2px] h-10 px-4 shadow-sm"
                      >
                        
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Poll count indicator */}
                    <div className="flex items-center justify-center gap-4 w-full py-2">
                      {polls.map((poll, index) => (
                        <button
                          key={index}
                          onClick={() => setActivePollIndex(index)}
                          className={cn(
                            "transition-all flex flex-col items-center gap-2 group",
                          )}
                          aria-label={`Go to poll ${index + 1}`}
                        >
                          <div className={cn(
                            "w-3 h-3 rounded-full transition-all duration-300",
                            activePollIndex === index
                              ? "bg-primary scale-125 ring-2 ring-primary/20"
                              : "bg-muted hover:bg-primary/50",
                            poll.isRequired && !selections[poll.id]?.length && "ring-2 ring-amber-500/30",
                            validationErrors[poll.id] && "ring-2 ring-red-500/30 bg-red-200"
                          )} />
                          <span className={cn(
                            "text-xs transition-all",
                            activePollIndex === index ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground",
                            poll.isRequired && !selections[poll.id]?.length && "text-amber-600",
                            validationErrors[poll.id] && "text-red-500"
                          )}>
                            {index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardFooter>
                )}
              </Card>
            </motion.div>
          )
        ) : (
          // All polls view (Grid)
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 gap-6"
          >
            {polls.map((poll, pollIndex) => (
              <Card key={poll.id} className={cn(
                "transition-all duration-300 relative overflow-hidden cursor-pointer border hover:shadow-lg",
                validationErrors[poll.id] && "border-red-500",
                !validationErrors[poll.id] && poll.isRequired && "border-amber-500/30"
              )}
                onClick={() => {
                  setActivePollIndex(pollIndex)
                  setActiveTab("vote")
                }}
              >
                <div className={cn(
                  "h-1.5 w-full",
                  validationErrors[poll.id] ? "bg-red-500" :
                    poll.isRequired ? "bg-amber-500" : "bg-blue-500",
                )}></div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {pollIndex + 1}. {poll.title}
                      </CardTitle>
                      {poll.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {poll.description}
                        </CardDescription>
                      )}
                    </div>
                    {poll.isRequired && (
                      <Badge
                        variant="outline"
                        className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"
                      >
                        Required
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="space-y-3">
                    {(() => {
                      // Verify option mappings for this poll before rendering
                      try {
                        verifyOptionMappings([poll], selections);
                        console.log(`[Poll Grid] Options verified for poll: ${poll.title}`);
                      } catch (error) {
                        console.warn(`[Poll Grid] Option mapping verification failed for poll: ${poll.title}`, error);
                      }

                      return showingResults ? (
                        // Show results if conditions are met
                        poll.options
                          .sort((a, b) => b.votes - a.votes)
                          .slice(0, 3)
                          .map((option, optionIndex) => {
                            // Log the mapping information for results display
                            const originalIndex = poll.options.findIndex(opt => opt.id === option.id);
                            console.log(`[Poll Grid Results] Option: ${option.text} (ID: ${option.id}, Original Index: ${originalIndex + 1})`);

                            return (
                              <div key={option.id} className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium line-clamp-1 flex items-center gap-2">
                                    {option.text}
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      #{originalIndex + 1}
                                    </span>
                                  </span>
                                  <span>{option.votes} votes ({option.percentage.toFixed(1)}%)</span>
                                </div>
                                <Progress value={option.percentage} className="h-2" />
                              </div>
                            );
                          })
                      ) : (
                        // Show options preview without results
                        <>
                          {poll.options.slice(0, 3).map((option, optionIndex) => {
                            // Log option mapping info for preview
                            console.log(`[Poll Grid Preview] Option ${optionIndex + 1}: ${option.text} (ID: ${option.id})`);

                            return (
                              <div key={option.id} className="flex items-center gap-3">
                                <div className="h-4 w-4 flex-shrink-0 rounded-full border border-muted-foreground flex items-center justify-center">
                                  {poll.isMultiSelect ? (
                                    <div className="h-2 w-2 rounded-sm border border-muted-foreground" />
                                  ) : (
                                    <div className="h-2 w-2 rounded-full border border-muted-foreground" />
                                  )}
                                </div>
                                <div className="text-sm truncate flex items-center gap-2">
                                  {option.text}
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    #{optionIndex + 1}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {poll.options.length > 3 && (
                            <div className="text-xs text-muted-foreground pl-7 mt-1">
                              + {poll.options.length - 3} more options
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {poll.isMultiSelect && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      <Info className="h-3 w-3 inline mr-1" />
                      Multiple selection (up to {poll.maxSelections})
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-0 pb-4 px-6">
                  <div className="w-full flex flex-col xs:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{poll.totalResponses || 0} responses</span>
                    </div>

                    {selections[poll.id]?.length > 0 ? (
                      <Badge variant="outline" className="bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Selection made
                      </Badge>
                    ) : poll.isRequired && vote.status === "active" && !hasVoted ? (
                      <Badge variant="outline" className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Response required
                      </Badge>
                    ) : null}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Submit button (only show if vote is active and user hasn't voted yet) */}
        {vote.status === "active" && !hasVoted && userCanVote && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row justify-between items-center p-6 border border-primary/20 rounded-xl bg-primary/5 shadow-md gap-5"
          >
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-primary/10 p-2 rounded-full">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium">
                {vote.requireAllPolls
                  ? "All polls must be answered to submit your vote."
                  : "Required polls must be answered to submit your vote."}
              </p>
            </div>

            <Button
              onClick={handleSubmitVote}
              disabled={submitting || !userCanVote}
              className={cn(
                "gap-2 transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px] active:translate-y-[1px]",
                "w-full sm:w-auto py-6 px-8 text-base font-medium",
                submitting ? "bg-primary/90" : "bg-primary"
              )}
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Submit Vote</span>
                </>
              )}
            </Button>
          </motion.div>
        )}
      </div>

      {/* Vote metadata footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-10"
      >
        <Separator className="my-6" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Created by:</span>
            <a
              href={`https://explorer.sui.io/address/${vote.creator}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
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
              className="flex items-center gap-1 hover:text-primary transition-colors"
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

      {/* Transaction Status Dialog */}
      <TransactionStatusDialog />
    </div>
  )
}