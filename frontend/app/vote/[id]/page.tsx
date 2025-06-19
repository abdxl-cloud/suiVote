"use client"

import { useState, useEffect, useCallback, ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { TransactionStatusDialog, TransactionStatus } from "@/components/transaction-status-dialog"
import { formatTokenAmount, fromDecimalUnits, toDecimalUnits } from "@/utils/token-utils"
import { VoteDetails, PollDetails, PollOptionDetails } from "@/services/suivote-service"
import { SUI_CONFIG } from "@/config/sui-config"

// Local interfaces for component props
interface LocalVoteDetails {
  id: string
  title: string
  description?: string
  status: 'active' | 'upcoming' | 'ended' | 'closed'
  totalVotes: number
  pollsCount?: number
  endTimestamp?: number
  showLiveStats?: boolean
  creator?: string
  creatorName?: string
}

interface LocalPollOption {
  id: string
  text: string
  votes: number
  percentage: number
}

interface LocalPoll {
  id: string
  title: string
  description?: string
  options: LocalPollOption[]
  totalVotes: number
  isRequired: boolean
  isMultiSelect: boolean
  maxSelections?: number
  minSelections?: number
}

type ExtendedPollDetails = PollDetails & {
  options: (PollOptionDetails & { percentage: number })[]
  totalVotes: number
}
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

  HelpCircle,
  Wifi,
  X,
  RefreshCw,
  Coins
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
  const [polls, setPolls] = useState<ExtendedPollDetails[]>([])
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
  const [userHasRequiredTokens, setUserHasRequiredTokens] = useState(false)
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false) // Track if user has made any selections
  const [loadingError, setLoadingError] = useState<string | null>(null) // Separate loading errors from validation errors
  const [expandedBadges, setExpandedBadges] = useState<{ [key: string]: boolean }>({}) // Track which badge info is expanded
  const [walletStateStable, setWalletStateStable] = useState(false) // Track if wallet state is stable

  // Smart validation states
  const [touchedPolls, setTouchedPolls] = useState<{ [key: string]: boolean }>({})
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  // Payment weighting states
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [calculatedVoteWeight, setCalculatedVoteWeight] = useState<number>(1)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // Whitelist weighting states
  const [userWhitelistWeight, setUserWhitelistWeight] = useState<number>(1)

  // Fetch user balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet.address || !wallet.connected) {
        setUserBalance(0);
        return;
      }

      setBalanceLoading(true);
      try {
        const balance = await suivote.getSuiBalance(wallet.address);
        setUserBalance(balance);
      } catch (error) {
        setUserBalance(0);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [wallet.address, wallet.connected]);

  // Fetch user whitelist weight when wallet is connected and vote has whitelist
  useEffect(() => {
    const fetchWhitelistWeight = async () => {
      if (wallet.address && vote?.id && vote?.hasWhitelist) {
        try {
          const weight = await suivote.getWhitelistWeight(vote.id, wallet.address);
          setUserWhitelistWeight(weight);
        } catch (error) {
          console.error('Error fetching whitelist weight:', error);
          setUserWhitelistWeight(0);
        }
      } else {
        setUserWhitelistWeight(0);
      }
    };

    fetchWhitelistWeight();
  }, [wallet.address, vote?.id, vote?.hasWhitelist]);

  // Calculate vote weight and validate payment with improved consistency
  useEffect(() => {
    if (!vote) return;
    let weight = 1;
    let error: string | null = null;

    // Whitelist weighting (if applicable)
    if (vote.hasWhitelist && userWhitelistWeight > 1) {
      weight = weight * userWhitelistWeight;
    }

    // Enhanced payment validation with consistent decimal handling
    if (vote.usePaymentWeighting) {
      const paymentAmountNum = parseFloat(paymentAmount.toString());
      const userBalanceSui = Number(fromDecimalUnits(userBalance, 9));
      const minPaymentSui = (vote.tokensPerVote && Number(vote.tokensPerVote) > 0) ? Number(fromDecimalUnits(vote.tokensPerVote, 9)) : 0;

      const paymentAmountMist = parseFloat(paymentAmount.toString()) * 1000000000; // Convert SUI to MIST
      const paymentTokenWeight = Number(vote.paymentTokenWeight || 0);
      weight = (vote.paymentTokenWeight && paymentTokenWeight > 0) ? Math.floor(paymentAmountMist / Number(toDecimalUnits(paymentTokenWeight, 9))) : 1;
      console.log("calculating weight", tokenBalance, vote.tokensPerVote || 0, "payment in MIST:", paymentAmountMist);

      // Add fallback for minimum weight
      if (weight === 0 && tokenBalance && tokenBalance >= Number(paymentTokenWeight)) {
        weight = 1;
      }

      if (isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
        error = "Please enter a valid payment amount greater than 0";
      } else if (paymentAmountNum > userBalanceSui) {
        error = `Insufficient balance. You have ${userBalanceSui.toFixed(3)} SUI available`;
      } else if (vote.tokensPerVote && Number(vote.tokensPerVote) > 0 && paymentAmountNum < minPaymentSui) {
        error = `Minimum payment is ${minPaymentSui.toFixed(3)} SUI for 1x vote weight`;
      } else if (paymentAmountNum > 1000) {
        // For payment weighting, use a practical maximum limit instead of paymentAmount
        error = `Maximum payment is 1000 SUI (practical limit)`;
      }
    } else if (vote.paymentAmount && Number(vote.paymentAmount) > 0) {
      // Fixed payment validation with consistent decimal handling
      const requiredPaymentSui = Number(fromDecimalUnits(vote.paymentAmount, 9));
      const userBalanceSui = Number(fromDecimalUnits(userBalance, 9));

      if (userBalanceSui < requiredPaymentSui) {
        error = `Insufficient balance. Required: ${requiredPaymentSui.toFixed(3)} SUI, Available: ${userBalanceSui.toFixed(3)} SUI`;
      }
    }

    setCalculatedVoteWeight(weight);
    setPaymentError(error);
  }, [vote, paymentAmount, userBalance, tokenBalance, userWhitelistWeight]);

  // Initialize payment amount when vote loads with consistent decimal handling
  useEffect(() => {
    if (!vote) return;

    if (vote.usePaymentWeighting && vote.paymentTokenWeight) {
      // Set default payment to minimum for 1 vote weight (convert from MIST to SUI)
      const minPaymentSui = Number(vote.paymentTokenWeight);
      setPaymentAmount(minPaymentSui);
    } else if (vote.paymentAmount && Number(vote.paymentAmount) > 0) {
      // Set to required fixed payment (convert from MIST to SUI)
      const requiredPaymentSui = Number(fromDecimalUnits(vote.paymentAmount, 9));
      setPaymentAmount(requiredPaymentSui);
    }
  }, [vote]);

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
      return { days: 0, hours: 0, minutes: 0, seconds: 0, hasStarted: true };
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
      const newTime = calculateTimeRemaining(vote.startTimestamp || 0);

      if (newTime.hasStarted) {
        // If time has come, clear the timer and update time remaining
        clearInterval(timer);
        setTimeRemaining(newTime);
        
        // The auto-transition effect will handle the status update and toast
      } else {
        setTimeRemaining(newTime);
      }
    }, 1000); // Update every second for accurate countdown

    return () => clearInterval(timer);
  }, [vote?.status, vote?.startTimestamp]);


  // Transaction state
  const [txStatus, setTxStatus] = useState(TransactionStatus.IDLE);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [txProgress, setTxProgress] = useState(0);
  const [failedStep, setFailedStep] = useState<TransactionStatus | undefined>(undefined);

  // State to track selections for each poll
  const [selections, setSelections] = useState<{ [key: string]: string[] }>({});

  // Transaction dialog state
  const [txStatusDialogOpen, setTxStatusDialogOpen] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  // Using the reusable TransactionStatusDialog component
  const handleDialogClose = () => {
    // Only allow closing the dialog if transaction is complete or failed
    if (txStatus === TransactionStatus.SUCCESS || txStatus === TransactionStatus.ERROR) {
      // Reset transaction status to prevent reopening
      setTxStatus(TransactionStatus.IDLE);
      // Explicitly close the dialog
      setTxStatusDialogOpen(false);
      // If transaction was successful, refresh the vote data
      if (txStatus === TransactionStatus.SUCCESS) {
        // Only fetch if wallet state is stable to prevent race conditions
        if (walletStateStable) {
          fetchVoteData();
        }
      }
    }
  };

  const handleCloseTxStatusDialog = () => {
    setTxStatusDialogOpen(false);
    if (txStatus === TransactionStatus.SUCCESS) {
      setTxStatus(TransactionStatus.IDLE);
      if (walletStateStable) {
        fetchVoteData();
      }
    }
  };

  const handleTryAgain = () => {
    setTxStatus(TransactionStatus.IDLE);
    setTransactionError(null);
    setTxProgress(0);
    handleSubmitVote();
  };

  // Add debouncing to prevent rapid successive calls
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchVoteData = async () => {
    // Prevent multiple simultaneous calls
    if (isRefreshing) {
      console.log('fetchVoteData already in progress, skipping...');
      return;
    }

    setIsRefreshing(true);
    try {
      console.log(walletStateStable)
      setLoading(true);
      setLoadingError(null);
      if (!params.id) {
        throw new Error("Vote ID is required");
      }

      // Get vote details
      const voteDetails = await suivote.getVoteDetails(Array.isArray(params.id) ? params.id[0] : params.id);
      if (!voteDetails) {
        throw new Error("Vote not found");
      }

      // Check whitelist access - if vote has whitelist and user is connected, verify access
      if (voteDetails.hasWhitelist) {
        // Ensure wallet state is stable before checking whitelist
        if (wallet.connected && wallet.address && walletStateStable) {
          try {
            const isWhitelisted = await suivote.isVoterWhitelisted(Array.isArray(params.id) ? params.id[0] : params.id, wallet.address);
            if (!isWhitelisted) {
              throw new Error("Access denied: You are not authorized to view this whitelisted vote");
            }
          } catch (whitelistError) {
            // If whitelist check fails due to network issues, allow retry
            console.warn("Whitelist check failed:", whitelistError);
            // Only throw access denied if it's a definitive authorization failure
            if (whitelistError instanceof Error && whitelistError.message.includes("not authorized")) {
              throw whitelistError;
            }
            // For other errors (network, etc.), log but don't block access immediately
            console.error("Whitelist verification error:", whitelistError);
          }
        } else if (!wallet.connected && walletStateStable) {
          // Only deny access if wallet state is stable and definitely not connected
          throw new Error("Access denied: Please connect your wallet to view this whitelisted vote");
        } else if (!walletStateStable) {
          // If wallet state is not stable, skip whitelist check for now
          // This prevents race condition errors during wallet connection/disconnection
          console.log("Skipping whitelist check - wallet state not stable");
          return; // Exit early, will retry when wallet state stabilizes
        }
        // If wallet.connected is true but wallet.address is null/undefined, 
        // this might be a temporary state during connection - don't throw error yet
      }

      // Note: Routing logic moved to polls page - users are now directed to appropriate pages from there

      // Handle automatic status transition for votes that should have started
      const currentTime = Date.now();
      if (voteDetails.status === "upcoming" && voteDetails.startTimestamp && currentTime >= voteDetails.startTimestamp) {
        // Update the vote status locally to 'active' since the start time has passed
        voteDetails.status = "active";
        
        toast.info("Vote has started!", {
          description: "The vote is now active and ready for participation.",
          duration: 3000,
        });
      }

      setVote(voteDetails);

      // Get polls for the vote
      const pollsData = await suivote.getVotePolls(Array.isArray(params.id) ? params.id[0] : params.id);

      // Fetch options for each poll
      const pollsWithOptions = await Promise.all(
        pollsData.map(async (poll, index) => {
          // Get options for this poll (index + 1 because poll indices are 1-based)
          const voteId = Array.isArray(params.id) ? params.id[0] : params.id;
          if (!voteId) throw new Error('Vote ID is required');
          const options = await suivote.getPollOptions(voteId, index + 1);

          // Calculate percentage for each option based on votes
          const totalVotesForPoll = options.reduce((sum, option) => sum + option.votes, 0);
          const optionsWithPercentage = options.map(option => ({
            ...option,
            percentage: totalVotesForPoll > 0 ? (option.votes / totalVotesForPoll) * 100 : 0
          }));

          return {
            ...poll,
            options: optionsWithPercentage || [],
            totalVotes: totalVotesForPoll
          };
        })
      );

      setPolls(pollsWithOptions || []);

      // Initialize selections
      const initialSelections: Record<string, string[]> = {};
      pollsWithOptions.forEach((poll) => {
        initialSelections[poll.id] = [];
      });
      setSelections(initialSelections);

      // Default values if wallet is not connected
      let votedStatus = false;
      let hasRequiredTokens = !voteDetails.tokenRequirement;
      let isWhitelisted = !voteDetails.hasWhitelist;

      // Check if user has already voted and meets requirements
      if (wallet.connected && wallet.address && walletStateStable) {
        // Check voting status - but preserve local state if user just voted
        const localVotedState = localStorage.getItem(`hasVoted_${Array.isArray(params.id) ? params.id[0] : params.id}_${wallet.address}`);
        const persistentHasVoted = localVotedState === 'true';
        if (!persistentHasVoted && !hasVoted) {
          votedStatus = await suivote.hasVoted(wallet.address, Array.isArray(params.id) ? params.id[0] : params.id);
          console.log("Blockchain hasVoted result:", votedStatus);
          setHasVoted(votedStatus);
          setSubmitted(votedStatus);
          // Store in localStorage for persistence
          if (votedStatus) {
            localStorage.setItem(`hasVoted_${Array.isArray(params.id) ? params.id[0] : params.id}_${wallet.address}`, 'true');
          }
        } else {
          // User has already voted according to local state or localStorage, keep it
          console.log("Preserving local hasVoted state - localStorage:", persistentHasVoted, "current state:", hasVoted);
          votedStatus = true;
          setHasVoted(true);
          setSubmitted(true);
        }
        if (votedStatus && voteDetails?.showLiveStats) {
          setShowingResults(true);
        }
        if (voteDetails.tokenRequirement) {
          console.log("tokenRequirement:", voteDetails.tokenRequirement, "tokenAmount:", voteDetails.tokenAmount);
          const tokenResult = await suivote.checkTokenBalance(
            wallet.address,
            voteDetails.tokenRequirement,
            Number(voteDetails.tokenAmount || 0)
          );
          hasRequiredTokens = tokenResult.hasBalance;
          console.log("checking token:", tokenResult.hasBalance, tokenResult.tokenBalance);
          // Store token balance for later use - convert to number
          setTokenBalance(Number(fromDecimalUnits(tokenResult.tokenBalance, 9)));
        } else {
          // No token requirement, so user has required tokens
          hasRequiredTokens = true;
        }

        if (voteDetails.hasWhitelist) {
          isWhitelisted = await suivote.isVoterWhitelisted(Array.isArray(params.id) ? params.id[0] : params.id, wallet.address);
          setIsWhitelisted(isWhitelisted);
        } else {
          // No whitelist requirement, so user is whitelisted
          isWhitelisted = true;
          setIsWhitelisted(true);
        }
      } else {
        // Wallet not connected - set default states
        setTokenBalance(null);
        setIsWhitelisted(!voteDetails.hasWhitelist);
      }

      // Update state with current token requirement status
      setUserHasRequiredTokens(hasRequiredTokens);

      // Set whether user can vote based on all conditions
      const canVote = wallet.connected &&
        wallet.address &&
        voteDetails.status === "active" &&
        !votedStatus &&
        isWhitelisted &&
        hasRequiredTokens;

      setUserCanVote(Boolean(canVote));

      // Update document title and metadata
      document.title = `${voteDetails.title} - SuiVote`;

      // Create meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", voteDetails.description || `Vote on ${voteDetails.title}`);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = voteDetails.description || `Vote on ${voteDetails.title}`;
        document.head.appendChild(meta);
      }

      // Create meta for social sharing
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute("content", `${voteDetails.title} - SuiVote`);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:title");
        meta.content = `${voteDetails.title} - SuiVote`;
        document.head.appendChild(meta);
      }

      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute("content", voteDetails.description || `Vote on ${voteDetails.title}`);
      } else {
        const meta = document.createElement("meta");
        meta.setAttribute("property", "og:description");
        meta.content = voteDetails.description || `Vote on ${voteDetails.title}`;
        document.head.appendChild(meta);
      }
    } catch (error) {
      console.error("Error fetching vote data:", error);
      toast.error("Error loading vote", {
        description: error instanceof Error ? error.message : "Failed to load vote data"
      });

      setLoadingError(error instanceof Error ? error.message : "Failed to load vote data");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Load transaction digest from localStorage if available
    const storedDigest = localStorage.getItem(`vote_${params.id}_txDigest`);
    if (storedDigest) {
      setTxDigest(storedDigest);
    }

    // Only fetch data when wallet state is stable
    // This prevents race conditions and premature validation errors
    if (walletStateStable) {
      // Initial data fetch
      fetchVoteData();
    }

    // Set up real-time updates subscription if we have a vote ID
    if (params.id) {
      // Subscribe to vote updates
      const unsubscribe = suivote.subscribeToVoteUpdates(params.id as string, async (updatedVoteDetails) => {
        // Update the vote state with the latest data
        setVote(updatedVoteDetails);

        // If showing results, update the UI accordingly
        if (showingResults || (updatedVoteDetails.showLiveStats)) {
          setShowingResults(true);

          try {
            // Get polls for the vote to update the UI with latest vote counts
            const pollsData = await suivote.getVotePolls(params.id as string);

            // Fetch options for each poll
            const pollsWithOptions = await Promise.all(
              pollsData.map(async (poll, index) => {
                // Get options for this poll (index + 1 because poll indices are 1-based)
                const options = await suivote.getPollOptions(params.id as string, index + 1);

                // Calculate percentage for each option based on votes
                const totalVotesForPoll = options.reduce((sum, option) => sum + option.votes, 0);
                const optionsWithPercentage = options.map(option => ({
                  ...option,
                  percentage: totalVotesForPoll > 0 ? (option.votes / totalVotesForPoll) * 100 : 0
                }));

                return {
                  ...poll,
                  options: optionsWithPercentage || [],
                  totalVotes: totalVotesForPoll
                };
              })
            );

            // Update the polls state with the latest data
            setPolls(pollsWithOptions || []);
          } catch (error) {
            console.error("Error updating polls data:", error);
          }
        }
      });

      // Clean up subscription when component unmounts or params change
      return () => {
        unsubscribe();
      };
    }
  }, [params.id, walletStateStable]);

  // Track wallet state stability to prevent race conditions
  useEffect(() => {
    setWalletStateStable(false);
    const timeoutId = setTimeout(() => {
      setWalletStateStable(true);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [wallet.connected, wallet.address]);

  // Separate effect for wallet state changes with debouncing to prevent race conditions
  useEffect(() => {
    // Only refetch when wallet state is stable
    if (!walletStateStable) return;

    // Add a small delay to allow wallet state to stabilize
    const timeoutId = setTimeout(() => {
      // Only refetch if we have a vote ID, component is not loading, and we have initial vote data
      if (params.id && !loading && vote) {
        fetchVoteData();
      }
    }, 100); // 100ms delay to allow wallet state to stabilize

    return () => clearTimeout(timeoutId);
  }, [wallet.connected, wallet.address, walletStateStable]);

  // Auto-transition effect - check if vote status should transition
  useEffect(() => {
    if (!vote || vote.status !== 'upcoming') return;

    let hasTransitioned = false;

    const checkStatusTransition = () => {
      if (hasTransitioned) return; // Prevent multiple transitions

      const currentTime = Date.now();
      if (vote.startTimestamp && currentTime >= vote.startTimestamp) {
        hasTransitioned = true;

        // Update the vote status locally
        setVote(prevVote => {
          if (prevVote && prevVote.status === 'upcoming') {
            return { ...prevVote, status: 'active' };
          }
          return prevVote;
        });

        toast.success("Vote has started!", {
          description: "The vote is now active and ready for participation.",
          duration: 4000,
        });

        // Refresh vote data to ensure consistency with backend
        // Only fetch if wallet state is stable to prevent race conditions
        if (walletStateStable) {
          fetchVoteData();
        }
      }
    };

    // Check immediately
    checkStatusTransition();

    // Set up interval to check every 5 seconds for better responsiveness
    const interval = setInterval(checkStatusTransition, 5000);

    // Cleanup interval on unmount or when vote status changes
    return () => clearInterval(interval);
  }, [vote?.status, vote?.startTimestamp, walletStateStable]);

  // Update progress bar based on transaction status
  useEffect(() => {
    switch (txStatus) {
      case TransactionStatus.IDLE: setTxProgress(0); break;
      case TransactionStatus.BUILDING: setTxProgress(20); break;
      case TransactionStatus.SIGNING: setTxProgress(40); break;
      case TransactionStatus.EXECUTING: setTxProgress(60); break;
      case TransactionStatus.CONFIRMING: setTxProgress(80); break;
      case TransactionStatus.SUCCESS: setTxProgress(100); break;
      case TransactionStatus.ERROR: break; // Keep progress where it was
    }
  }, [txStatus]);

  // Enhanced validation with detailed error messages and better UX
  const validateSelections = (selections: { [key: string]: string[] }, forceValidation = false) => {
    const validationErrors: { [key: string]: string } = {};
    let hasValidSelections = false;
    let hasRequiredSelections = true;
    let requiredPollsCount = 0;
    let completedRequiredPolls = 0;

    // Don't validate if we're still loading, polls aren't loaded, or if user has already voted
    if (loading || polls.length === 0 || hasVoted) {
      return {};
    }

    // For users who haven't interacted yet, only show validation for required polls if forced
    const showValidationForNonInteracted = forceValidation || attemptedSubmit;

    // Add immediate payment and token requirement validation
    if (wallet.connected && vote) {
      // Token requirement validation with proper balance checking
      if (vote.tokenRequirement) {
        const tokenSymbol = vote.tokenRequirement.split("::").pop() || "";
        const requiredAmount = Number(vote.tokenAmount || 0);
        console.log("tesing token requirements :", tokenBalance, requiredAmount)
        if (tokenBalance === null) {
          // Balance not loaded yet
          validationErrors.tokens = "Checking token balance...";
        } else if (tokenBalance < requiredAmount) {
          validationErrors.tokens = `You need at least ${formatTokenAmount(requiredAmount, tokenSymbol, 2)} to vote`;
        }
      }

      // Payment validation - show immediately if there are payment errors
      if (paymentError) {
        validationErrors.payment = paymentError;
      }

      // Fixed payment requirement validation
      if (vote.paymentAmount && Number(vote.paymentAmount) > 0 && userBalance) {
        const requiredPaymentSui = Number(fromDecimalUnits(vote.paymentAmount, 9));
        const userBalanceSui = Number(fromDecimalUnits(userBalance, 9));
        if (userBalanceSui < requiredPaymentSui) {
          validationErrors.payment = `Insufficient balance. Required: ${requiredPaymentSui.toFixed(3)} SUI, Available: ${userBalanceSui.toFixed(3)} SUI`;
        }
      }
    } else if (!wallet.connected && vote) {
      // Show wallet connection requirement for amount-related validations
      if (vote.tokenRequirement || Number(vote.paymentAmount) > 0 || vote.usePaymentWeighting) {
        validationErrors.wallet = "Connect your wallet to check requirements";
      }
    }

    // Check each poll for validation issues
    polls.forEach(poll => {
      const selectedOptions = selections[poll.id] || [];
      const shouldShowError = forceValidation || attemptedSubmit || touchedPolls[poll.id];
      // Show validation errors for required polls immediately, even without interaction
      const shouldShowRequiredError = shouldShowError || (poll.isRequired && (hasUserInteracted || showValidationForNonInteracted));

      // Count required polls
      if (poll.isRequired) {
        requiredPollsCount++;
      }

      // Check if required poll has selections (show error immediately for required polls)
      if (poll.isRequired && selectedOptions.length === 0 && shouldShowRequiredError) {
        validationErrors[poll.id] = `${poll.title} requires a response`;
        hasRequiredSelections = false;
      } else if (poll.isRequired && selectedOptions.length > 0) {
        completedRequiredPolls++;
      }

      // Validate selection count based on poll type (show errors immediately if selections exist)
      if (selectedOptions.length > 0) {
        if (!poll.isMultiSelect && selectedOptions.length > 1) {
          validationErrors[poll.id] = `${poll.title} allows only one selection`;
        } else if (poll.isMultiSelect && poll.maxSelections &&
          selectedOptions.length > poll.maxSelections) {
          validationErrors[poll.id] = `${poll.title}: Maximum ${poll.maxSelections} selections allowed`;
        } else if (poll.isMultiSelect && poll.minSelections &&
          selectedOptions.length < poll.minSelections && shouldShowError) {
          validationErrors[poll.id] = `${poll.title}: Minimum ${poll.minSelections} selections required`;
        }
      }

      // Track if we have any valid selections
      if (selectedOptions.length > 0 && !validationErrors[poll.id]) {
        hasValidSelections = true;
      }
    });

    // Provide more specific error messages with immediate feedback
    const shouldShowGeneralError = forceValidation || attemptedSubmit || hasUserInteracted || showValidationForNonInteracted;

    if (!hasValidSelections && shouldShowGeneralError) {
      if (requiredPollsCount > 0) {
        validationErrors.general = `Please complete ${requiredPollsCount} required poll${requiredPollsCount > 1 ? 's' : ''}`;
      } else if (hasUserInteracted) {
        validationErrors.general = "Please make at least one selection to submit your vote";
      }
    }

    // Show progress for required polls with immediate feedback
    if (requiredPollsCount > 0 && completedRequiredPolls < requiredPollsCount && shouldShowGeneralError) {
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
    if (Object.keys(currentErrors).length > 0) return false;

    // Check payment validation if payment weighting is enabled
    if (vote?.usePaymentWeighting && paymentError) return false;

    return true;
  };

  // Validate whenever selections change or when polls are loaded
  useEffect(() => {
    // Skip validation if user has already voted
    if (hasVoted) {
      setValidationErrors({});
      return;
    }

    if (polls.length > 0 && !loading) {
      const errors = validateSelections(selections);
      setValidationErrors(errors);
    }
  }, [selections, polls, hasUserInteracted, loading, touchedPolls, attemptedSubmit, hasVoted, wallet.connected, userHasRequiredTokens, paymentError, userBalance, vote?.tokenRequirement, vote?.paymentAmount, vote?.usePaymentWeighting]);

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

    // Validation will be handled by the useEffect that watches selections changes
    // No need for setTimeout delay as React state updates are batched
  }

  // Validate vote submission
  const validateVote = () => {
    if (!vote) return false

    const newErrors: Record<string, string> = {}
    let isValid = true

    // Check if user is connected
    if (!wallet.connected) {
      newErrors['wallet'] = "Please connect your wallet to vote"
      isValid = false
    }

    // Check if user has already voted
    if (hasVoted) {
      newErrors['voted'] = "You have already voted in this poll"
      isValid = false
    }

    // Check if user has required tokens
    if (vote.tokenRequirement) {
      const tokenSymbol = vote.tokenRequirement.split("::").pop() || "";
      const requiredAmount = Number(vote.tokenAmount || 0);

      if (tokenBalance === null) {
        newErrors['tokens'] = "Checking token balance...";
        isValid = false;
      } else if (tokenBalance < requiredAmount) {
        newErrors['tokens'] = `You need at least ${formatTokenAmount(requiredAmount, tokenSymbol, 2)} to vote`;
        isValid = false;
      }
    }

    // Check if vote is active
    if (vote.status !== "active") {
      newErrors['status'] = vote.status === "upcoming" ? "This vote has not started yet" : "This vote has ended"
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
      if (!wallet.connected || !wallet.address) {
        throw new Error("Please connect your wallet to vote");
      }

      if (!vote) {
        throw new Error("Vote data not loaded. Please refresh the page.");
      }

      // Extract voteId from params
      const voteId = Array.isArray(params.id) ? params.id[0] : params.id;
      if (!voteId) {
        throw new Error('Vote ID is required');
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

      // STEP 3: Enhanced validation with better error messages
      setTxProgress(30);

      // Token balance verification for weighted voting
      if (vote.tokenRequirement && !userHasRequiredTokens) {
        const tokenSymbol = vote.tokenRequirement.split("::").pop() || "tokens";
        const requiredAmount = formatTokenAmount(vote.tokenAmount || 0, tokenSymbol, 2);
        throw new Error(`Token requirement not met. You need at least ${requiredAmount} to participate in this vote.`);
      }

      // Payment validation with consistent decimal handling
      if (vote.usePaymentWeighting || (vote.paymentAmount && Number(vote.paymentAmount) > 0)) {
        const userBalanceSui = Number(fromDecimalUnits(userBalance, 9));

        if (vote.usePaymentWeighting) {
          const paymentAmountNum = Number(paymentAmount);
          const minPaymentSui = (vote.tokensPerVote && Number(vote.tokensPerVote) > 0) ? Number(fromDecimalUnits(Number(vote.tokensPerVote), 9)) : 0;

          if (isNaN(paymentAmountNum) || paymentAmountNum <= 0) {
            throw new Error("Please enter a valid payment amount greater than 0 SUI.");
          }

          if (paymentAmountNum > userBalanceSui) {
            throw new Error(`Insufficient balance for payment. You have ${userBalanceSui.toFixed(3)} SUI available.`);
          }

          if (minPaymentSui > 0 && paymentAmountNum < minPaymentSui) {
            throw new Error(`Payment amount too low. Minimum required: ${minPaymentSui.toFixed(3)} SUI for 1x vote weight.`);
          }
        } else if (vote.paymentAmount && Number(vote.paymentAmount) > 0) {
          const requiredPaymentSui = Number(fromDecimalUnits(vote.paymentAmount, 9));

          if (userBalanceSui < requiredPaymentSui) {
            throw new Error(`Insufficient balance for required payment. Required: ${requiredPaymentSui.toFixed(3)} SUI, Available: ${userBalanceSui.toFixed(3)} SUI.`);
          }
        }
      }
      // STEP 4: Prepare transaction data
      setTxProgress(40);
      const pollIndices: number[] = [];
      const optionIndicesPerPoll: number[][] = [];
      let processedPolls = 0;

      // Process each poll with selections
      polls.forEach((poll, pollIdx) => {
        const selectedOptionIds = selections[poll.id] || [];

        // Skip polls with no selections
        if (selectedOptionIds.length === 0) {
          return;
        }

        // Map option IDs to indices for the smart contract
        const optionIndices: number[] = [];
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
            Number(vote.tokenAmount || 0)
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

      // Determine payment amount based on payment weighting
      const finalPaymentAmount = vote.usePaymentWeighting ? paymentAmount : (vote.paymentAmount || 0);

      console.log("[Vote Debug] Creating transaction with:", {
        voteId: params.id,
        pollIndices,
        optionIndicesPerPoll,
        tokenBalance,
        paymentAmount: finalPaymentAmount,
        usePaymentWeighting: vote.usePaymentWeighting,
        tokensPerVote: vote.tokensPerVote,
        paymentTokenWeight: vote.paymentTokenWeight,
        calculatedVoteWeight,
        singleVote: pollIndices.length === 1
      });

      // Additional debugging for payment weighting
      if (vote.usePaymentWeighting) {
        const paymentAmountMist = parseInt(toDecimalUnits(finalPaymentAmount.toString(), 9));
        const expectedVoteWeight = (vote.tokensPerVote && Number(vote.tokensPerVote) > 0) ? Math.floor(paymentAmountMist / Number(vote.tokensPerVote)) : 1;
        console.log("[Vote Debug] Payment weighting calculation:", {
          paymentAmountSui: finalPaymentAmount,
          paymentAmountMist,
          tokensPerVoteMist: vote.tokensPerVote || 0,
          expectedVoteWeight,
          willPassValidation: expectedVoteWeight > 0
        });
      }

      let transaction;
      if (pollIndices.length === 1) {
        transaction = await suivote.castVoteTransaction(
          voteId,
          pollIndices[0],
          optionIndicesPerPoll[0],
          tokenBalance,
          finalPaymentAmount
        );
      } else {
        transaction = await suivote.castMultipleVotesTransaction(
          voteId,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          finalPaymentAmount
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

      // Immediately store voted state in localStorage for persistence
      if (wallet.address) {
        localStorage.setItem(`hasVoted_${params.id}_${wallet.address}`, 'true')
      }

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
          // Only fetch if wallet state is stable to prevent race conditions
          if (walletStateStable) {
            fetchVoteData();
          }
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

      const errorObj = error as Error;
      if (errorObj.message) {
        errorMessage = errorObj.message;

        // Provide specific guidance for common errors
        if (errorObj.message.includes("User rejected") || errorObj.message.includes("rejected")) {
          errorMessage = "Transaction cancelled";
          errorDescription = "You cancelled the transaction in your wallet";
        } else if (errorObj.message.includes("insufficient")) {
          errorMessage = "Insufficient funds";
          errorDescription = "You don't have enough SUI to pay for transaction fees";
        } else if (errorObj.message.includes("network") || errorObj.message.includes("connection")) {
          errorMessage = "Network error";
          errorDescription = "Please check your internet connection and try again";
        } else if (errorObj.message.includes("already voted")) {
          errorMessage = "Already voted";
          errorDescription = "You have already submitted your vote for this poll";
        } else if (errorObj.message.includes("not eligible")) {
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
  const formatDate = (timestamp: any) => {
    try {
      return format(new Date(timestamp), "PPP")
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Date unavailable"
    }
  }

  // Format time
  const formatTime = (timestamp: any) => {
    try {
      return format(new Date(timestamp), "p")
    } catch (e) {
      console.error("Error formatting time:", e)
      return "Time unavailable"
    }
  }

  // Function to detect URLs in text and convert them to clickable links
  const formatTextWithLinks = (text: any) => {
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
  const truncateAddress = (address: any) => {
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
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success("Address copied to clipboard")
  }

  // Loading state
  if (loading) {
    return <VoteDetailSkeleton />
  }

  // Error state
  if (loadingError || !vote) {
    const isWalletError = loadingError?.includes("wallet") || loadingError?.includes("connect")
    const isWhitelistError = loadingError?.includes("whitelisted")

    return (
      <div className="container max-w-4xl py-6 md:py-10 px-4 md:px-6 mx-auto">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Vote</AlertTitle>
          <AlertDescription className="space-y-2">
            <div>{loadingError || "Failed to load vote data. Please try again later."}</div>
            {isWalletError && (
              <div className="text-sm text-muted-foreground">
                If your wallet is connected but you're still seeing this error, try refreshing the page or reconnecting your wallet.
              </div>
            )}
            {isWhitelistError && (
              <div className="text-sm text-muted-foreground">
                Make sure your wallet is properly connected and you have the required permissions to view this vote.
              </div>
            )}
          </AlertDescription>
        </Alert>
        <div className="flex flex-col sm:flex-row gap-3">
          {(isWalletError || isWhitelistError) && (
            <Button
              onClick={() => {
                setLoadingError(null)
                fetchVoteData()
              }}
              variant="default"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
          <Button asChild variant="outline" className="gap-2">
            <Link href="/polls">
              <ArrowLeft className="h-4 w-4" />
              Back to Polls
            </Link>
          </Button>
        </div>
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
                    <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Upcoming</Badge>
                    <Badge variant="outline" className="gap-1 transition-all duration-200 hover:translate-x-[2px]">
                      <Calendar className="h-3 w-3" />
                      Starts {formatDate(vote.startTimestamp)}
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


              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle>This vote has not started yet</AlertTitle>
                <AlertDescription>
                  This vote will be available for participation starting on {formatDate(vote.startTimestamp)} at{" "}
                  {formatTime(vote.startTimestamp)}.
                </AlertDescription>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                      <Timer className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Set Reminder</p>
                      <p className="text-xs text-muted-foreground">Add this vote to your calendar</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={() => {
                        const startDate = new Date(vote.startTimestamp)
                        const endDate = new Date(vote.endTimestamp)
                        const title = encodeURIComponent(`Vote: ${vote.title}`)
                        const details = encodeURIComponent(`Participate in the vote: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nVote URL: ${window.location.href}`)
                        const startTime = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                        const endTime = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

                        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${encodeURIComponent(window.location.href)}`
                        window.open(googleUrl, '_blank')
                      }}
                    >
                      <Calendar className="h-3 w-3" />
                      Google Calendar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={() => {
                        const startDate = new Date(vote.startTimestamp)
                        const endDate = new Date(vote.endTimestamp)
                        const title = encodeURIComponent(`Vote: ${vote.title}`)
                        const details = encodeURIComponent(`Participate in the vote: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nVote URL: ${window.location.href}`)
                        const startTime = startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                        const endTime = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

                        const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startTime}&enddt=${endTime}&body=${details}&location=${encodeURIComponent(window.location.href)}`
                        window.open(outlookUrl, '_blank')
                      }}
                    >
                      <Calendar className="h-3 w-3" />
                      Outlook
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={() => {
                        const startDate = new Date(vote.startTimestamp)
                        const endDate = new Date(vote.endTimestamp)
                        const title = `Vote: ${vote.title}`
                        const details = `Participate in the vote: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nVote URL: ${window.location.href}`

                        // Create ICS file content
                        const icsContent = [
                          'BEGIN:VCALENDAR',
                          'VERSION:2.0',
                          'PRODID:-//SuiVote//Vote Reminder//EN',
                          'BEGIN:VEVENT',
                          `UID:${Date.now()}@suivote.com`,
                          `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                          `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                          `SUMMARY:${title}`,
                          `DESCRIPTION:${details.replace(/\n/g, '\\n')}`,
                          `URL:${window.location.href}`,
                          'END:VEVENT',
                          'END:VCALENDAR'
                        ].join('\r\n')

                        // Create and download ICS file
                        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `vote-reminder-${vote.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        window.URL.revokeObjectURL(url)

                        toast.success('Calendar file downloaded!', {
                          description: 'Open the file to add the reminder to your calendar app.'
                        })
                      }}
                    >
                      <Calendar className="h-3 w-3" />
                      Download .ics
                    </Button>
                  </div>
                </div>
              </Alert>
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

                {!vote.usePaymentWeighting && vote.tokenRequirement && (
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

                {!vote.usePaymentWeighting && Number(vote.paymentAmount) > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Fixed Payment Required</p>
                      <p className="text-xs text-muted-foreground">{formatTokenAmount(String(vote.paymentAmount || 0), "SUI")} to vote</p>
                    </div>
                  </div>
                )}

                {vote.usePaymentWeighting && (vote.paymentTokenWeight || (vote.tokensPerVote && Number(vote.tokensPerVote) > 0)) && (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payment Weighting</p>
                      <p className="text-xs text-muted-foreground">
                        {vote.paymentTokenWeight
                          ? `${formatTokenAmount(String(vote.paymentTokenWeight || 0), "SUI")} per vote weight`
                          : (vote.tokensPerVote && Number(vote.tokensPerVote) > 0)
                            ? `Min: ${formatTokenAmount(String(fromDecimalUnits(Number(vote.tokensPerVote), 9)), "SUI")}`
                            : "Variable payment amounts"
                        }
                      </p>
                    </div>
                  </div>
                )}

                {!vote.hasWhitelist && !vote.tokenRequirement && Number(vote.paymentAmount) <= 0 && (
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
        <TransactionStatusDialog
          open={txStatusDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleDialogClose();
            }
            setTxStatusDialogOpen(open);
          }}
          onClose={handleCloseTxStatusDialog}
          txStatus={txStatus}
          txDigest={txDigest}
          failedStep={failedStep}
          transactionError={transactionError}
          explorerUrl={SUI_CONFIG.explorerUrl}
        />
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
                    {(vote.tokenRequirement || Number(vote.paymentAmount) > 0 || vote.hasWhitelist || vote.usePaymentWeighting) && (
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
                                  !validationErrors.tokens && wallet.connected
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                                )}
                                onClick={() => toggleBadgeExpansion('tokenRequirement')}
                              >
                                <Wallet className="h-3 w-3" />
                                {formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)}
                                {wallet.connected && (
                                  !validationErrors.tokens ?
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
                                    {!validationErrors.tokens && wallet.connected
                                      ? `✅ You have enough ${vote.tokenRequirement.split("::").pop()} tokens to vote`
                                      : validationErrors.tokens
                                        ? `❌ ${validationErrors.tokens}`
                                        : `You must hold at least ${formatTokenAmount(vote.tokenAmount || 0, vote.tokenRequirement.split("::").pop() || "", 2)} to vote. Connect your wallet to check your balance.`
                                    }
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Token Weighting Indicator */}
                          {(vote.usePaymentWeighting || vote.tokenRequirement) && (Number(vote.paymentTokenWeight || 0) > 0 || (vote.tokensPerVote && Number(vote.tokensPerVote) > 0)) && (
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
                                    📊 Your voting power is weighted by how much you pay with ${Number(vote.tokensPerVote) > 0 ?
                                      formatTokenAmount(Number(vote.tokensPerVote || 0), "SUI") : formatTokenAmount(Number(vote.paymentTokenWeight || 0), "SUI")} per vote weight.
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Fixed Payment Requirement */}
                          {Number(vote.paymentAmount) > 0 && (
                            <div className="space-y-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs gap-1 cursor-pointer transition-all hover:scale-105",
                                  !validationErrors.payment && wallet.connected && userBalance
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400"
                                )}
                                onClick={() => toggleBadgeExpansion('paymentRequirement')}
                              >
                                <Wallet className="h-3 w-3" />
                                {formatTokenAmount(String(vote.paymentAmount || 0), "SUI")}
                                {wallet.connected && userBalance && (
                                  !validationErrors.payment ?
                                    <CheckCircle2 className="h-3 w-3" /> :
                                    <X className="h-3 w-3" />
                                )}
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
                                    {wallet.connected && userBalance ? (
                                      !validationErrors.payment ? (
                                        `✅ You have sufficient balance to pay ${formatTokenAmount(String(vote.paymentAmount || 0), "SUI")} required for this vote`
                                      ) : (
                                        `❌ ${validationErrors.payment}`
                                      )
                                    ) : (
                                      `💰 A payment of ${formatTokenAmount(String(vote.paymentAmount || 0), "SUI")} is required to submit your vote. Connect your wallet to check your balance.`
                                    )}
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
                                  wallet.connected && isWhitelisted
                                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                                )}
                                onClick={() => toggleBadgeExpansion('whitelistRequirement')}
                              >
                                <Shield className="h-3 w-3" />
                                Whitelist
                                {wallet.connected && (
                                  isWhitelisted ?
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
                                    {wallet.connected && isWhitelisted
                                      ? (
                                        <div>
                                          <div>✅ Your wallet address is approved to participate in this vote</div>
                                          {userWhitelistWeight > 1 && (
                                            <div className="mt-1 font-medium text-green-600 dark:text-green-400">
                                              🎯 Pre-assigned vote weight: {userWhitelistWeight}x
                                            </div>
                                          )}
                                        </div>
                                      )
                                      : wallet.connected
                                        ? "❌ Only pre-approved wallet addresses can vote. Your address is not on the whitelist."
                                        : "🛡️ This vote is restricted to pre-approved wallet addresses only. Connect your wallet to check if you're eligible."
                                    }
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
                  <AlertDescription className="text-sm space-y-3">
                    <div>
                      {vote.showLiveStats ?
                        "Your vote has been recorded. Live results are shown below." :
                        "Your vote has been recorded. Results will be available when voting ends."
                      }
                    </div>
                    <div className="pt-2 border-t border-green-200 dark:border-green-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium">Set closing reminder:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs h-7 bg-white dark:bg-green-900/30 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/50"
                          onClick={() => {
                            const endDate = new Date(vote.endTimestamp)
                            const reminderDate = new Date(vote.endTimestamp + 5 * 60 * 1000) // 5 minutes after voting ends
                            const title = encodeURIComponent(`Vote Results: ${vote.title}`)
                            const details = encodeURIComponent(`Voting has ended for: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nCheck results at: ${window.location.href}`)
                            const reminderTime = reminderDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                            const endTime = new Date(reminderDate.getTime() + 30 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' // 30 min duration

                            const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${reminderTime}/${endTime}&details=${details}&location=${encodeURIComponent(window.location.href)}`
                            window.open(googleUrl, '_blank')
                          }}
                        >
                          <Calendar className="h-3 w-3" />
                          Google
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs h-7 bg-white dark:bg-green-900/30 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/50"
                          onClick={() => {
                            const endDate = new Date(vote.endTimestamp)
                            const reminderDate = new Date(vote.endTimestamp + 5 * 60 * 1000) // 5 minutes after voting ends
                            const title = encodeURIComponent(`Vote Results: ${vote.title}`)
                            const details = encodeURIComponent(`Voting has ended for: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nCheck results at: ${window.location.href}`)
                            const reminderTime = reminderDate.toISOString()
                            const endTime = new Date(reminderDate.getTime() + 30 * 60 * 1000).toISOString() // 30 min duration

                            const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${reminderTime}&enddt=${endTime}&body=${details}&location=${encodeURIComponent(window.location.href)}`
                            window.open(outlookUrl, '_blank')
                          }}
                        >
                          <Calendar className="h-3 w-3" />
                          Outlook
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs h-7 bg-white dark:bg-green-900/30 border-green-300 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/50"
                          onClick={() => {
                            const endDate = new Date(vote.endTimestamp)
                            const reminderDate = new Date(vote.endTimestamp + 5 * 60 * 1000) // 5 minutes after voting ends
                            const title = `Vote Results: ${vote.title}`
                            const details = `Voting has ended for: ${vote.title}${vote.description ? `\n\n${vote.description}` : ''}\n\nCheck results at: ${window.location.href}`

                            // Create ICS file content
                            const icsContent = [
                              'BEGIN:VCALENDAR',
                              'VERSION:2.0',
                              'PRODID:-//SuiVote//Vote Results Reminder//EN',
                              'BEGIN:VEVENT',
                              `UID:${Date.now()}-results@suivote.com`,
                              `DTSTART:${reminderDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                              `DTEND:${new Date(reminderDate.getTime() + 30 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
                              `SUMMARY:${title}`,
                              `DESCRIPTION:${details.replace(/\n/g, '\\n')}`,
                              `URL:${window.location.href}`,
                              'END:VEVENT',
                              'END:VCALENDAR'
                            ].join('\r\n')

                            // Create and download ICS file
                            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
                            const url = window.URL.createObjectURL(blob)
                            const link = document.createElement('a')
                            link.href = url
                            link.download = `vote-results-reminder-${vote.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                            window.URL.revokeObjectURL(url)

                            toast.success('Calendar reminder downloaded!', {
                              description: 'You\'ll be reminded when vote results are available.'
                            })
                          }}
                        >
                          <Calendar className="h-3 w-3" />
                          .ics
                        </Button>
                      </div>
                    </div>

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
                                  style={{ transform: `scaleX(${(option.percentage || 0) / 100})` }}
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
                                       {!vote.usePaymentWeighting && Number(vote.tokensPerVote || 0) <= 0 && <span className="text-muted-foreground">{option.votes} votes</span>}
                                        <span className="font-medium">{(option.percentage || 0).toFixed(1)}%</span>
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
                                    style={{ transform: `scaleX(${(option.percentage || 0) / 100})` }}
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
                                          <span className="text-muted-foreground">{!vote.usePaymentWeighting && Number(vote.tokensPerVote || 0) <= 0 ? `${option.votes} votes` : ""}</span>
                                          <span className="font-medium">{(option.percentage || 0).toFixed(1)}%</span>
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
                                  <span> {!vote.usePaymentWeighting && Number(vote.tokensPerVote || 0) <= 0 ? `${option.votes} votes` : ""} ({(option.percentage || 0).toFixed(1)}%)</span>
                                </div>
                                <Progress value={option.percentage || 0} className="h-2" />
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

        {/* Enhanced Payment Weighting Section */}
        {vote.status === "active" && !hasVoted && userCanVote && vote.usePaymentWeighting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8"
          >
            <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-purple-900 dark:text-purple-100">
                        Payment Weighting
                      </CardTitle>
                      <CardDescription className="text-purple-700 dark:text-purple-300">
                        Increase your vote influence with higher payment amounts
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Payment Configuration Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-white/50 dark:bg-gray-900/50 rounded-lg border border-purple-100 dark:border-purple-800">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Minimum Payment</div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {vote.usePaymentWeighting ? `${vote.paymentTokenWeight} SUI` : "0.001 SUI"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Maximum Payment</div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {/* For payment weighting, paymentAmount is NOT the max limit - it's a fixed payment requirement */}
                      {/* Payment weighting typically has no hard maximum, just practical limits */}
                      {vote.paymentAmount && Number(vote.paymentAmount) > 0 && !vote.usePaymentWeighting
                        ? `${Number(fromDecimalUnits(vote.paymentAmount, 9)).toFixed(3)} SUI`
                        : "1000 SUI"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {vote.paymentTokenWeight && Number(vote.paymentTokenWeight) !== 1 ? "Weight Per SUI" : "Base Weight"}
                    </div>
                    <div className="font-semibold text-purple-700 dark:text-purple-300">
                      {vote.paymentTokenWeight && Number(vote.paymentTokenWeight) > 0 ? `${vote.paymentTokenWeight}x` : "1x"}
                    </div>
                  </div>
                </div>

                {/* Payment Amount Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="payment-amount" className="text-sm font-medium text-purple-900 dark:text-purple-100">
                      Payment Amount (SUI)
                    </Label>
                    {vote.usePaymentWeighting && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                        onClick={() => setPaymentAmount(parseFloat(vote.paymentTokenWeight || '0') || 0)}
                      >
                        Use Minimum
                      </Button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="payment-amount"
                      type="number"
                      step="0.001"
                      min={vote.usePaymentWeighting ? String(vote.paymentTokenWeight || 0) : "0"}
                      max="1000"
                      value={paymentAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                          setPaymentAmount(parseFloat(value) || 0);
                        }
                      }}
                      placeholder={vote.usePaymentWeighting ? `Min: ${vote.paymentTokenWeight || 0} SUI` : "Enter payment amount"}
                      className={cn(
                        "pr-16 h-12 text-lg font-medium border-purple-200 dark:border-purple-700 focus:ring-purple-500 focus:border-purple-500",
                        paymentError && "border-red-500 focus:ring-red-500 focus:border-red-500"
                      )}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <span className="text-sm font-medium text-purple-600 dark:text-purple-400">SUI</span>
                    </div>
                  </div>
                  {paymentError && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-md">
                      <AlertCircle className="h-4 w-4" />
                      {paymentError}
                    </div>
                  )}
                </div>

                {/* Enhanced Balance and Vote Weight Display */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Balance Card */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Your Balance</span>
                    </div>
                    <div className="space-y-2">
                      {balanceLoading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-blue-700 dark:text-blue-300">Loading...</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                            {userBalance ? `${Number(fromDecimalUnits(userBalance, 9)).toFixed(3)} SUI` : "0 SUI"}
                          </div>
                          {userBalance && paymentAmount && paymentAmount > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                                <div
                                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(100, (Number(paymentAmount) / Number(fromDecimalUnits(userBalance, 9))) * 100)}%`
                                  }}
                                />
                              </div>
                              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                                {((Number(paymentAmount) / Number(fromDecimalUnits(userBalance, 9))) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {userBalance && paymentAmount && Number(paymentAmount) > 0 && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              Remaining: {(Number(fromDecimalUnits(userBalance, 9)) - Number(paymentAmount)).toFixed(3)} SUI
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Vote Weight Card */}
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-900 dark:text-green-100">Vote Weight</span>
                    </div>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {calculatedVoteWeight.toFixed(2)}x
                      </div>
                      {vote.hasWhitelist && userWhitelistWeight > 1 && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          +{userWhitelistWeight}x whitelist bonus
                        </div>
                      )}
                      {paymentAmount && Number(paymentAmount) > 0 && (
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Based on {paymentAmount} SUI payment
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                    {validationErrors.tokens || validationErrors.payment || validationErrors.wallet ||
                      validationErrors.general ||
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