"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PlusCircle,
  Trash2,
  ArrowRight,
  Calendar,
  ImageIcon,
  Coins,
  Wallet,
  AlertCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Info,
  FileText,
  ListChecks,
  X,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DateTimePicker } from "@/components/date-time-picker"
import { isAfter, addDays } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useWallet } from "@suiet/wallet-kit"
import { useSuiVote } from "@/hooks/use-suivote"
import { useToast } from "@/components/ui/use-toast"
import { SUI_CONFIG } from "@/config/sui-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
// Update the imports to include the new TokenSelector component
import { TokenSelector } from "@/components/token-selector"
import { VoteMediaHandler  } from "@/components/media-handler";
import { MediaFileUploader } from "@/components/file-uploader";


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

type PollType = {
  id: string
  title: string
  description: string
  options: {
    id: string
    text: string
    mediaUrl: string | null
  }[]
  isMultiSelect: boolean
  maxSelections: number
  isRequired: boolean
}

type VotingSettings = {
  requiredToken: string
  requiredAmount: string
  paymentAmount: string
  startDate: Date | undefined
  endDate: Date | undefined
  requireAllPolls: boolean
  showLiveStats: boolean
}

type ValidationErrors = {
  title?: string
  description?: string
  polls?: {
    [key: string]: {
      title?: string
      options?: string
      optionTexts?: string[]
      maxSelections?: string
    }
  }
  votingSettings?: {
    dates?: string
    token?: string
    amount?: string
  }
  environment?: string
}

export default function CreateVotePage() {
  const router = useRouter()
  const wallet = useWallet()
  const { loading, error, executeTransaction } = useSuiVote()
  const { toast: uiToast } = useToast()

  const [mediaUploadDialogOpen, setMediaUploadDialogOpen] = useState(false);
  const [activeMediaOption, setActiveMediaOption] = useState({ poll: null, option: null });

  const [voteTitle, setVoteTitle] = useState("")
  const [voteDescription, setVoteDescription] = useState("")
  const [polls, setPolls] = useState<PollType[]>([
    {
      id: "poll-1",
      title: "",
      description: "",
      options: [
        { id: "option-1-1", text: "", mediaUrl: null },
        { id: "option-1-2", text: "", mediaUrl: null },
      ],
      isMultiSelect: false,
      maxSelections: 1,
      isRequired: true,
    },
  ])

  const [votingSettings, setVotingSettings] = useState<VotingSettings>({
    requiredToken: "none",
    requiredAmount: "",
    paymentAmount: "0",
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
    requireAllPolls: true,
    showLiveStats: false,
  })

  const [errors, setErrors] = useState<ValidationErrors>({})
  const [activeTab, setActiveTab] = useState("details")
  const [activePollIndex, setActivePollIndex] = useState(0)
  const [showLiveStats, setShowLiveStats] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // New state for transaction status tracking
  const [txStatus, setTxStatus] = useState<TransactionStatus>(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txStatusDialogOpen, setTxStatusDialogOpen] = useState(false)
  const [txProgress, setTxProgress] = useState(0)

  // New state for environment variable checks
  const [envVarsChecked, setEnvVarsChecked] = useState(false)
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([])

  
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(
      new Date(new Date().setDate(new Date().getDate() + 7))
    );
  
    // Example available dates (next 14 days)
    const availableDates = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date;
    });

