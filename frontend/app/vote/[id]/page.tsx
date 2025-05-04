"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, CheckCircle, Clock, Users, Share2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ShareDialog } from "@/components/share-dialog"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { motion, AnimatePresence } from "framer-motion"

// Sample data for a vote with multiple polls
const voteData = {
  id: "1",
  title: "Q2 Team Feedback",
  description:
    "Please provide your feedback on the following topics to help us improve our team processes and environment.",
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
    {
      id: "poll-3",
      title: "What technology would you like to learn more about?",
      description: "Select one area you'd like to focus on for professional development.",
      isMultiSelect: false,
      isRequired: true,
      options: [
        { id: "option-3-1", text: "Blockchain and Web3", mediaUrl: null },
        { id: "option-3-2", text: "AI and Machine Learning", mediaUrl: null },
        { id: "option-3-3", text: "DevOps and Cloud Infrastructure", mediaUrl: null },
        { id: "option-3-4", text: "Mobile App Development", mediaUrl: null },
        { id: "option-3-5", text: "UI/UX Design", mediaUrl: null },
      ],
    },
  ],
  requiredToken: "sui",
  requiredAmount: "10",
  paymentAmount: "1",
  status: "active",
  votes: 124,
  created: "2023-10-15",
  endDate: "2023-11-15",
  requireAllPolls: false,
}

