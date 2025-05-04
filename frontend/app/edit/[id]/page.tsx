"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  PlusCircle,
  Trash2,
  Calendar,
  ImageIcon,
  Coins,
  Wallet,
  AlertCircle,
  Lock,
  CheckCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Save,
  BarChart2,
  Info,
  ArrowRight,
  FileText,
  ListChecks,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { format, isAfter, addDays } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

// Sample token data
const suiTokens = [
  { id: "sui", name: "SUI", icon: <img src="/images/sui-logo.png" alt="SUI" className="h-4 w-4" /> },
  { id: "usdc", name: "USDC", icon: "💲" },
  { id: "eth", name: "ETH", icon: "💠" },
  { id: "btc", name: "BTC", icon: "🔶" },
  { id: "apt", name: "APT", icon: "🔹" },
]

// Sample vote data for editing
const sampleVoteData = {
  id: "1",
  title: "Q2 Team Feedback",
  description: "Quarterly feedback survey for team performance and satisfaction",
  hasVotes: true, // Flag to indicate if the vote has been voted on
  voteCount: 24,
  created: "Jan 1, 2024",
  polls: [
    {
      id: "poll-1",
      title: "How satisfied are you with the current project management process?",
      description: "Please rate your satisfaction with our Agile workflow and tools.",
      isMultiSelect: false,
      isRequired: true,
      options: [
        { id: "option-1-1", text: "Very satisfied", mediaUrl: null },
        { id: "option-1-2", text: "Satisfied", mediaUrl: null },
        { id: "option-1-3", text: "Neutral", mediaUrl: null },
        { id: "option-1-4", text: "Dissatisfied", mediaUrl: null },
        { id: "option-1-5", text: "Very dissatisfied", mediaUrl: null },
      ],
      maxSelections: 1,
    },
    {
      id: "poll-2",
      title: "Which team-building activities would you prefer?",
      description: "Select all activities you would be interested in participating in (max 3).",
      isMultiSelect: true,
      maxSelections: 3,
      isRequired: false,
      options: [
        {
          id: "option-2-1",
          text: "Outdoor adventure (hiking, kayaking, etc.)",
          mediaUrl: "/placeholder.svg?height=200&width=200",
        },
        { id: "option-2-2", text: "Cooking class or food tasting", mediaUrl: "/placeholder.svg?height=200&width=200" },
        { id: "option-2-3", text: "Escape room or puzzle-solving", mediaUrl: null },
        { id: "option-2-4", text: "Sports tournament (basketball, volleyball, etc.)", mediaUrl: null },
        { id: "option-2-5", text: "Virtual game night", mediaUrl: null },
      ],
    },
  ],
  votingSettings: {
    requiredToken: "sui",
    requiredAmount: "10",
    paymentAmount: "1",
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
    requireAllPolls: true,
    showLiveStats: true,
  },
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
    }
  }
  votingSettings?: {
    dates?: string
    token?: string
  }
}

