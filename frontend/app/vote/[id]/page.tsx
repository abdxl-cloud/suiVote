"use client"

import { useState, useEffect, useCallback, ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { TransactionStatusDialog, TransactionStatus } from "@/components/transaction-status-dialog"
import { formatTokenAmount } from "@/utils/token-utils"
import { VoteDetails, PollDetails, PollOptionDetails } from "@/services/suivote-service"
import { VoteSuccess } from "@/components/vote-success"
import { VoteClosed } from "@/components/vote-closed"

// UI Components
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  ArrowLeft,
  Share2,
  Wallet,
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
import { LoadingButton } from "@/components/ui/loading-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { VoteDetailSkeleton } from "@/components/skeletons"
import { ShareDialog } from "@/components/share-dialog"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { mapOptionIdsToIndices, verifyOptionMappings } from '@/components/vote-utils';

// Transaction status enum
// Using TransactionStatus enum from the imported component

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const suivote = useSuiVote()

  // State
  const [vote, setVote] = useState<VoteDetails | null>(null)
  const [polls, setPolls] = useState<(PollDetails & { options: (PollOptionDetails & { percentage: number })[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [showingResults, setShowingResults] = useState(false)
  const [activeTab, setActiveTab] = useState("vote")
  const [activePollIndex, setActivePollIndex] = useState(0)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})
  const [userCanVote, setUserCanVote] = useState(false)
  const [userHasRequiredTokens, setUserHasRequiredTokens] = useState(true)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [hasUserInteracted, setHasUserInteracted] = useState(false) // Track if user has made any selections
  const [loadingError, setLoadingError] = useState<string | null>(null) // Separate loading errors from validation errors
  const [expandedBadges, setExpandedBadges] = useState<{ [key: string]: boolean }>({}) // Track which badge info is expanded

  // Smart validation states
  const [touchedPolls, setTouchedPolls] = useState<{ [key: string]: boolean }>({})
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  // Debug effect to track state changes
  useEffect(() => {
    console.log("=== COMPONENT RENDER DEBUG ===");
    console.log("hasVoted:", hasVoted);
    console.log("vote.showLiveStats:", vote?.showLiveStats);
    console.log("vote.status:", vote?.status);
    console.log("==============================");
  }, [hasVoted, vote?.showLiveStats, vote?.status]);

  // Helper function to toggle badge expansion
  const toggleBadgeExpansion = (badgeKey: string) => {
    setExpandedBadges(prev => ({
      ...prev,
      [badgeKey]: !prev[badgeKey]
    }))
  }

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
    }, 5000); // Update every 5 seconds instead of 1 second to reduce load

    return () => clearInterval(timer);
  }, [vote?.status, vote?.startTimestamp]);


  // Transaction state
  const [txStatus, setTxStatus] = useState(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txProgress, setTxProgress] = useState(0)
  const [failedStep, setFailedStep] = useState<TransactionStatus | undefined>(undefined)

  // State to track selections for each poll
  const [selections, setSelections] = useState<{ [key: string]: string[] }>({})

  // Transaction dialog state
  const [txStatusDialogOpen, setTxStatusDialogOpen] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // Using the reusable TransactionStatusDialog component
  const handleDialogClose = () => {
    // Only allow closing the dialog if transaction is complete or failed
    if (txStatus === TransactionStatus.SUCCESS || txStatus === TransactionStatus.ERROR) {
      // Reset transaction status to prevent reopening
      setTxStatus(TransactionStatus.IDLE);
      // Explicitly close the dialog
      setTxStatusDialogOpen(false);
      // If transaction was successful, refresh the page data
      if (txStatus === TransactionStatus.SUCCESS) {
        router.refresh();
        fetchVoteData();
      }
    }
  }

  const handleTryAgain = () => {
    setTxStatus(TransactionStatus.IDLE);
    setTransactionError(null);
    setTxProgress(0);
    handleSubmitVote();
  }

  const fetchVoteData = async () => {
    try {
      setLoading(true)
      setLoadingError(null) // Clear any previous loading errors

      if (!params.id) {
        throw new Error("Vote ID is required")
      }

      // Get vote details
      const voteDetails = await suivote.getVoteDetails(params.id)
      if (!voteDetails) {
        throw new Error("Vote not found")
      }

      // Check whitelist access - if vote has whitelist and user is connected, verify access
      if (voteDetails.hasWhitelist && wallet.connected && wallet.address) {
        const isWhitelisted = await suivote.isVoterWhitelisted(params.id, wallet.address)
        if (!isWhitelisted) {
          throw new Error("Access denied: You are not authorized to view this whitelisted vote")
        }
      } else if (voteDetails.hasWhitelist && !wallet.connected) {
        // If vote has whitelist but wallet is not connected, deny access
        throw new Error("Access denied: Please connect your wallet to view this whitelisted vote")
      }

      // Note: Routing logic moved to polls page - users are now directed to appropriate pages from there

      // Check if vote is upcoming but start time has passed - automatically start it
      const currentTime = Date.now()
      if (voteDetails.status === "upcoming" && currentTime >= voteDetails.startTimestamp) {
        if (wallet.connected) {
          try {
            // Automatically start the vote
            const transaction = suivote.startVoteTransaction(params.id)
            const response = await suivote.executeTransaction(transaction)
            
            toast.success("Vote automatically started!", {
              description: "The vote is now active and ready to receive votes.",
              duration: 5000,
            })
            
            // Store transaction digest
            if (response && response.digest) {
              localStorage.setItem(`vote_${params.id}_txDigest`, response.digest)
            }
            
            // Refresh vote data to get updated status
            setTimeout(() => {
              fetchVoteData()
            }, 1000)
            
          } catch (error) {
            console.error("Error auto-starting vote:", error)
            // Fall back to manual activation if auto-start fails
            toast.warning("Vote ready to start", {
              description: "Auto-start failed. Please start the vote manually.",
              duration: 5000,
            })
            voteDetails.canBeStarted = true;
          }
        } else {
          // If wallet not connected, just mark as ready to start
          voteDetails.canBeStarted = true;
        }
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
        // Check voting status - but preserve local state if user just voted
        // This prevents blockchain propagation delays from overriding correct state
        if (!hasVoted) {
          console.log("Checking blockchain for hasVoted status");
          votedStatus = await suivote.hasVoted(wallet.address, params.id)
          console.log("Blockchain hasVoted result:", votedStatus);
          setHasVoted(votedStatus)
          setSubmitted(votedStatus)
        } else {
          // User has already voted according to local state, keep it
          console.log("Preserving local hasVoted state:", hasVoted);
          votedStatus = hasVoted
        }

        // Note: Routing logic moved to polls page - users are now directed to appropriate pages from there

        // If vote is open, user has voted, and live stats are enabled, show results
        if (votedStatus && voteDetails?.showLiveStats) {
          setShowingResults(true)
        }

        // Check token requirements and get actual token balance for weighted voting
        if (voteDetails.tokenRequirement) {
          const tokenResult = await suivote.checkTokenBalance(
            wallet.address,
            voteDetails.tokenRequirement,
            voteDetails.tokenAmount?.toString() || "0"
          );
          hasRequiredTokens = tokenResult.hasBalance;
          // Store token balance for later use
          setTokenBalance(tokenResult.tokenBalance);
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

      setLoadingError(error instanceof Error ? error.message : "Failed to load vote data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial data fetch
    fetchVoteData()
    
    // Load transaction digest from localStorage if available
    const storedDigest = localStorage.getItem(`vote_${params.id}_txDigest`)
    if (storedDigest) {
      setTxDigest(storedDigest)
    }

    // Set up real-time updates subscription if we have a vote ID
    if (params.id) {
      // Subscribe to vote updates
      const unsubscribe = suivote.subscribeToVoteUpdates(params.id as string, async (updatedVoteDetails) => {
        // Update the vote state with the latest data
        setVote(updatedVoteDetails)

        // If showing results, update the UI accordingly
        if (showingResults || (updatedVoteDetails.showLiveStats)) {
          setShowingResults(true)

          try {
            // Get polls for the vote to update the UI with latest vote counts
            const pollsData = await suivote.getVotePolls(params.id as string)

            // Fetch options for each poll
            const pollsWithOptions = await Promise.all(
              pollsData.map(async (poll, index) => {
                // Get options for this poll (index + 1 because poll indices are 1-based)
                const options = await suivote.getPollOptions(params.id as string, index + 1)

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

            // Update the polls state with the latest data
            setPolls(pollsWithOptions || [])
          } catch (error) {
            console.error("Error updating polls data:", error)
          }
        }
      })

      // Clean up subscription when component unmounts or params change
      return () => {
        unsubscribe()
      }
    }
  }, [params.id, wallet.connected, wallet.address])

  // Auto-start timer effect - check every 30 seconds if vote should be auto-started
  useEffect(() => {
    if (!vote || !wallet.connected) return

    const checkAutoStart = async () => {
      const currentTime = Date.now()
      if (vote.status === "upcoming" && currentTime >= vote.startTimestamp && !vote.canBeStarted) {
        try {
          // Automatically start the vote
          const transaction = suivote.startVoteTransaction(params.id as string)
          const response = await suivote.executeTransaction(transaction)
          
          toast.success("Vote automatically started!", {
            description: "The vote is now active and ready to receive votes.",
            duration: 5000,
          })
          
          // Store transaction digest
          if (response && response.digest) {
            localStorage.setItem(`vote_${params.id}_txDigest`, response.digest)
          }
          
          // Refresh vote data to get updated status
          setTimeout(() => {
            fetchVoteData()
          }, 1000)
          
        } catch (error) {
          console.error("Error auto-starting vote:", error)
          // Update vote to show manual start option
          setVote(prev => prev ? { ...prev, canBeStarted: true } : null)
        }
      }
    }

    // Check immediately
    checkAutoStart()

    // Set up interval to check every 30 seconds
    const interval = setInterval(checkAutoStart, 30000)

    return () => clearInterval(interval)
  }, [vote, wallet.connected, params.id, suivote])

  // Function to handle starting a vote
  const handleStartVote = async () => {
    if (!vote || !wallet.connected) return

    try {
      setTxStatusDialogOpen(true)
      setTransactionError(null)
      setTxStatus(TransactionStatus.BUILDING)
      setTxProgress(20)

      // Create the transaction
      let transaction;
      try {
        transaction = suivote.startVoteTransaction(params.id as string)
      } catch (buildError) {
        setFailedStep(TransactionStatus.BUILDING);
        throw buildError;
      }

      // Update progress
      setTxStatus(TransactionStatus.SIGNING)
      setTxProgress(40)

      // Execute the transaction
      let response;
      try {
        response = await suivote.executeTransaction(transaction)
      } catch (signingError) {
        setFailedStep(TransactionStatus.SIGNING);
        throw signingError;
      }

      // Update progress
      setTxStatus(TransactionStatus.EXECUTING)
      setTxProgress(60)
      setTxDigest(response.digest)

      // Wait for confirmation
      setTxStatus(TransactionStatus.CONFIRMING)
      setTxProgress(80)

      try {
        // Simulate confirmation wait
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (confirmError) {
        setFailedStep(TransactionStatus.CONFIRMING);
        throw confirmError;
      }

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

  // Enhanced validation with detailed error messages and better UX
  const validateSelections = (selections: { [key: string]: string[] }, forceValidation = false) => {
    const validationErrors: { [key: string]: string } = {};
    let hasValidSelections = false;
    let hasRequiredSelections = true;
    let requiredPollsCount = 0;
    let completedRequiredPolls = 0;

    // Don't validate if user hasn't interacted yet, if we're still loading, or if user has already voted
    if (!hasUserInteracted || loading || polls.length === 0 || hasVoted) {
      return {};
    }

    // Check each poll for validation issues
    polls.forEach(poll => {
      const selectedOptions = selections[poll.id] || [];
      const shouldShowError = forceValidation || attemptedSubmit || touchedPolls[poll.id];

      // Count required polls
      if (poll.isRequired) {
        requiredPollsCount++;
      }

      // Check if required poll has selections (only show error if poll was touched or submit attempted)
      if (poll.isRequired && selectedOptions.length === 0 && shouldShowError) {
        validationErrors[poll.id] = `${poll.title} requires a response`;
        hasRequiredSelections = false;
      } else if (poll.isRequired && selectedOptions.length > 0) {
        completedRequiredPolls++;
      }

      // Validate selection count based on poll type (only show error if poll was touched or submit attempted)
      if (selectedOptions.length > 0 && shouldShowError) {
        if (!poll.isMultiSelect && selectedOptions.length > 1) {
          validationErrors[poll.id] = `${poll.title} allows only one selection`;
        } else if (poll.isMultiSelect && poll.maxSelections &&
          selectedOptions.length > poll.maxSelections) {
          validationErrors[poll.id] = `${poll.title}: Maximum ${poll.maxSelections} selections allowed`;
        } else if (poll.isMultiSelect && poll.minSelections &&
          selectedOptions.length < poll.minSelections) {
          validationErrors[poll.id] = `${poll.title}: Minimum ${poll.minSelections} selections required`;
        }
      }

      // Track if we have any valid selections
      if (selectedOptions.length > 0 && !validationErrors[poll.id]) {
        hasValidSelections = true;
      }
    });

    // Provide more specific error messages (only show if submit was attempted or user has interacted significantly)
    const shouldShowGeneralError = forceValidation || attemptedSubmit || Object.keys(touchedPolls).length > 0;

    if (hasUserInteracted && !hasValidSelections && shouldShowGeneralError) {
      if (requiredPollsCount > 0) {
        validationErrors.general = `Please complete ${requiredPollsCount} required poll${requiredPollsCount > 1 ? 's' : ''}`;
      } else {
        validationErrors.general = "Please make at least one selection to submit your vote";
      }
    }

    // Show progress for required polls (only if submit was attempted or multiple polls touched)
    if (hasUserInteracted && requiredPollsCount > 0 && completedRequiredPolls < requiredPollsCount && shouldShowGeneralError) {
      if (!validationErrors.general) {
        validationErrors.general = `Complete ${requiredPollsCount - completedRequiredPolls} more required poll${(requiredPollsCount - completedRequiredPolls) > 1 ? 's' : ''} (${completedRequiredPolls}/${requiredPollsCount})`;
      }
    }

    return validationErrors;
  };

  // Check if user can submit based on all validation conditions
  const canSubmitVote = () => {
    if (!wallet.connected || !wallet.address) return false;
    if (vote?.status !== "active") return false;
    if (hasVoted) return false;
    if (!userCanVote) return false;
    if (!hasUserInteracted) return false; // Must have interacted with the form

    // Check validation errors with force validation
    const currentErrors = validateSelections(selections, true);
    return Object.keys(currentErrors).length === 0;
  };

  // Validate whenever selections change (but only after user interaction)
  useEffect(() => {
    // Skip validation if user has already voted
    if (hasVoted) {
      setValidationErrors({});
      return;
    }

    if (polls.length > 0 && hasUserInteracted && !loading) {
      const errors = validateSelections(selections);
      setValidationErrors(errors);
    }
  }, [selections, polls, hasUserInteracted, loading, touchedPolls, attemptedSubmit, hasVoted]);

  // Handle option selection
  const handleOptionSelect = (pollId: string, optionId: string, isMultiSelect: boolean) => {
    // Mark that user has interacted with the form
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    // Mark this poll as touched
    setTouchedPolls(prev => ({
      ...prev,
      [pollId]: true
    }));

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
            toast.info(`You can select up to ${poll?.maxSelections} options for this poll`, {
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

    // Smart error clearing - trigger validation with delay to allow state updates
    setTimeout(() => {
      setValidationErrors(prev => {
        // Get current selections and validate
        const currentSelections = { ...selections };
        if (isMultiSelect) {
          const currentOptions = currentSelections[pollId] || [];
          if (currentOptions.includes(optionId)) {
            currentSelections[pollId] = currentOptions.filter(id => id !== optionId);
          } else {
            const poll = polls.find(p => p.id === pollId);
            if (poll && currentOptions.length < poll.maxSelections) {
              currentSelections[pollId] = [...currentOptions, optionId];
            }
          }
        } else {
          currentSelections[pollId] = [optionId];
        }

        return validateSelections(currentSelections);
      });
    }, 300);
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
      newErrors.tokens = `You need at least ${formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)} to vote`
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
   * Enhanced vote submission with comprehensive validation and error handling
   */
  const handleSubmitVote = async () => {
    try {
      // Set UI state to submitting
      setSubmitting(true);
      setTxStatusDialogOpen(true);
      setTransactionError(null);
      setTxStatus(TransactionStatus.BUILDING);
      setTxProgress(10);

      // STEP 1: Pre-flight checks
      if (!wallet || !wallet.address) {
        throw new Error("Please connect your wallet to vote");
      }

      if (!vote) {
        throw new Error("Vote data not loaded. Please refresh the page.");
      }

      if (vote.status !== "active") {
        throw new Error(vote.status === "upcoming" ? "This vote has not started yet" : "This vote has ended");
      }

      if (hasVoted) {
        throw new Error("You have already voted in this poll");
      }

      if (!userCanVote) {
        throw new Error("You are not eligible to vote in this poll");
      }

      // STEP 2: Comprehensive validation
      setTxProgress(20);
      const validationErrors = validateSelections(selections);

      if (Object.keys(validationErrors).length > 0) {
        console.error("[Vote Debug] Validation errors:", validationErrors);
        setValidationErrors(validationErrors);

        // Show the first validation error in a toast
        const firstError = validationErrors.general || Object.values(validationErrors)[0];
        toast.error("Validation Error", {
          description: firstError,
          duration: 5000,
        });

        throw new Error("Please fix the validation errors before submitting");
      }

      // STEP 3: Token balance verification for weighted voting
      setTxProgress(30);
      if (vote.tokenRequirement && !userHasRequiredTokens) {
        throw new Error(`You need at least ${formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)} to vote`);
      }
      // STEP 4: Prepare transaction data
      setTxProgress(40);
      const pollIndices = [];
      const optionIndicesPerPoll = [];
      let processedPolls = 0;

      // Process each poll with selections
      polls.forEach((poll, pollIdx) => {
        const selectedOptionIds = selections[poll.id] || [];

        // Skip polls with no selections
        if (selectedOptionIds.length === 0) {
          return;
        }

        // Map option IDs to indices for the smart contract
        const optionIndices = [];
        selectedOptionIds.forEach(optionId => {
          const optionIndex = poll.options.findIndex(option => option.id === optionId);
          if (optionIndex !== -1) {
            optionIndices.push(optionIndex + 1); // 1-based indexing for smart contract
          }
        });

        if (optionIndices.length === selectedOptionIds.length) {
          pollIndices.push(pollIdx + 1); // 1-based poll index
          optionIndicesPerPoll.push(optionIndices);
          processedPolls++;
        } else {
          console.warn(`[Vote Debug] Option mapping failed for poll: ${poll.title}`);
        }
      });

      if (pollIndices.length === 0) {
        throw new Error("Error processing your selections. Please try again.");
      }

      // STEP 5: Get token balance for weighted voting
      setTxProgress(50);
      let tokenBalance = 0;
      if (vote.tokenRequirement) {
        try {
          console.log("[Vote Debug] Checking token balance for:", {
            address: wallet.address,
            tokenRequirement: vote.tokenRequirement,
            tokenAmount: vote.tokenAmount
          });
          
          const tokenResult = await suivote.checkTokenBalance(
            wallet.address,
            vote.tokenRequirement,
            vote.tokenAmount
          );
          
          console.log("[Vote Debug] Token balance result:", tokenResult);
          
          tokenBalance = Math.floor(Number(tokenResult.tokenBalance));
          
          console.log("[Vote Debug] Final tokenBalance for transaction:", {
            original: tokenResult.tokenBalance,
            processed: tokenBalance,
            type: typeof tokenBalance
          });
          
        } catch (tokenError) {
          console.warn("[Vote Debug] Error checking token balance:", tokenError);
          // Continue with 0 balance for non-weighted voting
        }
      } else {
        console.log("[Vote Debug] No token requirement, using tokenBalance = 0");
      }

      // STEP 6: Create and execute transaction
      setTxStatus(TransactionStatus.BUILDING);
      setTxProgress(60);

      console.log("[Vote Debug] Creating transaction with:", {
        voteId: params.id,
        pollIndices,
        optionIndicesPerPoll,
        tokenBalance,
        paymentAmount: vote.paymentAmount || 0,
        singleVote: pollIndices.length === 1
      });

      let transaction;
      if (pollIndices.length === 1) {
        transaction = await suivote.castVoteTransaction(
          params.id,
          pollIndices[0],
          optionIndicesPerPoll[0],
          tokenBalance,
          vote.paymentAmount || 0
        );
      } else {
        transaction = await suivote.castMultipleVotesTransaction(
          params.id,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          vote.paymentAmount || 0
        );
      }

      // STEP 7: Sign and execute transaction
      setTxStatus(TransactionStatus.SIGNING);
      setTxProgress(70);

      toast.info("Please sign the transaction in your wallet", {
        description: `Submitting votes for ${processedPolls} poll${processedPolls > 1 ? 's' : ''}`,
        duration: 3000,
      });

      let response;
      try {
        response = await suivote.executeTransaction(transaction);
      } catch (signingError) {
        setFailedStep(TransactionStatus.SIGNING);
        throw signingError;
      }

      // STEP 8: Transaction execution
      setTxStatus(TransactionStatus.EXECUTING);
      setTxProgress(80);
      setTxDigest(response.digest);

      toast.success("Transaction submitted!", {
        description: "Waiting for blockchain confirmation...",
        duration: 3000,
      });

      // STEP 9: Wait for confirmation
      setTxStatus(TransactionStatus.CONFIRMING);
      setTxProgress(90);

      try {
        // Simulate confirmation wait
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (confirmError) {
        setFailedStep(TransactionStatus.CONFIRMING);
        throw confirmError;
      }

      // STEP 10: Success handling
      setTxStatus(TransactionStatus.SUCCESS);
      setTxProgress(100);

      // Update local state immediately
      console.log("Setting hasVoted to true after successful vote");
      setSubmitted(true);
      setHasVoted(true);
      console.log("hasVoted state updated to true");

      // Store transaction data
      if (response?.digest) {
        setTxDigest(response.digest);
        localStorage.setItem(`vote_${params.id}_txDigest`, response.digest);
        localStorage.setItem(`vote_${params.id}_timestamp`, Date.now().toString());
      }

      // Success notification with details
      toast.success("Vote submitted successfully!", {
        description: `Your vote${processedPolls > 1 ? 's' : ''} ${processedPolls > 1 ? 'have' : 'has'} been recorded on the blockchain.`,
        duration: 5000,
      });

      // Handle post-submission flow
      setTimeout(() => {
        setTxStatus(TransactionStatus.IDLE);
        setTxStatusDialogOpen(false);

        if (vote?.showLiveStats) {
          // Show live results on the same page
          setShowingResults(true);
        }
        
        // Refresh vote data to update the component state after a longer delay
        // This allows blockchain propagation while preserving the correct hasVoted state
        setTimeout(() => {
          fetchVoteData();
        }, 5000); // Wait 5 seconds for blockchain propagation
      }, 2000);

    } catch (error) {
      console.error("[Vote Debug] Transaction failed:", error instanceof Error ? error.message : String(error));

      // Update UI state
      setTxStatus(TransactionStatus.ERROR);
      setTxProgress(100);

      // Determine error type and provide appropriate feedback
      let errorMessage = "An unexpected error occurred";
      let errorDescription = "Please try again or contact support if the issue persists";

      if (error.message) {
        errorMessage = error.message;

        // Provide specific guidance for common errors
        if (error.message.includes("User rejected") || error.message.includes("rejected")) {
          errorMessage = "Transaction cancelled";
          errorDescription = "You cancelled the transaction in your wallet";
        } else if (error.message.includes("insufficient")) {
          errorMessage = "Insufficient funds";
          errorDescription = "You don't have enough SUI to pay for transaction fees";
        } else if (error.message.includes("network") || error.message.includes("connection")) {
          errorMessage = "Network error";
          errorDescription = "Please check your internet connection and try again";
        } else if (error.message.includes("already voted")) {
          errorMessage = "Already voted";
          errorDescription = "You have already submitted your vote for this poll";
        } else if (error.message.includes("not eligible")) {
          errorMessage = "Not eligible to vote";
          errorDescription = "You don't meet the requirements to vote in this poll";
        }
      }

      setTransactionError(errorMessage);

      // Show error toast with actionable information
      toast.error(errorMessage, {
        description: errorDescription,
        duration: 7000,
      });

      // Store error information for display
      setSubmitting(false);

      // Keep dialog open for user to see error details or retry
      // User can manually close it or try again
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

  // Function to detect URLs in text and convert them to clickable links
  const formatTextWithLinks = (text) => {
    if (!text) return [text]

    // Simple and reliable URL regex
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.(?:com|org|net|edu|gov|io|co|uk|de|fr|jp|cn|app|dev|tech|info|biz|me|xyz|link|ai|ml|tv|cc|to|ca|au|in|br|ru|int|mil)(?:\/[^\s]*)?)/gi

    const parts = []
    let lastIndex = 0
    let match
    let linkIndex = 0

    // Reset regex lastIndex to ensure it starts from beginning
    urlRegex.lastIndex = 0

    // Find all URL matches
    while ((match = urlRegex.exec(text)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index)
        if (textBefore) {
          parts.push(<span key={`text-before-${linkIndex}`}>{textBefore}</span>)
        }
      }

      // Get the matched URL (could be from any of the 3 capture groups)
      const matchedUrl = match[1] || match[2] || match[3]

      if (matchedUrl) {
        // Ensure URL has protocol
        let fullUrl = matchedUrl
        if (!matchedUrl.startsWith('http://') && !matchedUrl.startsWith('https://')) {
          fullUrl = `https://${matchedUrl}`
        }

        parts.push(
          <a
            key={`url-${linkIndex}`}
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 hover:underline transition-colors duration-200 font-medium inline-flex items-center gap-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
            }}
            style={{ pointerEvents: 'auto' }} // Explicitly enable pointer events
          >
            {matchedUrl}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        )
      }

      lastIndex = match.index + match[0].length
      linkIndex++
    }

    // Add remaining text after the last URL
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex)
      if (remainingText) {
        parts.push(<span key={`text-after-${linkIndex}`}>{remainingText}</span>)
      }
    }

    // If no URLs were found, return the original text wrapped in span
    return parts.length > 0 ? parts : [<span key="no-urls">{text}</span>]
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
    return <VoteDetailSkeleton />
  }

  // Error state
  if (loadingError || !vote) {
    return (
      <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Vote</AlertTitle>
          <AlertDescription>
            {loadingError || "Failed to load vote data. Please try again later."}
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
                  {formatTextWithLinks(vote.description)}
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

              {Date.now() >= vote.startTimestamp && vote.canBeStarted && wallet.connected ? (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle>Vote Ready to Start</AlertTitle>
                    <AlertDescription>
                      Auto-start failed. Please start the vote manually or refresh the page.
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
              ) : Date.now() >= vote.startTimestamp && !wallet.connected ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle>Vote Starting Automatically</AlertTitle>
                  <AlertDescription>
                    This vote will start automatically when a connected wallet visits this page.
                  </AlertDescription>
                </Alert>
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
                        Minimum {formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)}
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
                      <p className="text-xs text-muted-foreground">{formatTokenAmount(vote.paymentAmount, "SUI")} to vote</p>
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
                      {poll.description && <CardDescription className="mt-1">{formatTextWithLinks(poll.description)}</CardDescription>}
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
                      } catch (error) {
                        console.warn(`[Poll Preview] Option mapping verification failed for poll: ${poll.title}`, error);
                      }

                      return poll.options.slice(0, 3).map((option, optionIndex) => {
                        // Log option mapping info for preview

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
                              {formatTextWithLinks(option.text)}
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



  // Check if we should show success state
  // Note: vote.status can be 'voted' when user has voted, not just 'active'
  const shouldShowSuccess = hasVoted && !vote.showLiveStats && (vote.status === "active" || vote.status === "voted")
  
  // Check if we should show closed state
  const shouldShowClosed = vote.status === "closed"

  // Show success component
  if (shouldShowSuccess) {
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

        <VoteSuccess 
          vote={vote} 
          txDigest={txDigest}
          onShare={handleShare}
        />

        {/* Share dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          title={vote.title}
          url={typeof window !== "undefined" ? window.location.href : ""}
        />

        {/* Transaction Status Dialog */}
        <TransactionStatusDialog
          open={txStatusDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleDialogClose();
            } else {
              setTxStatusDialogOpen(open);
            }
          }}
          txStatus={txStatus}
          transactionError={transactionError}
          txDigest={txDigest}
          failedStep={failedStep}
          onRetry={() => {
            setFailedStep(undefined);
            handleTryAgain();
          }}
          explorerUrl={SUI_CONFIG.explorerUrl}
        />
      </div>
    )
  }

  // Show closed component
  if (shouldShowClosed) {
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

        <VoteClosed 
          vote={vote} 
          polls={polls}
          onShare={handleShare}
        />

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

  // Main vote page - handles cases:
  // 1. Vote is open and user has not voted
  // 2. Vote is open, user has voted, and live stats are enabled
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
                {formatTextWithLinks(vote.description)}
              </div>
            )}

            {/* Voting Period and Requirements Card - Only show when voting is active and user hasn't voted */}
            {(vote.status === "active" && !hasVoted) ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="mb-6"
              >
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    {/* Voting Period Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-200 dark:bg-blue-800 rounded-full">
                          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                            Voting Period
                          </h3>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            {vote.endTimestamp && (
                              <>Ends {formatDate(vote.endTimestamp)}</>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs font-medium">
                        Active
                      </Badge>
                    </div>

                    {/* Requirements - Compact Display */}
                    {(vote.tokenRequirement || vote.paymentAmount > 0 || vote.hasWhitelist) && (
                      <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                            Requirements:
                          </span>

                          {/* Token Requirement */}
                          {vote.tokenRequirement && (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs gap-1 cursor-pointer transition-all hover:scale-105",
                                  userHasRequiredTokens
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                                )}
                                onClick={() => toggleBadgeExpansion('tokenRequirement')}
                              >
                                <Wallet className="h-3 w-3" />
                                {formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)}
                                {wallet.connected && (
                                  userHasRequiredTokens ?
                                    <CheckCircle2 className="h-3 w-3" /> :
                                    <X className="h-3 w-3" />
                                )}
                                <Info className="h-3 w-3" />
                              </Badge>
                              <AnimatePresence>
                                {expandedBadges.tokenRequirement && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border"
                                  >
                                    {userHasRequiredTokens && wallet.connected
                                      ? `✅ You have enough ${vote.tokenRequirement.split("::").pop()} tokens to vote`
                                      : wallet.connected
                                        ? `❌ You need at least ${formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)} in your wallet to participate`
                                        : `You must hold at least ${formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)} to vote. Connect your wallet to check your balance.`
                                    }
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Payment Requirement */}
                          {vote.paymentAmount > 0 && (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className="text-xs gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 cursor-pointer transition-all hover:scale-105"
                                onClick={() => toggleBadgeExpansion('paymentRequirement')}
                              >
                                <Wallet className="h-3 w-3" />
                                {formatTokenAmount(vote.paymentAmount, "SUI")} 
                                <Info className="h-3 w-3" />
                              </Badge>
                              <AnimatePresence>
                                {expandedBadges.paymentRequirement && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border"
                                  >
                                    💰 A payment of {formatTokenAmount(vote.paymentAmount, "SUI")}  is required to submit your vote. This fee helps prevent spam and supports the voting system.
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Whitelist Requirement */}
                          {vote.hasWhitelist && (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs gap-1 cursor-pointer transition-all hover:scale-105",
                                  wallet.connected && userCanVote
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                                )}
                                onClick={() => toggleBadgeExpansion('whitelistRequirement')}
                              >
                                <Shield className="h-3 w-3" />
                                Whitelist
                                {wallet.connected && (
                                  userCanVote ?
                                    <CheckCircle2 className="h-3 w-3" /> :
                                    <AlertCircle className="h-3 w-3" />
                                )}
                                <Info className="h-3 w-3" />
                              </Badge>
                              <AnimatePresence>
                                {expandedBadges.whitelistRequirement && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border"
                                  >
                                    {wallet.connected && userCanVote
                                      ? "✅ Your wallet address is approved to participate in this vote"
                                      : wallet.connected
                                        ? "❌ Only pre-approved wallet addresses can vote. Your address is not on the whitelist."
                                        : "🛡️ This vote is restricted to pre-approved wallet addresses only. Connect your wallet to check if you're eligible."
                                    }
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Token Weighting Indicator */}
                          {vote.useTokenWeighting && (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className="text-xs gap-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 cursor-pointer transition-all hover:scale-105"
                                onClick={() => toggleBadgeExpansion('tokenWeighting')}
                              >
                                <BarChart2 className="h-3 w-3" />
                                Weighted
                                <Info className="h-3 w-3" />
                              </Badge>
                              <AnimatePresence>
                                {expandedBadges.tokenWeighting && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border"
                                  >
                                    📊 Your voting power is weighted by your token balance. More tokens = more influence on the final results.
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}

            {/* Main Status Alert - Only for important messages */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              {vote.status === "closed" ? (
                <Alert className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 shadow-sm rounded-lg">
                  <Lock className="h-4 w-4" />
                  <AlertTitle className="text-sm font-medium">This vote has ended</AlertTitle>
                  <AlertDescription className="text-sm">
                    {vote.showLiveStats ?
                      "The voting period has concluded. Results are available below." :
                      "The voting period has concluded. Results will be displayed when released by the creator."
                    }
                  </AlertDescription>
                </Alert>
              ) : hasVoted ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-sm rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle className="text-sm font-medium">Thank you for voting!</AlertTitle>
                  <AlertDescription className="text-sm">
                    {vote.showLiveStats ?
                      "Your vote has been recorded. Live results are shown below." :
                      "Your vote has been recorded. Results will be available when voting ends."
                    }
                  </AlertDescription>
                </Alert>
              ) : (
                vote.status === "active" && !wallet.connected && (
                  <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm rounded-lg">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="text-sm font-medium">Connect Wallet to Vote</AlertTitle>
                    <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                      <span>Connect your wallet to participate in this vote.</span>
                      <WalletConnectButton />
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
                validationErrors[polls[activePollIndex].id] && "border-red-500 ring-2 ring-red-500/20",
                !validationErrors[polls[activePollIndex].id] && polls[activePollIndex].isRequired && (!selections[polls[activePollIndex].id] || selections[polls[activePollIndex].id].length === 0) && "border-amber-500/50 ring-2 ring-amber-500/20",
                selections[polls[activePollIndex].id]?.length > 0 && !validationErrors[polls[activePollIndex].id] && "border-green-500/50 ring-2 ring-green-500/20"
              )}>
                <div className={cn(
                  "h-1.5 w-full",
                  validationErrors[polls[activePollIndex].id] ? "bg-red-500" :
                    polls[activePollIndex].isRequired && (!selections[polls[activePollIndex].id] || selections[polls[activePollIndex].id].length === 0) ? "bg-amber-500" :
                      selections[polls[activePollIndex].id]?.length > 0 ? "bg-green-500" : "bg-blue-500",
                )}></div>
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                    {polls[activePollIndex].title}
                    {validationErrors[polls[activePollIndex].id] && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    {!validationErrors[polls[activePollIndex].id] && selections[polls[activePollIndex].id]?.length > 0 && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
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


                      try {
                        verifyOptionMappings([currentPoll], selections);

                      } catch (error) {
                        console.warn(`[Option Listing] Option mapping verification failed for poll: ${currentPoll.title}`, error);
                      }

                      // Get mapped option indices for current selections (for debugging)
                      const currentSelections = selections[currentPoll.id] || [];
                      if (currentSelections.length > 0) {
                        try {
                          const mappedIndices = mapOptionIdsToIndices(currentPoll, currentSelections);

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
                                      <span className="flex-1">
                                        {formatTextWithLinks(option.text)}
                                      </span>
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
                                  <div className="flex-shrink-0 pt-0.5">
                                    <RadioGroupItem
                                      value={option.id}
                                      id={option.id}
                                      disabled={isDisabled}
                                      className="h-5 w-5"
                                    />
                                  </div>
                                  <div className="grid gap-1.5 leading-none w-full min-w-0">
                                    <Label
                                      htmlFor={option.id}
                                      className={cn("text-base font-normal cursor-pointer", isDisabled && "opacity-70")}
                                    >
                                      <span className="flex items-start gap-2">
                                        <span className="flex-1 break-words word-wrap overflow-wrap-anywhere">
                                          {formatTextWithLinks(option.text)}
                                        </span>
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
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
                              ? "scale-125 ring-2 ring-primary/20" : "",
                            // Color based on validation state
                            validationErrors[poll.id] ? "bg-red-500 ring-2 ring-red-500/30" :
                              selections[poll.id]?.length > 0 ? "bg-green-500 ring-2 ring-green-500/30" :
                                poll.isRequired ? "bg-amber-500 ring-2 ring-amber-500/30" :
                                  activePollIndex === index ? "bg-primary" : "bg-muted hover:bg-primary/50"
                          )} />
                          <span className={cn(
                            "text-xs transition-all",
                            activePollIndex === index ? "font-medium" : "group-hover:text-foreground",
                            // Text color based on validation state
                            validationErrors[poll.id] ? "text-red-500" :
                              selections[poll.id]?.length > 0 ? "text-green-600" :
                                poll.isRequired && (!selections[poll.id] || selections[poll.id].length === 0) ? "text-amber-600" :
                                  activePollIndex === index ? "text-primary" : "text-muted-foreground"
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
                validationErrors[poll.id] && "border-red-500 ring-2 ring-red-500/20",
                !validationErrors[poll.id] && poll.isRequired && (!selections[poll.id] || selections[poll.id].length === 0) && "border-amber-500/50 ring-2 ring-amber-500/20",
                selections[poll.id]?.length > 0 && !validationErrors[poll.id] && "border-green-500/50 ring-2 ring-green-500/20"
              )}
                onClick={() => {
                  setActivePollIndex(pollIndex)
                  setActiveTab("vote")
                }}
              >
                <div className={cn(
                  "h-1.5 w-full",
                  validationErrors[poll.id] ? "bg-red-500" :
                    poll.isRequired && (!selections[poll.id] || selections[poll.id].length === 0) ? "bg-amber-500" :
                      selections[poll.id]?.length > 0 ? "bg-green-500" : "bg-blue-500",
                )}></div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {pollIndex + 1}. {poll.title}
                        {validationErrors[poll.id] && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        {!validationErrors[poll.id] && selections[poll.id]?.length > 0 && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </CardTitle>
                      {poll.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {formatTextWithLinks(poll.description)}
                        </CardDescription>
                      )}
                      {validationErrors[poll.id] && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors[poll.id]}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {poll.isRequired && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            validationErrors[poll.id] ? "bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200" :
                              (!selections[poll.id] || selections[poll.id].length === 0) ? "bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200" :
                                "bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200"
                          )}
                        >
                          Required
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="space-y-3">
                    {(() => {
                      // Verify option mappings for this poll before rendering
                      try {
                        verifyOptionMappings([poll], selections);
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

                            return (
                              <div key={option.id} className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium line-clamp-1 flex items-center gap-2">
                                    <span className="flex-1">
                                      {formatTextWithLinks(option.text)}
                                    </span>
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
                                  {formatTextWithLinks(option.text)}
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

                    <div className="flex items-center gap-2">
                      {validationErrors[poll.id] ? (
                        <Badge variant="outline" className="bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      ) : selections[poll.id]?.length > 0 ? (
                        <Badge variant="outline" className="bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : poll.isRequired && vote.status === "active" && !hasVoted ? (
                        <Badge variant="outline" className="bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Required
                        </Badge>
                      ) : vote.status === "active" && !hasVoted ? (
                        <Badge variant="outline" className="bg-gray-100/50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
                          Optional
                        </Badge>
                      ) : null}

                      {/* Show selection count */}
                      {selections[poll.id]?.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {selections[poll.id].length} selected
                        </span>
                      )}
                    </div>
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
            className="mt-10 flex flex-col sm:flex-row justify-between items-center p-5 border border-muted/40 rounded-xl bg-muted/30 shadow-sm gap-4"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <p>
                {vote.requireAllPolls
                  ? "All polls must be answered to submit your vote."
                  : "Required polls must be answered to submit your vote."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {/* Show validation errors summary */}
              {Object.keys(validationErrors).length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {validationErrors.general ||
                      `${Object.keys(validationErrors).length} poll${Object.keys(validationErrors).length > 1 ? 's' : ''} need${Object.keys(validationErrors).length === 1 ? 's' : ''} attention`}
                  </span>
                  {activeTab === "polls" && Object.keys(validationErrors).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => {
                        // Navigate to the first poll with an error
                        const firstErrorPollId = Object.keys(validationErrors).find(key => key !== 'general');
                        if (firstErrorPollId) {
                          const pollIndex = polls.findIndex(poll => poll.id === firstErrorPollId);
                          if (pollIndex !== -1) {
                            setActivePollIndex(pollIndex);
                            setActiveTab("vote");
                          }
                        }
                      }}
                    >
                      Fix Issues
                    </Button>
                  )}
                </div>
              )}

              <Button
                onClick={() => {
                  // Mark that user attempted to submit
                  setAttemptedSubmit(true);

                  // Double-check validation before submission with force validation
                  if (!canSubmitVote()) {
                    const currentErrors = validateSelections(selections, true);
                    setValidationErrors(currentErrors);

                    // Navigate to first error if in "polls" view
                    if (activeTab === "polls" && Object.keys(currentErrors).length > 0) {
                      const firstErrorPollId = Object.keys(currentErrors).find(key => key !== 'general');
                      if (firstErrorPollId) {
                        const pollIndex = polls.findIndex(poll => poll.id === firstErrorPollId);
                        if (pollIndex !== -1) {
                          setActivePollIndex(pollIndex);
                          setActiveTab("vote");
                        }
                      }
                    }

                    toast.error("Please complete all required fields", {
                      description: "Review the highlighted errors and make your selections."
                    });
                    return;
                  }

                  handleSubmitVote();
                }}
                disabled={!canSubmitVote()}
                className="gap-2 bg-primary hover:bg-primary/90 transition-all duration-200 hover:shadow-md w-full sm:w-auto"
                size="lg"
              >
                {submitting ? (
                  <>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Submitting...
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Submit Vote
                  </>
                )}
              </Button>
            </div>
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
      <TransactionStatusDialog
        open={txStatusDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose();
          } else {
            setTxStatusDialogOpen(open);
          }
        }}
        txStatus={txStatus}
        transactionError={transactionError}
        txDigest={txDigest}
        failedStep={failedStep}
        onRetry={() => {
          setFailedStep(undefined);
          handleTryAgain();
        }}
        explorerUrl={SUI_CONFIG.explorerUrl}
      />
    </div>
  )
}