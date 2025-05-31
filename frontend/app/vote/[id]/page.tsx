"use client"

import { useState, useEffect, useCallback, ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@suiet/wallet-kit"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { TransactionStatusDialog, TransactionStatus } from "@/components/transaction-status-dialog"

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
import { LoadingButton } from "@/components/ui/loading-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShareDialog } from "@/components/share-dialog"
import { WalletConnectButton } from "@/components/wallet-connect-button"
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
  const [hasUserInteracted, setHasUserInteracted] = useState(false) // Track if user has made any selections
  const [loadingError, setLoadingError] = useState(null) // Separate loading errors from validation errors

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

  
  // Transaction state
  const [txStatus, setTxStatus] = useState(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState(null)
  const [txProgress, setTxProgress] = useState(0)

  // State to track selections for each poll
  const [selections, setSelections] = useState({})

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

      // If the vote is closed, redirect to the closed page
      // Only redirect if showLiveStats is false
      if (voteDetails.status === "closed" && !voteDetails?.showLiveStats) {
        setLoading(false)
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
          setLoading(false)
          router.push(`/vote/${params.id}/success`)
          return
        }

        // If vote is open, user has voted, and live stats are enabled, show results
        if (votedStatus && voteDetails?.showLiveStats) {
          setShowingResults(true)
        }

        // Check token requirements and get actual token balance for weighted voting
        if (voteDetails.tokenRequirement) {
          const tokenResult = await suivote.checkTokenBalance(
            wallet.address,
            voteDetails.tokenRequirement,
            voteDetails.tokenAmount
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
    
    // Set up real-time updates subscription if we have a vote ID
    if (params.id) {
      // Subscribe to vote updates
      const unsubscribe = suivote.subscribeToVoteUpdates(params.id as string, (updatedVoteDetails) => {
        // Update the vote state with the latest data
        setVote(updatedVoteDetails)
        
        // If showing results, update the UI accordingly
        if (showingResults || (updatedVoteDetails.showLiveStats)) {
          setShowingResults(true)
        }
      })
      
      // Clean up subscription when component unmounts or params change
      return () => {
        unsubscribe()
      }
    }
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

  // Validate selections and update validation errors in real-time
  const validateSelections = (selections) => {
    const validationErrors = {};
    let hasValidSelections = false;
    let hasRequiredSelections = true;

    // Don't validate if user hasn't interacted yet or if we're still loading
    if (!hasUserInteracted || loading || polls.length === 0) {
      return {};
    }

    // Check each poll for validation issues
    polls.forEach(poll => {
      const selectedOptions = selections[poll.id] || [];

      // Check if required poll has selections
      if (poll.isRequired && selectedOptions.length === 0) {
        validationErrors[poll.id] = "This poll requires a response";
        hasRequiredSelections = false;
      }

      // Validate selection count based on poll type
      if (selectedOptions.length > 0) {
        if (!poll.isMultiSelect && selectedOptions.length > 1) {
          validationErrors[poll.id] = "This poll allows only one selection";
        } else if (poll.isMultiSelect && poll.maxSelections &&
          selectedOptions.length > poll.maxSelections) {
          validationErrors[poll.id] = `Maximum ${poll.maxSelections} selections allowed`;
        }
      }

      // Track if we have any valid selections
      if (selectedOptions.length > 0 && !validationErrors[poll.id]) {
        hasValidSelections = true;
      }
    });

    // Only show "make at least one selection" if user has interacted but made no selections
    if (hasUserInteracted && !hasValidSelections) {
      validationErrors.general = "Please make at least one selection";
    }

    // All required polls must have selections (only if user has interacted)
    if (hasUserInteracted && !hasRequiredSelections) {
      if (!validationErrors.general) {
        validationErrors.general = "Please complete all required polls";
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
    
    // Check validation errors
    const currentErrors = validateSelections(selections);
    return Object.keys(currentErrors).length === 0;
  };

  // Validate whenever selections change (but only after user interaction)
  useEffect(() => {
    if (polls.length > 0 && hasUserInteracted && !loading) {
      const errors = validateSelections(selections);
      setValidationErrors(errors);
    }
  }, [selections, polls, hasUserInteracted, loading]);

  // Handle option selection
  const handleOptionSelect = (pollId, optionId, isMultiSelect) => {
    // Mark that user has interacted with the form
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

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

    // Clear any existing validation error for this poll
    if (validationErrors[pollId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[pollId]
        // Also clear general error if it exists and we now have selections
        if (newErrors.general) {
          delete newErrors.general
        }
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

      
      // STEP 1: Validate wallet is connected
      if (!wallet || !wallet.address) {
        console.error("[Vote Debug] Wallet not connected");
        setTransactionError("Please connect your wallet to vote");
        setTxStatus(TransactionStatus.ERROR);
        setSubmitting(false);
        return;
      }

      // STEP 2: Validate all poll selections using our validation function
      const validationErrors = validateSelections(selections);
      
      // If there are validation errors, stop submission
      if (Object.keys(validationErrors).length > 0) {
        console.error("[Vote Debug] Validation errors:", validationErrors);
        setValidationErrors(validationErrors);
        setTxStatus(TransactionStatus.ERROR);
        setSubmitting(false);
        return;
      }
      
      let hasValidSelections = true; // We've already validated

      // We've already validated with validateSelections, so we can skip the redundant validation

      // We've already validated and confirmed there are no errors, so we can proceed

      // STEP 2.5: ISSUE 2 SOLUTION - Verify option mappings before proceeding
      
      verifyOptionMappings(polls, selections);

      // STEP 3: Prepare data for transaction
      // Arrays to store poll indices (1-based) and options
      const pollIndices = [];
      const optionIndicesPerPoll = [];

      
      // For each poll in this vote
      polls.forEach((poll, pollIdx) => {
        // Get the user's selections for this poll (if any)
        const selectedOptionIds = selections[poll.id] || [];

        // Skip polls with no selections
        if (selectedOptionIds.length === 0) {
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
      try {
        const tokenResult = await suivote.checkTokenBalance(
          wallet.address,
          vote.tokenRequirement,
          vote.tokenAmount
        );
        tokenBalance =  Math.floor(Number(tokenResult.tokenBalance));
       } catch (tokenError) {
        console.error("[Vote Debug] Error checking token balance:", tokenError);
        // Default to 0 balance on error
      }
      

      // STEP 5: Create the transaction
      setTxStatus(TransactionStatus.BUILDING);

      // ISSUE 1 SOLUTION: Create a single batched transaction
      let transaction;

      
      
      // If only one poll, use simple vote transaction
      if (pollIndices.length === 1) {
         transaction = suivote.castVoteTransaction(
          params.id,
          pollIndices[0],
          optionIndicesPerPoll[0],
          tokenBalance,
          vote.paymentAmount || 0
        );
      } else {
        // If multiple polls, use batched transaction
        transaction = suivote.castMultipleVotesTransaction(
          params.id,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          vote.paymentAmount || 0
        );
      }

      // STEP 6: Execute the transaction
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
          // No need to manually call fetchVoteData() as the subscription will update the UI
          // The subscription will automatically refresh the data with the latest results
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
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs gap-1 cursor-help transition-all hover:scale-105",
                                userHasRequiredTokens 
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400" 
                                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                              )}
                              title={
                                userHasRequiredTokens && wallet.connected
                                  ? `✅ You have enough ${vote.tokenRequirement.split("::").pop()} tokens to vote`
                                  : wallet.connected
                                  ? `❌ You need at least ${vote.tokenAmount} ${vote.tokenRequirement.split("::").pop()} tokens in your wallet to participate`
                                  : `You must hold at least ${vote.tokenAmount} ${vote.tokenRequirement.split("::").pop()} tokens to vote. Connect your wallet to check your balance.`
                              }
                            >
                              <Wallet className="h-3 w-3" />
                              {vote.tokenAmount} {vote.tokenRequirement.split("::").pop()}
                              {wallet.connected && (
                                userHasRequiredTokens ? 
                                  <CheckCircle2 className="h-3 w-3" /> : 
                                  <X className="h-3 w-3" />
                              )}
                            </Badge>
                          )}

                          {/* Payment Requirement */}
                          {vote.paymentAmount > 0 && (
                            <Badge 
                              variant="outline" 
                              className="text-xs gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 cursor-help transition-all hover:scale-105"
                              title={`💰 A payment of ${vote.paymentAmount / 1000000000} SUI is required to submit your vote. This fee helps prevent spam and supports the voting system.`}
                            >
                              <Wallet className="h-3 w-3" />
                              {vote.paymentAmount / 1000000000} SUI
                            </Badge>
                          )}

                          {/* Whitelist Requirement */}
                          {vote.hasWhitelist && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs gap-1 cursor-help transition-all hover:scale-105",
                                wallet.connected && userCanVote
                                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                              )}
                              title={
                                wallet.connected && userCanVote
                                  ? "✅ Your wallet address is approved to participate in this vote"
                                  : wallet.connected
                                  ? "❌ Only pre-approved wallet addresses can vote. Your address is not on the whitelist."
                                  : "🛡️ This vote is restricted to pre-approved wallet addresses only. Connect your wallet to check if you're eligible."
                              }
                            >
                              <Shield className="h-3 w-3" />
                              Whitelist
                              {wallet.connected && (
                                userCanVote ? 
                                  <CheckCircle2 className="h-3 w-3" /> : 
                                  <AlertCircle className="h-3 w-3" />
                              )}
                            </Badge>
                          )}

                          {/* Token Weighting Indicator */}
                          {vote.useTokenWeighting && (
                            <Badge 
                              variant="outline" 
                              className="text-xs gap-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 cursor-help transition-all hover:scale-105"
                              title="📊 Your voting power is weighted by your token balance. More tokens = more influence on the final results."
                            >
                              <BarChart2 className="h-3 w-3" />
                              Weighted
                            </Badge>
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

              <LoadingButton
                onClick={() => {
                  // Double-check validation before submission
                  if (!canSubmitVote()) {
                    const currentErrors = validateSelections(selections);
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
                isLoading={submitting}
                loadingText="Submitting..."
                className="gap-2 bg-primary hover:bg-primary/90 transition-all duration-200 hover:shadow-md w-full sm:w-auto"
                size="lg"
              >
                <CheckCircle2 className="h-4 w-4" />
                Submit Vote
              </LoadingButton>
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
        onRetry={handleTryAgain}
        explorerUrl={SUI_CONFIG.explorerUrl}
      />
    </div>
  )
}