// Example disabled dates
const disabledDates = [
  new Date(new Date().setDate(new Date().getDate() + 3))
]

  // Check environment variables on component mount
  useEffect(() => {
    const requiredEnvVars = [
      { name: "PACKAGE_ID", value: SUI_CONFIG.PACKAGE_ID },
      { name: "ADMIN_ID", value: SUI_CONFIG.ADMIN_ID },
      { name: "NETWORK", value: SUI_CONFIG.NETWORK },
    ]

    const missing = requiredEnvVars
      .filter(
        (env) =>
          !env.value || env.value === "YOUR_PACKAGE_ID_HERE" || env.value === "ADMIN_OBJECT_ID_FROM_PUBLISH_OUTPUT",
      )
      .map((env) => env.name)

    setMissingEnvVars(missing)
    setEnvVarsChecked(true)

    if (missing.length > 0) {
      setErrors((prev) => ({
        ...prev,
        environment: `Missing required configuration: ${missing.join(", ")}`,
      }))

      uiToast({
        variant: "destructive",
        title: "Configuration Error",
        description: `Missing required configuration: ${missing.join(", ")}`,
      })
    }
  }, [uiToast])

  // Update document title when vote title changes
  useEffect(() => {
    document.title = voteTitle ? `${voteTitle} - SuiVote` : "Create New Vote - SuiVote"
  }, [voteTitle])

  // Display error from hook if it exists
  useEffect(() => {
    if (error) {
      setTransactionError(error)
      setTxStatus(TransactionStatus.ERROR)

      toast.error("Error creating vote", {
        description: error,
      })
      console.error("Transaction error:", error)
    }
  }, [error])

  // Check wallet connection status
  useEffect(() => {
    if (activeTab === "settings" && !wallet.connected) {
      uiToast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a vote",
        variant: "destructive",
      })
    }
  }, [activeTab, wallet.connected, uiToast])

  // Update progress bar based on transaction status
  useEffect(() => {
    switch (txStatus) {
      case TransactionStatus.IDLE:
        setTxProgress(0)
        break
      case TransactionStatus.BUILDING:
        setTxProgress(20)
        break
      case TransactionStatus.SIGNING:
        setTxProgress(40)
        break
      case TransactionStatus.EXECUTING:
        setTxProgress(60)
        break
      case TransactionStatus.CONFIRMING:
        setTxProgress(80)
        break
      case TransactionStatus.SUCCESS:
        setTxProgress(100)
        break
      case TransactionStatus.ERROR:
        // Keep the progress where it was when the error occurred
        break
    }
  }, [txStatus])

  // Update the addPoll function to use timestamp-based unique ID
  const addPoll = () => {
    const timestamp = Date.now()
    const newPoll: PollType = {
      id: `poll-${timestamp}`,
      title: "",
      description: "",
      options: [
        { id: `option-${timestamp}-1`, text: "", mediaUrl: null },
        { id: `option-${timestamp}-2`, text: "", mediaUrl: null },
      ],
      isMultiSelect: false,
      maxSelections: 1,
      isRequired: true,
    }
    setPolls([...polls, newPoll])
    setActivePollIndex(polls.length)
    setActiveTab("polls")
  }

  const removePoll = (pollIndex: number) => {
    if (polls.length > 1) {
      const newPolls = [...polls]
      newPolls.splice(pollIndex, 1)
      setPolls(newPolls)
      if (activePollIndex >= pollIndex && activePollIndex > 0) {
        setActivePollIndex(activePollIndex - 1)
      }
    }
  }

  const updatePollTitle = (pollIndex: number, title: string) => {
    const newPolls = [...polls]
    newPolls[pollIndex].title = title
    setPolls(newPolls)
  }

  const updatePollDescription = (pollIndex: number, description: string) => {
    const newPolls = [...polls]
    newPolls[pollIndex].description = description
    setPolls(newPolls)
  }

  const updatePollType = (pollIndex: number, isMultiSelect: boolean) => {
    const newPolls = [...polls]
    newPolls[pollIndex].isMultiSelect = isMultiSelect
    newPolls[pollIndex].maxSelections = isMultiSelect ? Math.min(2, newPolls[pollIndex].options.length - 1) : 1
    setPolls(newPolls)
  }

  const updateMaxSelections = (pollIndex: number, maxSelections: number) => {
    const newPolls = [...polls]
    newPolls[pollIndex].maxSelections = maxSelections
    setPolls(newPolls)
  }

  const updatePollRequired = (pollIndex: number, isRequired: boolean) => {
    const newPolls = [...polls]
    newPolls[pollIndex].isRequired = isRequired
    setPolls(newPolls)
  }

  // Update the addOption function to use timestamp-based unique IDs
  const addOption = (pollIndex: number) => {
    const timestamp = Date.now()
    const newPolls = [...polls]
    const newOptionId = `option-${timestamp}-${newPolls[pollIndex].options.length + 1}`
    newPolls[pollIndex].options.push({ id: newOptionId, text: "", mediaUrl: null })
    setPolls(newPolls)
  }

  const removeOption = (pollIndex: number, optionIndex: number) => {
    const newPolls = [...polls]
    if (newPolls[pollIndex].options.length > 2) {
      newPolls[pollIndex].options.splice(optionIndex, 1)

      // Adjust maxSelections if needed
      if (
        newPolls[pollIndex].isMultiSelect &&
        newPolls[pollIndex].maxSelections >= newPolls[pollIndex].options.length
      ) {
        newPolls[pollIndex].maxSelections = newPolls[pollIndex].options.length - 1
      }

      setPolls(newPolls)
    }
  }

  const updateOption = (pollIndex: number, optionIndex: number, text: string) => {
    const newPolls = [...polls]
    newPolls[pollIndex].options[optionIndex].text = text
    setPolls(newPolls)
  }
    
  // Enhanced validation function aligned with service validation
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}
    let errorTab: string | null = null

    // Check for environment variable errors first
    if (missingEnvVars.length > 0) {
      newErrors.environment = `Missing required configuration: ${missingEnvVars.join(", ")}`
      uiToast({
        variant: "destructive",
        title: "Configuration Error",
        description: `Missing required configuration: ${missingEnvVars.join(", ")}`,
      })
      return false
    }

    // Validate vote title
    if (!voteTitle.trim()) {
      newErrors.title = "Vote title is required"
      errorTab = "details"
    }

    // Validate polls
    const pollErrors: ValidationErrors["polls"] = {}

    polls.forEach((poll, index) => {
      const pollError: {
        title?: string
        options?: string
        optionTexts?: string[]
        maxSelections?: string
      } = {}

      if (!poll.title.trim()) {
        pollError.title = "Poll title is required"
        errorTab = "polls"
      }

      // Check for empty options
      const emptyOptions = poll.options.filter((option) => !option.text.trim())
      if (emptyOptions.length > 0) {
        pollError.options = "All options must have text"
        pollError.optionTexts = poll.options.map((option) => (option.text.trim() ? "" : "Option text is required"))
        errorTab = "polls"
      }

      // Check minimum number of options
      if (poll.options.length < 2) {
        pollError.options = "Each poll must have at least 2 options"
        errorTab = "polls"
      }

      // Validate maxSelections for multi-select polls
      if (poll.isMultiSelect) {
        if (poll.maxSelections < 1) {
          pollError.maxSelections = "Maximum selections must be at least 1"
          errorTab = "polls"
        } else if (poll.maxSelections >= poll.options.length) {
          pollError.maxSelections = `Maximum selections must be less than the number of options (${poll.options.length})`
          errorTab = "polls"
        }
      }

      if (Object.keys(pollError).length > 0) {
        pollErrors[poll.id] = pollError
      }
    })

    if (Object.keys(pollErrors).length > 0) {
      newErrors.polls = pollErrors
    }

    // Validate voting settings
    const settingsErrors: { dates?: string; token?: string; amount?: string } = {}

    // Validate dates
    if (votingSettings.startDate && votingSettings.endDate) {
      if (!isAfter(votingSettings.endDate, votingSettings.startDate)) {
        settingsErrors.dates = "End date must be after start date"
        errorTab = "settings"
      }
    } else if (!votingSettings.startDate || !votingSettings.endDate) {
      settingsErrors.dates = "Both start and end dates are required"
      errorTab = "settings"
    }

    // Validate token requirements
    if (votingSettings.requiredToken && votingSettings.requiredToken !== "none") {
      if (!votingSettings.requiredAmount) {
        settingsErrors.token = "Token amount is required when a token is selected"
        errorTab = "settings"
      } else if (Number.parseFloat(votingSettings.requiredAmount) <= 0) {
        settingsErrors.amount = "Token amount must be greater than 0"
        errorTab = "settings"
      }
    }

    // Validate payment amount
    if (votingSettings.paymentAmount && Number.parseFloat(votingSettings.paymentAmount) < 0) {
      settingsErrors.amount = "Payment amount cannot be negative"
      errorTab = "settings"
    }

    if (Object.keys(settingsErrors).length > 0) {
      newErrors.votingSettings = settingsErrors
    }

    // Check wallet connection
    if (!wallet.connected) {
      uiToast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a vote",
        variant: "destructive",
      })
      return false
    }

    setErrors(newErrors)

    // If there are errors, navigate to the tab with errors
    if (Object.keys(newErrors).length > 0 && errorTab) {
      setActiveTab(errorTab)

      // If the error is in a specific poll, navigate to that poll
      if (errorTab === "polls" && newErrors.polls) {
        const errorPollIndex = polls.findIndex((poll) => newErrors.polls?.[poll.id])
        if (errorPollIndex !== -1) {
          setActivePollIndex(errorPollIndex)
        }
      }

      return false
    }

    return true
  }

  const addMediaToOption = (mediaHandlers: any, pollIndex: number, optionIndex: number) => {
    setActiveMediaOption({ poll: pollIndex, option: optionIndex });
    setMediaUploadDialogOpen(true);
  };

  const handleMediaFileSelect = (mediaHandlers: any, file: File) => {
    try {
      // Add the file to the media handler and get the file ID
      const fileId = mediaHandlers.addMediaFile(file);
      
      const { poll, option } = activeMediaOption;
      if (poll !== null && option !== null) {
        const newPolls = [...polls];
        
        // Use the dataUrl for preview, and store the fileId for reference
        const mediaFile = mediaHandlers.mediaFiles.find((f: any) => f.id === fileId);
        if (mediaFile && mediaFile.dataUrl) {
          newPolls[poll].options[option].mediaUrl = mediaFile.dataUrl;
          newPolls[poll].options[option].fileId = fileId;
          setPolls(newPolls);
          
          // Close the dialog automatically after successful selection
          setMediaUploadDialogOpen(false);
          toast.success("Media added successfully");
        } else {
          toast.error("Failed to process media file");
        }
      } else {
        toast.error("No poll option selected for media");
        setMediaUploadDialogOpen(false);
      }
    } catch (error) {
      console.error("Error adding media file:", error);
      toast.error("Failed to add media file");
    }
  };

  const removeMediaFromOption = (mediaHandlers: any, pollIndex: number, optionIndex: number) => {
    try {
      const newPolls = [...polls];
      const fileId = newPolls[pollIndex].options[optionIndex].fileId;
      
      if (fileId) {
        // Remove the file from the media handler
        mediaHandlers.removeMediaFile(fileId);
      }
      
      // Clear the media URL and file ID from the poll option
      newPolls[pollIndex].options[optionIndex].mediaUrl = null;
      newPolls[pollIndex].options[optionIndex].fileId = null;
      setPolls(newPolls);
      
      toast.success("Media removed successfully");
    } catch (error) {
      console.error("Error removing media file:", error);
      toast.error("Failed to remove media file");
    }
  };

  // Update your handleSubmit function to use the media handler
  const handleSubmit = async (mediaHandlers: any) => {
    try {
      if (!validateForm()) {
        // Scroll to the error alert if present
        setTimeout(() => {
          const errorAlert = document.querySelector('[role="alert"]')
          if (errorAlert) {
            errorAlert.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        }, 100);
        return;
      }

      if (!wallet.connected) {
        toast.error("Wallet not connected", {
          description: "Please connect your wallet to create a vote",
        });
        return;
      }

      // Reset states
      setTransactionError(null);
      setTxStatus(TransactionStatus.BUILDING);
      setTxStatusDialogOpen(true);

      // Convert poll data to the format expected by the service
      const pollData = polls.map((poll) => ({
        title: poll.title,
        description: poll.description,
        isMultiSelect: poll.isMultiSelect,
        maxSelections: poll.maxSelections,
        isRequired: poll.isRequired,
        options: poll.options.map((option) => ({
          text: option.text,
          mediaUrl: option.mediaUrl || undefined,
        })),
      }));

      // Create the combined transaction
      console.log("Creating vote transaction with media...");
      setTxStatus(TransactionStatus.BUILDING);
      console.log(votingSettings.paymentAmount);
      
      const transaction = await mediaHandlers.createVoteWithMedia({
        voteTitle,
        voteDescription,
        startDate: votingSettings.startDate,
        endDate: votingSettings.endDate,
        requiredToken: votingSettings.requiredToken !== "none" ? votingSettings.requiredToken : "",
        requiredAmount: votingSettings.requiredAmount || "0",
        paymentAmount: votingSettings.paymentAmount || "0",
        requireAllPolls: votingSettings.requireAllPolls,
        polls: pollData,
        onSuccess: (voteId) => {
          console.log("Vote created successfully with ID:", voteId);
        }
      });

      console.log("Transaction prepared successfully, executing transaction...");
      setTxStatus(TransactionStatus.SIGNING);

      // Execute the transaction
      const result = await transaction.execute();

      console.log("Transaction executed successfully:", result);
      setTxStatus(TransactionStatus.EXECUTING);
      setTxDigest(result.digest);

      // Wait for confirmation (simulate with timeout in this example)
      setTxStatus(TransactionStatus.CONFIRMING);

      // Simulate waiting for confirmation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Transaction confirmed
      setTxStatus(TransactionStatus.SUCCESS);

      // Show success message
      toast.success("Vote created successfully!", {
        description: "Your vote has been published to the blockchain",
      });

      // Wait a moment to show the success state before redirecting
      setTimeout(() => {
        // Navigate to success page with vote data
        router.push(`/success?digest=${result.digest}${result.voteId ? `&voteId=${result.voteId}` : ''}`);
      }, 1500);
    } catch (err) {
      console.error("Error creating vote:", err);

      // Extract error message
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while creating the vote";

      setTransactionError(errorMessage);
      setTxStatus(TransactionStatus.ERROR);

      toast.error("Failed to create vote", {
        description: errorMessage,
      });
    }
  };

  

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

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  }

  const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  return (
    <VoteMediaHandler>
      {(mediaHandlers) => (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} className="container max-w-7xl py-6 px-4 md:px-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight truncate">{voteTitle ? voteTitle : "Create New Vote"}</h1>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link href="/polls" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto sm:text-base sm:px-6 sm:py-2 sm:h-10 transition-all hover:scale-105"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Environment Variable Error Alert */}
      <AnimatePresence mode="wait">
        {errors.environment && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Configuration Error</AlertTitle>
              <AlertDescription>{errors.environment}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Error Alert */}
      <AnimatePresence mode="wait">
        {errors.title && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert variant="destructive" role="alert">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.title}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Sticky tab navigation - visible on all screen sizes */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="sticky top-14 md:top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3"
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger
              value="details"
              className="flex items-center gap-2 transition-all data-[state=active]:scale-105"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
              <span className="sm:hidden">Details</span>
            </TabsTrigger>
            <TabsTrigger value="polls" className="flex items-center gap-2 transition-all data-[state=active]:scale-105">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Polls</span>
              <span className="sm:hidden">Polls</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center gap-2 transition-all data-[state=active]:scale-105"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <motion.div variants={slideUp} className="w-full md:w-64 lg:w-72 flex-shrink-0">
            <div className="md:sticky md:top-32">
              <Card className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  {activeTab === "polls" && (
                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">Poll List</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs transition-all hover:scale-110"
                          onClick={addPoll}
                        >
                          <PlusCircle className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                        {polls.map((poll, index) => (
                          <div key={poll.id} className="flex items-center">
                            <Button
                              variant={activePollIndex === index ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "w-full justify-start text-left h-8 text-xs transition-all",
                                activePollIndex === index && "bg-muted",
                              )}
                              onClick={() => setActivePollIndex(index)}
                            >
                              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-muted-foreground/10 text-xs mr-2">
                                {index + 1}
                              </span>
                              {poll.title
                                ? poll.title.length > 20
                                  ? poll.title.substring(0, 20) + "..."
                                  : poll.title
                                : `Poll ${index + 1}`}
                            </Button>
                            {polls.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 ml-1 text-muted-foreground hover:text-destructive transition-colors"
                                onClick={() => removePoll(index)}
                              >
                                <X className="h-3.5 w-3.5" />
                                <span className="sr-only">Remove poll</span>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress indicator */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{activeTab === "details" ? "1" : activeTab === "polls" ? "2" : "3"}/3</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: activeTab === "details" ? "33%" : activeTab === "polls" ? "66%" : "100%" }}
                        animate={{ width: activeTab === "details" ? "33%" : activeTab === "polls" ? "66%" : "100%" }}
                        transition={{ duration: 0.5 }}
                        className="bg-primary h-full"
                      ></motion.div>
                    </div>
                  </div>

                  {/* Quick tips */}
                  <div className="mt-6 p-3 bg-muted/30 rounded-lg">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary" />
                      Tips
                    </h3>
                    <ul className="text-xs space-y-2 text-muted-foreground">
                      <li className="flex gap-2">
                        <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span>Keep poll questions clear and concise</span>
                      </li>
                      <li className="flex gap-2">
                        <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span>Add images to make options more engaging</span>
                      </li>
                      <li className="flex gap-2">
                        <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                        <span>Set a reasonable voting timeframe</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Main content area */}
          <motion.div variants={slideUp} className="flex-1">
            <TabsContent value="details" className="mt-0">
              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl">Vote Details</CardTitle>
                  <CardDescription>Create a new vote with multiple polls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-base font-medium">
                      Vote Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="Enter a title for this vote"
                      value={voteTitle}
                      onChange={(e) => setVoteTitle(e.target.value)}
                      className={cn(
                        "h-12 transition-all focus:scale-[1.01]",
                        errors.title && "border-red-500 focus-visible:ring-red-500",
                      )}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-base font-medium">
                      Vote Description
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Provide context or additional information about this vote"
                      value={voteDescription}
                      onChange={(e) => setVoteDescription(e.target.value)}
                      className="min-h-[150px] resize-none transition-all focus:scale-[1.01]"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end p-4">
                  <Button onClick={() => setActiveTab("polls")} className="transition-all hover:scale-105">
                    Continue to Polls
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="polls" className="mt-0">
              {/* Update the error alert in the polls tab to include role="alert" for accessibility */}

              <AnimatePresence mode="wait">
                {errors.polls && Object.keys(errors.polls).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4"
                  >
                    <Alert variant="destructive" role="alert">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Please fix the errors in your polls</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {polls.length > 0 && (
                <Card className="transition-all hover:shadow-md">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-xl">
                        Poll {activePollIndex + 1} of {polls.length}
                      </CardTitle>
                      <CardDescription>{polls[activePollIndex].title || "Untitled Poll"}</CardDescription>
                    </div>
                    {polls.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePoll(activePollIndex)}
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 transition-all hover:scale-110"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4 space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor={`poll-title-${activePollIndex}`} className="text-base font-medium">
                        Poll Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`poll-title-${activePollIndex}`}
                        placeholder="Enter poll question"
                        value={polls[activePollIndex].title}
                        onChange={(e) => updatePollTitle(activePollIndex, e.target.value)}
                        className={cn(
                          "h-12 transition-all focus:scale-[1.01]",
                          errors.polls?.[polls[activePollIndex].id]?.title &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                        required
                      />
                      {errors.polls?.[polls[activePollIndex].id]?.title && (
                        <p className="text-sm text-red-500 mt-1">{errors.polls[polls[activePollIndex].id].title}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`poll-description-${activePollIndex}`} className="text-base font-medium">
                        Poll Description (Optional)
                      </Label>
                      <Textarea
                        id={`poll-description-${activePollIndex}`}
                        placeholder="Provide additional context for this poll"
                        value={polls[activePollIndex].description}
                        onChange={(e) => updatePollDescription(activePollIndex, e.target.value)}
                        className="min-h-[80px] resize-none transition-all focus:scale-[1.01]"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-medium">Selection Type</Label>
                      <RadioGroup
                        value={polls[activePollIndex].isMultiSelect ? "multi" : "single"}
                        onValueChange={(value) => updatePollType(activePollIndex, value === "multi")}
                        className="flex flex-col sm:flex-row gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="single" id={`single-select-${activePollIndex}`} />
                          <Label htmlFor={`single-select-${activePollIndex}`}>Single Select (Radio Buttons)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="multi" id={`multi-select-${activePollIndex}`} />
                          <Label htmlFor={`multi-select-${activePollIndex}`}>Multi Select (Checkboxes)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {polls[activePollIndex].isMultiSelect && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 p-4 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`max-selections-${activePollIndex}`} className="text-base font-medium">
                            Maximum Selections Allowed
                          </Label>
                          <span className="text-sm font-medium">
                            {polls[activePollIndex].maxSelections} of {polls[activePollIndex].options.length}
                          </span>
                        </div>
                        <Slider
                          id={`max-selections-${activePollIndex}`}
                          min={1}
                          max={Math.max(1, polls[activePollIndex].options.length - 1)}
                          step={1}
                          value={[polls[activePollIndex].maxSelections]}
                          onValueChange={(value) => updateMaxSelections(activePollIndex, value[0])}
                        />
                        <p className="text-sm text-muted-foreground">
                          Voters can select up to {polls[activePollIndex].maxSelections} option
                          {polls[activePollIndex].maxSelections !== 1 ? "s" : ""}
                        </p>

                        {errors.polls?.[polls[activePollIndex].id]?.maxSelections && (
                          <p className="text-sm text-red-500">
                            {errors.polls[polls[activePollIndex].id].maxSelections}
                          </p>
                        )}
                      </motion.div>
                    )}

                    {!votingSettings.requireAllPolls && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor={`required-poll-${activePollIndex}`} className="text-base">
                            Required Poll
                          </Label>
                          <p className="text-sm text-muted-foreground">Voters must answer this poll</p>
                        </div>
                        <Switch
                          id={`required-poll-${activePollIndex}`}
                          checked={polls[activePollIndex].isRequired}
                          onCheckedChange={(checked) => updatePollRequired(activePollIndex, checked)}
                        />
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Poll Options</Label>
                        <span className="text-sm text-muted-foreground">Minimum 2 options required</span>
                      </div>

                      {errors.polls?.[polls[activePollIndex].id]?.options && (
                        <p className="text-sm text-red-500">{errors.polls[polls[activePollIndex].id].options}</p>
                      )}

                      <div className="space-y-3">
                        {polls[activePollIndex].options.map((option, optionIndex) => (
                          <motion.div
                            key={option.id}
                            className="border rounded-lg p-3"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 flex items-center justify-center text-muted-foreground font-medium text-sm border rounded">
                                {optionIndex + 1}
                              </div>
                              <Input
                                placeholder={`Option ${optionIndex + 1}`}
                                value={option.text}
                                onChange={(e) => updateOption(activePollIndex, optionIndex, e.target.value)}
                                className={cn(
                                  "h-12 transition-all focus:scale-[1.01]",
                                  errors.polls?.[polls[activePollIndex].id]?.optionTexts?.[optionIndex] &&
                                    "border-red-500 focus-visible:ring-red-500",
                                )}
                                required
                              />
                              {polls[activePollIndex].options.length > 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOption(activePollIndex, optionIndex)}
                                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 flex-shrink-0 transition-all hover:scale-110"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              )}
                            </div>
                            {errors.polls?.[polls[activePollIndex].id]?.optionTexts?.[optionIndex] && (
                              <p className="text-sm text-red-500 mt-1">
                                {errors.polls[polls[activePollIndex].id].optionTexts?.[optionIndex]}
                              </p>
                            )}

{option.mediaUrl ? (
            <div className="relative mt-2 rounded-md overflow-hidden">
              <img
                src={option.mediaUrl}
                alt={`Media for ${option.text || `Option ${optionIndex + 1}`}`}
                className="w-full h-auto max-h-[200px] object-contain rounded-md"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 transition-all hover:scale-105"
                onClick={() => removeMediaFromOption(mediaHandlers, activePollIndex, optionIndex)}
              >
                Remove Media
              </Button>
              {option.fileId && mediaHandlers.uploadProgress[option.fileId] > 0 && mediaHandlers.uploadProgress[option.fileId] < 100 && (
                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                  <Progress value={mediaHandlers.uploadProgress[option.fileId]} className="w-3/4 h-2" />
                  <p className="text-xs mt-2">{mediaHandlers.uploadProgress[option.fileId]}% ready</p>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-2 transition-all hover:scale-105"
              onClick={() => addMediaToOption(mediaHandlers, activePollIndex, optionIndex)}
            >
              <ImageIcon className="h-4 w-4" />
              Add Media
            </Button>
          )}
          
                          </motion.div>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => addOption(activePollIndex)}
                        className="w-full h-12 border-dashed transition-all hover:bg-muted/50"
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Option
                      </Button>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between p-4">
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
                        <span className="sr-only">Previous poll</span>
                      </Button>
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
                        <span className="sr-only">Next poll</span>
                      </Button>
                      <span className="text-xs text-muted-foreground ml-1">Navigate between polls</span>
                    </div>
                    <Button onClick={() => setActiveTab("settings")} className="gap-2 transition-all hover:scale-105">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <Card className="transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-2xl">Voting Settings</CardTitle>
                    <CardDescription>Configure how voting works for this poll</CardDescription>
                  </div>
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Voting Timeframe */}
                    <div className="md:col-span-2 space-y-4">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Voting Timeframe <span className="text-red-500">*</span>
                      </Label>

                      <AnimatePresence mode="wait">
                        {errors.votingSettings?.dates && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                          >
                            <p className="text-sm text-red-500">{errors.votingSettings.dates}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DateTimePicker
        id="start-date"
        value={startDate}
        onChange={(date) => {
          setStartDate(date);
          setVotingSettings(prev => ({
            ...prev,
            startDate: date
          }));
        }}
        label="Start date and time"
      />
      
      <DateTimePicker
        id="end-date"
        value={endDate}
        onChange={(date) => {
          setEndDate(date);
          setVotingSettings(prev => ({
            ...prev,
            endDate: date
          }));
        }}
        label="End date and time"
      />
                      </div>
                    </div>

                    {/* Token Requirements */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Token Requirements
                      </Label>
                      <div className="space-y-4">
                        <TokenSelector
                          value={votingSettings.requiredToken}
                          onValueChange={(value) => setVotingSettings({ ...votingSettings, requiredToken: value })}
                          onAmountChange={(amount) => setVotingSettings({ ...votingSettings, requiredAmount: amount })}
                          amount={votingSettings.requiredAmount}
                          error={errors.votingSettings?.token}
                          required={false}
                        />
                      </div>
                    </div>

                    {/* Payment Amount */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Payment Amount
                      </Label>
                      <div>
                        <Label htmlFor="payment-amount" className="text-sm">
                          Amount to Pay by Voter
                        </Label>
                        <div className="flex items-center">
                          <Input
                            id="payment-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={votingSettings.paymentAmount}
                            onChange={(e) => setVotingSettings({ ...votingSettings, paymentAmount: e.target.value })}
                            className={cn(
                              "h-10 transition-all focus:scale-[1.01]",
                              errors.votingSettings?.amount && "border-red-500 focus-visible:ring-red-500",
                            )}
                          />
                          <div className="ml-2 text-sm font-medium">
                            <Coins className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Amount in SUI that voters need to pay to participate (0 for free voting)
                        </p>
                        {errors.votingSettings?.amount && (
                          <p className="text-sm text-red-500 mt-1">{errors.votingSettings.amount}</p>
                        )}
                      </div>
                    </div>

                    {/* General Settings */}
                    <div className="md:col-span-2 space-y-6 p-4 bg-muted/30 rounded-lg">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        General Settings
                      </Label>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="require-all-polls" className="text-base">
                            Require voters to answer all polls
                          </Label>
                          <p className="text-sm text-muted-foreground">Voters must complete every poll to submit</p>
                        </div>
                        <Switch
                          id="require-all-polls"
                          checked={votingSettings.requireAllPolls}
                          onCheckedChange={(checked) => {
                            setVotingSettings({ ...votingSettings, requireAllPolls: checked })
                            // If requiring all polls, set all polls to required
                            if (checked) {
                              const newPolls = [...polls]
                              newPolls.forEach((poll) => (poll.isRequired = true))
                              setPolls(newPolls)
                            }
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="live-stats" className="text-base">
                            Show live voting statistics
                          </Label>
                          <p className="text-sm text-muted-foreground">Voters can see results before the vote closes</p>
                        </div>
                        <Switch
                          id="live-stats"
                          checked={showLiveStats}
                          onCheckedChange={(checked) => {
                            setShowLiveStats(checked)
                            setVotingSettings({ ...votingSettings, showLiveStats: checked })
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between p-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full h-8 w-8 transition-all hover:scale-110"
                    onClick={() => setActiveTab("polls")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {/* Update your submit button to use the media handlers */}
          {/* Find the button that calls handleSubmit and replace with: */}
          <Button 
            size="lg" 
            className="gap-2 transition-all hover:scale-105" 
            onClick={() => handleSubmit(mediaHandlers)}
            disabled={txStatus !== TransactionStatus.IDLE && txStatus !== TransactionStatus.ERROR}
          >
            {txStatus !== TransactionStatus.IDLE && txStatus !== TransactionStatus.ERROR ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Vote...
              </>
            ) : (
              <>
                Create Vote
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
                </CardFooter>
              </Card>

              {/* Preview Card */}
              <Card className="mt-6 border-dashed transition-all hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Vote Preview</CardTitle>
                  <CardDescription>How your vote will appear to participants</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border p-4 bg-muted/20">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-semibold text-lg">{voteTitle || "Untitled Vote"}</h3>
                      <p className="text-sm text-muted-foreground">{voteDescription || "No description provided"}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
                        </Badge>

                        {votingSettings.requiredToken !== "none" && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Requires {votingSettings.requiredToken.toUpperCase()}
                          </Badge>
                        )}

                        {Number(votingSettings.paymentAmount) > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Payment: {votingSettings.paymentAmount} SUI
                          </Badge>
                        )}

                        {showLiveStats && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                            <BarChart2 className="h-3 w-3 mr-1" />
                            Live Results
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </div>
      </Tabs>

      {/* Transaction Status Dialog */}
      <Dialog open={txStatusDialogOpen} onOpenChange={setTxStatusDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {txStatus === TransactionStatus.SUCCESS
                ? "Vote Created Successfully!"
                : txStatus === TransactionStatus.ERROR
                  ? "Error Creating Vote"
                  : "Creating Vote"}
            </DialogTitle>
            <DialogDescription>
              {txStatus === TransactionStatus.SUCCESS
                ? "Your vote has been published to the blockchain."
                : txStatus === TransactionStatus.ERROR
                  ? "There was an error creating your vote."
                  : "Please wait while we create your vote on the blockchain."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Progress value={txProgress} className="h-2 w-full" />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {txStatus === TransactionStatus.BUILDING || txStatus === TransactionStatus.IDLE ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  Building Transaction
                </span>
                <span className="text-muted-foreground">Step 1/4</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {txStatus === TransactionStatus.SIGNING ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : txStatus > TransactionStatus.SIGNING ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  Signing Transaction
                </span>
                <span className="text-muted-foreground">Step 2/4</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {txStatus === TransactionStatus.EXECUTING ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : txStatus > TransactionStatus.EXECUTING ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  Executing Transaction
                </span>
                <span className="text-muted-foreground">Step 3/4</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {txStatus === TransactionStatus.CONFIRMING ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : txStatus > TransactionStatus.CONFIRMING ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  Confirming Transaction
                </span>
                <span className="text-muted-foreground">Step 4/4</span>
              </div>
            </div>

            {txStatus === TransactionStatus.ERROR && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{transactionError}</AlertDescription>
              </Alert>
            )}

            {txDigest && (
              <div className="pt-2">
                <Label className="text-sm">Transaction ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="bg-muted p-2 rounded text-xs w-full overflow-x-auto">{txDigest}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => window.open(getTransactionExplorerUrl(), "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {txStatus === TransactionStatus.ERROR ? (
              <Button
                variant="default"
                onClick={() => {
                  setTxStatusDialogOpen(false)
                  setTxStatus(TransactionStatus.IDLE)
                }}
              >
                Try Again
              </Button>
            ) : txStatus === TransactionStatus.SUCCESS ? (
              <Button variant="default" onClick={() => router.push(`/success?digest=${txDigest}`)}>
                View Vote
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setTxStatusDialogOpen(false)}
                disabled={txStatus !== TransactionStatus.ERROR && txStatus !== TransactionStatus.SUCCESS}
              >
                Close
              </Button>
            )}

            {txDigest && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(getTransactionExplorerUrl(), "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                View in Explorer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add this dialog for media upload */}
      <Dialog open={mediaUploadDialogOpen} onOpenChange={setMediaUploadDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Upload Media</DialogTitle>
      <DialogDescription>
        Add an image to enhance your poll option.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <MediaFileUploader 
        onFileSelect={(file) => {
          if (file) {
            handleMediaFileSelect(mediaHandlers, file);
          }
        }}
        disabled={mediaHandlers.loading}
      />
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setMediaUploadDialogOpen(false)}>
        Cancel
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </motion.div>
      )}
    </VoteMediaHandler>
  )
}