export default function EditVotePage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params

  const [voteTitle, setVoteTitle] = useState("")
  const [voteDescription, setVoteDescription] = useState("")
  const [polls, setPolls] = useState<PollType[]>([])
  const [votingSettings, setVotingSettings] = useState<VotingSettings>({
    requiredToken: "none",
    requiredAmount: "",
    paymentAmount: "0",
    startDate: new Date(),
    endDate: addDays(new Date(), 7),
    requireAllPolls: true,
    showLiveStats: false,
  })
  const [hasVotes, setHasVotes] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("details")
  const [activePollIndex, setActivePollIndex] = useState(0)
  const [showLiveStats, setShowLiveStats] = useState(false)

  // Load vote data
  useEffect(() => {
    // In a real app, fetch the vote data based on the ID
    // For now, we'll just use the sample data
    setVoteTitle(sampleVoteData.title)
    setVoteDescription(sampleVoteData.description)
    setPolls(sampleVoteData.polls)
    setVotingSettings(sampleVoteData.votingSettings)
    setHasVotes(sampleVoteData.hasVotes)
    setVoteCount(sampleVoteData.voteCount)
    setShowLiveStats(sampleVoteData.votingSettings.showLiveStats)
    setLoading(false)

    // Update document title and metadata
    if (!loading && voteTitle) {
      document.title = `Edit: ${voteTitle} - SuiVote`

      // Create meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute("content", `Edit vote: ${voteTitle}`)
      } else {
        const meta = document.createElement("meta")
        meta.name = "description"
        meta.content = `Edit vote: ${voteTitle}`
        document.head.appendChild(meta)
      }
    }
  }, [loading, voteTitle])

  // Update the addPoll function to use timestamp-based unique ID
  const addPoll = () => {
    if (hasVotes) return // Prevent adding polls if vote has votes

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
    if (hasVotes) return // Prevent removing polls if vote has votes

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
    if (hasVotes) return // Prevent updating poll title if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].title = title
    setPolls(newPolls)
  }

  const updatePollDescription = (pollIndex: number, description: string) => {
    if (hasVotes) return // Prevent updating poll description if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].description = description
    setPolls(newPolls)
  }

  const updatePollType = (pollIndex: number, isMultiSelect: boolean) => {
    if (hasVotes) return // Prevent updating poll type if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].isMultiSelect = isMultiSelect
    newPolls[pollIndex].maxSelections = isMultiSelect ? newPolls[pollIndex].options.length - 1 : 1
    setPolls(newPolls)
  }

  const updateMaxSelections = (pollIndex: number, maxSelections: number) => {
    if (hasVotes) return // Prevent updating max selections if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].maxSelections = maxSelections
    setPolls(newPolls)
  }

  const updatePollRequired = (pollIndex: number, isRequired: boolean) => {
    if (hasVotes) return // Prevent updating poll required if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].isRequired = isRequired
    setPolls(newPolls)
  }

  // Update the addOption function to use timestamp-based unique IDs
  const addOption = (pollIndex: number) => {
    if (hasVotes) return // Prevent adding options if vote has votes

    const timestamp = Date.now()
    const newPolls = [...polls]
    const newOptionId = `option-${timestamp}-${newPolls[pollIndex].options.length + 1}`
    newPolls[pollIndex].options.push({ id: newOptionId, text: "", mediaUrl: null })
    setPolls(newPolls)
  }

  const removeOption = (pollIndex: number, optionIndex: number) => {
    if (hasVotes) return // Prevent removing options if vote has votes

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
    if (hasVotes) return // Prevent updating options if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].options[optionIndex].text = text
    setPolls(newPolls)
  }

  const addMediaToOption = (pollIndex: number, optionIndex: number) => {
    if (hasVotes) return // Prevent adding media if vote has votes

    // Simulate adding media - in a real app, this would open a file picker
    const newPolls = [...polls]
    newPolls[pollIndex].options[optionIndex].mediaUrl = "/placeholder.svg?height=200&width=200"
    setPolls(newPolls)
  }

  const removeMediaFromOption = (pollIndex: number, optionIndex: number) => {
    if (hasVotes) return // Prevent removing media if vote has votes

    const newPolls = [...polls]
    newPolls[pollIndex].options[optionIndex].mediaUrl = null
    setPolls(newPolls)
  }

  // Update the validateForm function to navigate to the tab with errors

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}
    let errorTab: string | null = null

    // Validate vote title
    if (!voteTitle.trim()) {
      newErrors.title = "Vote title is required"
      errorTab = "details"
    }

    // Only validate polls if the vote doesn't have votes yet
    if (!hasVotes) {
      // Validate polls
      const pollErrors: ValidationErrors["polls"] = {}

      polls.forEach((poll, index) => {
        const pollError: { title?: string; options?: string; optionTexts?: string[] } = {}

        if (!poll.title.trim()) {
          pollError.title = "Poll title is required"
          errorTab = "polls"
        }

        const emptyOptions = poll.options.filter((option) => !option.text.trim())
        if (emptyOptions.length > 0) {
          pollError.options = "All options must have text"
          pollError.optionTexts = poll.options.map((option) => (option.text.trim() ? "" : "Option text is required"))
          errorTab = "polls"
        }

        if (Object.keys(pollError).length > 0) {
          pollErrors[poll.id] = pollError
        }
      })

      if (Object.keys(pollErrors).length > 0) {
        newErrors.polls = pollErrors
      }
    }

    // Validate voting settings
    const settingsErrors: { dates?: string; token?: string } = {}

    if (votingSettings.startDate && votingSettings.endDate) {
      if (!isAfter(votingSettings.endDate, votingSettings.startDate)) {
        settingsErrors.dates = "End date must be after start date"
        errorTab = "settings"
      }
    } else if (!votingSettings.startDate || !votingSettings.endDate) {
      settingsErrors.dates = "Both start and end dates are required"
      errorTab = "settings"
    }

    if (votingSettings.requiredToken && votingSettings.requiredToken !== "none" && !votingSettings.requiredAmount) {
      settingsErrors.token = "Token amount is required when a token is selected"
      errorTab = "settings"
    }

    if (Object.keys(settingsErrors).length > 0) {
      newErrors.votingSettings = settingsErrors
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

  // Update the handleSubmit function to scroll to the error alert if present
  const handleSubmit = async () => {
    if (validateForm()) {
      setIsSubmitting(true)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Show success message
      setSuccessMessage("Vote updated successfully!")
      setIsSubmitting(false)

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null)
        router.push("/dashboard")
      }, 3000)
    } else {
      // Scroll to the error alert if present
      setTimeout(() => {
        const errorAlert = document.querySelector('[role="alert"]')
        if (errorAlert) {
          errorAlert.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 100)
    }
  }

  // Time selection handlers
  const handleHourChange = (type: "start" | "end", hour: string) => {
    if (type === "start") {
      const newDate = votingSettings.startDate ? new Date(votingSettings.startDate) : new Date()
      newDate.setHours(Number.parseInt(hour, 10))
      setVotingSettings({ ...votingSettings, startDate: newDate })
    } else {
      const newDate = votingSettings.endDate ? new Date(votingSettings.endDate) : new Date()
      newDate.setHours(Number.parseInt(hour, 10))
      setVotingSettings({ ...votingSettings, endDate: newDate })
    }
  }

  const handleMinuteChange = (type: "start" | "end", minute: string) => {
    if (type === "start") {
      const newDate = votingSettings.startDate ? new Date(votingSettings.startDate) : new Date()
      newDate.setMinutes(Number.parseInt(minute, 10))
      setVotingSettings({ ...votingSettings, startDate: newDate })
    } else {
      const newDate = votingSettings.endDate ? new Date(votingSettings.endDate) : new Date()
      newDate.setMinutes(Number.parseInt(minute, 10))
      setVotingSettings({ ...votingSettings, endDate: newDate })
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl py-6 px-4 md:px-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl py-6 px-4 md:px-6">
      {/* Header */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight truncate">Edit: {voteTitle}</h1>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="w-full sm:w-auto sm:text-base sm:px-6 sm:py-2 sm:h-10">
                Cancel
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Update the error alerts to include role="alert" for accessibility */}

      <AnimatePresence mode="wait">
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" role="alert">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">{successMessage}</AlertDescription>
            </Alert>
          </motion.div>
        )}

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

      {hasVotes && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <Lock className="h-4 w-4 text-amber-800 dark:text-amber-300" />
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              This vote has {voteCount} responses. You can only edit the vote title, description, and settings. Poll
              questions and options cannot be modified.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Sticky tab navigation - visible on all screen sizes */}
        <div className="sticky top-14 md:top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-6 -mx-4 px-4 py-3">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Details</span>
              <span className="sm:hidden">Details</span>
            </TabsTrigger>
            <TabsTrigger value="polls" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Polls</span>
              <span className="sm:hidden">Polls</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main tabs navigation */}
          <div className="w-full md:w-64 lg:w-72 flex-shrink-0">
            <div className="md:sticky md:top-32">
              <Card>
                <CardContent className="p-4">
                  <div className="pt-4 pb-2">{/* Tabs moved to the top sticky navigation */}</div>

                  {activeTab === "polls" && (
                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">Poll List</h3>
                        {!hasVotes && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addPoll}>
                            <PlusCircle className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                        {polls.map((poll, index) => (
                          <div key={poll.id} className="flex items-center">
                            <Button
                              variant={activePollIndex === index ? "secondary" : "ghost"}
                              size="sm"
                              className={cn(
                                "w-full justify-start text-left h-8 text-xs",
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
                            {!hasVotes && polls.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 ml-1 text-muted-foreground hover:text-destructive"
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

                  {/* Vote status */}
                  <div className="mt-6 p-3 bg-muted/30 rounded-lg">
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5 text-primary" />
                      Vote Status
                    </h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium">{sampleVoteData.created}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Responses:</span>
                        <span className="font-medium">{voteCount}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className="px-2 py-0 h-5 text-xs">
                          {hasVotes ? "Limited editing" : "Full editing"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            <TabsContent value="details" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Vote Details</CardTitle>
                  <CardDescription>Edit your vote details</CardDescription>
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
                      className={cn("h-12", errors.title && "border-red-500 focus-visible:ring-red-500")}
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
                      className="min-h-[150px] resize-none"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end p-4">
                  <Button onClick={() => setActiveTab("polls")}>
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-xl">
                        Poll {activePollIndex + 1} of {polls.length}
                      </CardTitle>
                      <CardDescription>{polls[activePollIndex].title || "Untitled Poll"}</CardDescription>
                    </div>
                    {!hasVotes && polls.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePoll(activePollIndex)}
                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
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
                          "h-12",
                          errors.polls?.[polls[activePollIndex].id]?.title &&
                            "border-red-500 focus-visible:ring-red-500",
                        )}
                        disabled={hasVotes}
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
                        className="min-h-[80px] resize-none"
                        disabled={hasVotes}
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-medium">Selection Type</Label>
                      <RadioGroup
                        value={polls[activePollIndex].isMultiSelect ? "multi" : "single"}
                        onValueChange={(value) => updatePollType(activePollIndex, value === "multi")}
                        className="flex flex-col sm:flex-row gap-4"
                        disabled={hasVotes}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="single" id={`single-select-${activePollIndex}`} disabled={hasVotes} />
                          <Label htmlFor={`single-select-${activePollIndex}`}>Single Select (Radio Buttons)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="multi" id={`multi-select-${activePollIndex}`} disabled={hasVotes} />
                          <Label htmlFor={`multi-select-${activePollIndex}`}>Multi Select (Checkboxes)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {polls[activePollIndex].isMultiSelect && (
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
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
                          disabled={hasVotes}
                        />
                        <p className="text-sm text-muted-foreground">
                          Voters can select up to {polls[activePollIndex].maxSelections} option
                          {polls[activePollIndex].maxSelections !== 1 ? "s" : ""}
                        </p>
                      </div>
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
                          disabled={hasVotes}
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
                          <div key={option.id} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 flex items-center justify-center text-muted-foreground font-medium text-sm border rounded">
                                {optionIndex + 1}
                              </div>
                              <Input
                                placeholder={`Option ${optionIndex + 1}`}
                                value={option.text}
                                onChange={(e) => updateOption(activePollIndex, optionIndex, e.target.value)}
                                className={cn(
                                  "h-12",
                                  errors.polls?.[polls[activePollIndex].id]?.optionTexts?.[optionIndex] &&
                                    "border-red-500 focus-visible:ring-red-500",
                                )}
                                disabled={hasVotes}
                                required
                              />
                              {!hasVotes && polls[activePollIndex].options.length > 2 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeOption(activePollIndex, optionIndex)}
                                  className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 flex-shrink-0"
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
                                  src={option.mediaUrl || "/placeholder.svg"}
                                  alt={`Media for ${option.text || `Option ${optionIndex + 1}`}`}
                                  className="w-full h-auto max-h-[200px] object-cover rounded-md"
                                />
                                {!hasVotes && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2"
                                    onClick={() => removeMediaFromOption(activePollIndex, optionIndex)}
                                  >
                                    Remove Media
                                  </Button>
                                )}
                              </div>
                            ) : (
                              !hasVotes && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 gap-2"
                                  onClick={() => addMediaToOption(activePollIndex, optionIndex)}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  Add Media
                                </Button>
                              )
                            )}
                          </div>
                        ))}
                      </div>

                      {!hasVotes && (
                        <Button
                          variant="outline"
                          onClick={() => addOption(activePollIndex)}
                          className="w-full h-12 border-dashed"
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Option
                        </Button>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between p-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full h-8 w-8"
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
                        className="rounded-full h-8 w-8"
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
                    <Button onClick={() => setActiveTab("settings")} className="gap-2">
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <Card>
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
                        <div className="space-y-2">
                          <Label htmlFor="start-date" className="text-sm">
                            Start Date & Time <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !votingSettings.startDate && "text-muted-foreground",
                                    errors.votingSettings?.dates && "border-red-500 focus-visible:ring-red-500",
                                  )}
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {votingSettings.startDate ? format(votingSettings.startDate, "PPP") : "Select date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={votingSettings.startDate}
                                  onSelect={(date) => {
                                    if (date) {
                                      // Preserve time if already set
                                      const newDate = new Date(date)
                                      if (votingSettings.startDate) {
                                        newDate.setHours(
                                          votingSettings.startDate.getHours(),
                                          votingSettings.startDate.getMinutes(),
                                        )
                                      } else {
                                        // Default to current time
                                        const now = new Date()
                                        newDate.setHours(now.getHours(), now.getMinutes())
                                      }
                                      setVotingSettings({ ...votingSettings, startDate: newDate })
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>

                            <div className="flex items-center gap-2">
                              <Select
                                value={votingSettings.startDate?.getHours().toString() || ""}
                                onValueChange={(hour) => handleHourChange("start", hour)}
                              >
                                <SelectTrigger className="w-[70px] h-10">
                                  <SelectValue placeholder="Hour" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                                    <SelectItem key={hour} value={hour.toString()}>
                                      {hour.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={votingSettings.startDate?.getMinutes().toString() || ""}
                                onValueChange={(minute) => handleMinuteChange("start", minute)}
                              >
                                <SelectTrigger className="w-[70px] h-10">
                                  <SelectValue placeholder="Min" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 15, 30, 45].map((minute) => (
                                    <SelectItem key={minute} value={minute.toString()}>
                                      {minute.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-date" className="text-sm">
                            End Date & Time <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !votingSettings.endDate && "text-muted-foreground",
                                    errors.votingSettings?.dates && "border-red-500 focus-visible:ring-red-500",
                                  )}
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {votingSettings.endDate ? format(votingSettings.endDate, "PPP") : "Select date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={votingSettings.endDate}
                                  onSelect={(date) => {
                                    if (date) {
                                      // Preserve time if already set
                                      const newDate = new Date(date)
                                      if (votingSettings.endDate) {
                                        newDate.setHours(
                                          votingSettings.endDate.getHours(),
                                          votingSettings.endDate.getMinutes(),
                                        )
                                      } else {
                                        // Default to end of day
                                        newDate.setHours(23, 59, 59)
                                      }
                                      setVotingSettings({ ...votingSettings, endDate: newDate })
                                    }
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>

                            <div className="flex items-center gap-2">
                              <Select
                                value={votingSettings.endDate?.getHours().toString() || ""}
                                onValueChange={(hour) => handleHourChange("end", hour)}
                              >
                                <SelectTrigger className="w-[70px] h-10">
                                  <SelectValue placeholder="Hour" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                                    <SelectItem key={hour} value={hour.toString()}>
                                      {hour.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Select
                                value={votingSettings.endDate?.getMinutes().toString() || ""}
                                onValueChange={(minute) => handleMinuteChange("end", minute)}
                              >
                                <SelectTrigger className="w-[70px] h-10">
                                  <SelectValue placeholder="Min" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 15, 30, 45].map((minute) => (
                                    <SelectItem key={minute} value={minute.toString()}>
                                      {minute.toString().padStart(2, "0")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Token Requirements */}
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <Label className="text-base font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Token Requirements
                      </Label>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="required-token" className="text-sm">
                            Required Token
                          </Label>
                          <Select
                            id="required-token"
                            value={votingSettings.requiredToken}
                            onValueChange={(value) => setVotingSettings({ ...votingSettings, requiredToken: value })}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="No Token Required" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Token Required</SelectItem>
                              {suiTokens.map((token) => (
                                <SelectItem key={token.id} value={token.id}>
                                  {token.icon} {token.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {votingSettings.requiredToken !== "none" && (
                          <div>
                            <Label htmlFor="required-amount" className="text-sm">
                              Required Amount <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="required-amount"
                              type="number"
                              placeholder="Enter amount"
                              value={votingSettings.requiredAmount}
                              onChange={(e) => setVotingSettings({ ...votingSettings, requiredAmount: e.target.value })}
                              className="h-10"
                              required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Voters must hold at least this amount to participate
                            </p>
                          </div>
                        )}
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
                            className="h-10"
                          />
                          <div className="ml-2 text-sm font-medium">
                            <Coins className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Amount in SUI that voters need to pay to participate (0 for free voting)
                        </p>
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
                    className="rounded-full h-8 w-8"
                    onClick={() => setActiveTab("polls")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="lg" className="gap-2" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Updating Vote...
                      </>
                    ) : (
                      <>
                        Save Changes
                        <Save className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Preview Card */}
              <Card className="mt-6 border-dashed">
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
          </div>
        </div>
      </Tabs>
    </div>
  )
}