// Sample closed vote data for testing
const closedVoteData = {
  ...voteData,
  id: "2",
  status: "closed",
}

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params

  const [vote, setVote] = useState(voteData)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // State to track selections for each poll
  const [selections, setSelections] = useState<Record<string, string | string[]>>({})

  useEffect(() => {
    // In a real app, fetch the vote data based on the ID
    // For now, we'll just use the sample data based on the ID
    const currentVote = id === "2" ? closedVoteData : voteData
    setVote(currentVote)

    // If the vote is closed, redirect to the closed page
    if (currentVote.status === "closed") {
      router.push(`/vote/${id}/closed`)
      return
    }

    setLoading(false)

    // Initialize selections
    const initialSelections: Record<string, string | string[]> = {}
    currentVote.polls.forEach((poll) => {
      initialSelections[poll.id] = poll.isMultiSelect ? [] : ""
    })
    setSelections(initialSelections)

    // Update document title and metadata
    if (!loading && vote) {
      document.title = `${vote.title} - SuiVote`

      // Create meta description
      const metaDescription = document.querySelector('meta[name="description"]')
      if (metaDescription) {
        metaDescription.setAttribute("content", vote.description || `Vote on ${vote.title}`)
      } else {
        const meta = document.createElement("meta")
        meta.name = "description"
        meta.content = vote.description || `Vote on ${vote.title}`
        document.head.appendChild(meta)
      }

      // Create meta for social sharing
      const ogTitle = document.querySelector('meta[property="og:title"]')
      if (ogTitle) {
        ogTitle.setAttribute("content", `${vote.title} - SuiVote`)
      } else {
        const meta = document.createElement("meta")
        meta.setAttribute("property", "og:title")
        meta.content = `${vote.title} - SuiVote`
        document.head.appendChild(meta)
      }

      const ogDescription = document.querySelector('meta[property="og:description"]')
      if (ogDescription) {
        ogDescription.setAttribute("content", vote.description || `Vote on ${vote.title}`)
      } else {
        const meta = document.createElement("meta")
        meta.setAttribute("property", "og:description")
        meta.content = vote.description || `Vote on ${vote.title}`
        document.head.appendChild(meta)
      }
    }
  }, [id, router, loading, vote])

  const handleSingleSelect = (pollId: string, optionId: string) => {
    setSelections({
      ...selections,
      [pollId]: optionId,
    })
    setValidationError(null)
  }

  const handleMultiSelect = (pollId: string, optionId: string, maxSelections: number) => {
    const currentSelections = (selections[pollId] as string[]) || []

    if (currentSelections.includes(optionId)) {
      setSelections({
        ...selections,
        [pollId]: currentSelections.filter((id) => id !== optionId),
      })
    } else if (currentSelections.length < maxSelections) {
      setSelections({
        ...selections,
        [pollId]: [...currentSelections, optionId],
      })
    }
    setValidationError(null)
  }

  const isOptionSelected = (pollId: string, optionId: string) => {
    const selection = selections[pollId]
    if (Array.isArray(selection)) {
      return selection.includes(optionId)
    }
    return selection === optionId
  }

  const validateVote = (): boolean => {
    // Check if all required polls have selections
    const requiredPolls = vote.requireAllPolls ? vote.polls : vote.polls.filter((poll) => poll.isRequired)

    for (const poll of requiredPolls) {
      const selection = selections[poll.id]

      if (poll.isMultiSelect) {
        if (!Array.isArray(selection) || selection.length === 0) {
          setValidationError(`Please answer the required poll: "${poll.title}"`)
          return false
        }
      } else {
        if (!selection) {
          setValidationError(`Please answer the required poll: "${poll.title}"`)
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateVote()) return

    setSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // In a real app, you would submit the vote to the blockchain here

    setSubmitting(false)
    setSubmitted(true)
  }

  const handleShare = () => {
    setShareDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-3xl py-10 px-4 md:px-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">{vote.title}</h1>
        <WalletConnectButton />
      </div>

      <Card className="border-2 shadow-lg mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardDescription className="mt-1">{vote.description}</CardDescription>
            </div>
            <Badge variant={vote.status === "active" ? "success" : "secondary"} className="text-sm px-3 py-1">
              {vote.status === "active" ? "Active" : "Closed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{vote.votes} votes</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Ends: {vote.endDate}</span>
            </div>
          </div>

          {vote.requiredToken && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Token Required:</span> Minimum {vote.requiredAmount}
                <span className="inline-flex items-center ml-1">
                  <img src="/images/sui-logo.png" alt="SUI" className="h-4 w-4 mr-1" />
                  {vote.requiredToken.toUpperCase()}
                </span>{" "}
                to vote
              </p>
              {vote.paymentAmount && Number(vote.paymentAmount) > 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  <span className="font-medium">Payment Required:</span> {vote.paymentAmount}
                  <span className="inline-flex items-center ml-1">
                    <img src="/images/sui-logo.png" alt="SUI" className="h-4 w-4 mr-1" />
                    SUI
                  </span>{" "}
                  per vote
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {submitted ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="border-2 shadow-lg mb-8 bg-green-50 dark:bg-green-900/20">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Vote Submitted Successfully!</h3>
                <p className="text-muted-foreground mb-6">Thank you for participating in this vote.</p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={handleShare}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share this vote
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {vote.polls.map((poll, index) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="border shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      {index + 1}. {poll.title}
                      {poll.isRequired && <span className="ml-2 text-sm text-red-500">*</span>}
                    </CardTitle>
                    {!vote.requireAllPolls && poll.isRequired && (
                      <Badge variant="outline" className="text-red-500 border-red-200">
                        Required
                      </Badge>
                    )}
                  </div>
                  {poll.description && <CardDescription>{poll.description}</CardDescription>}
                  {poll.isMultiSelect && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Select up to {poll.maxSelections || poll.options.length} option
                      {(poll.maxSelections || poll.options.length) !== 1 ? "s" : ""}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {poll.isMultiSelect ? (
                    <div className="space-y-4">
                      {poll.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={option.id}
                            checked={isOptionSelected(poll.id, option.id)}
                            onCheckedChange={() =>
                              handleMultiSelect(poll.id, option.id, poll.maxSelections || poll.options.length)
                            }
                            disabled={
                              (selections[poll.id] as string[])?.length >=
                                (poll.maxSelections || poll.options.length) && !isOptionSelected(poll.id, option.id)
                            }
                            className="mt-1"
                          />
                          <div className="space-y-2 w-full">
                            <Label htmlFor={option.id} className="text-base cursor-pointer">
                              {option.text}
                            </Label>
                            {option.mediaUrl && (
                              <div className="rounded-md overflow-hidden mt-2">
                                <img
                                  src={option.mediaUrl || "/placeholder.svg"}
                                  alt={`Media for ${option.text}`}
                                  className="w-full h-auto max-h-[200px] object-cover rounded-md"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <RadioGroup value={selections[poll.id] as string} className="space-y-4">
                      {poll.options.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 border border-transparent hover:border-border"
                        >
                          <RadioGroupItem
                            value={option.id}
                            id={option.id}
                            onClick={() => handleSingleSelect(poll.id, option.id)}
                            className="mt-1"
                          />
                          <div className="space-y-2 w-full">
                            <Label htmlFor={option.id} className="text-base cursor-pointer">
                              {option.text}
                            </Label>
                            {option.mediaUrl && (
                              <div className="rounded-md overflow-hidden mt-2">
                                <img
                                  src={option.mediaUrl || "/placeholder.svg"}
                                  alt={`Media for ${option.text}`}
                                  className="w-full h-auto max-h-[200px] object-cover rounded-md"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
                {index < vote.polls.length - 1 && (
                  <CardFooter className="border-t px-6 py-4">
                    <Separator />
                  </CardFooter>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!submitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-end"
        >
          <Button size="lg" className="gap-2" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                Submit Vote
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={vote.title}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${vote.id}`}
      />
    </div>
  )
}
