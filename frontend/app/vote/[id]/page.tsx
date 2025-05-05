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
import { useWallet } from "@suiet/wallet-kit"
import { useSuiVote } from "@/hooks/use-suivote"
import type { VoteDetails, PollDetails, PollOptionDetails } from "@/services/suivote-service"

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params
  const wallet = useWallet()
  const suivote = useSuiVote()

  const [vote, setVote] = useState<VoteDetails | null>(null)
  const [polls, setPolls] = useState<PollDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [hasUserVoted, setHasUserVoted] = useState(false)

  // State to track selections for each poll
  const [selections, setSelections] = useState<Record<string, string | string[]>>({})

  // Function to fetch vote details and polls
  const fetchVoteData = async () => {
    try {
      setLoading(true)

      if (!id) {
        throw new Error("Vote ID is required")
      }

      // Get vote details
      const voteDetails = await suivote.getVoteDetails(id as string)
      if (!voteDetails) {
        throw new Error("Vote not found")
      }

      setVote(voteDetails)

      // If the vote is closed, redirect to the closed page
      if (voteDetails.status === "closed") {
        router.push(`/vote/${id}/closed`)
        return
      }

      // Get polls for the vote
      const pollsData = await suivote.getVotePolls(id as string)
      
      // Fetch options for each poll
      const pollsWithOptions = await Promise.all(
        pollsData.map(async (poll, index) => {
          // Get options for this poll (index + 1 because poll indices are 1-based)
          const options = await suivote.getPollOptions(id as string, index + 1)
          return {
            ...poll,
            options: options || []
          }
        })
      )
      
      setPolls(pollsWithOptions || [])

      // Initialize selections
      const initialSelections: Record<string, string | string[]> = {}
      pollsWithOptions.forEach((poll) => {
        initialSelections[poll.id] = poll.isMultiSelect ? [] : ""
      })
      setSelections(initialSelections)

      // Check if user has already voted
      if (wallet.connected && wallet.address) {
        const votedStatus = await suivote.hasVoted(wallet.address, id as string)
        setHasUserVoted(votedStatus)
        if (votedStatus) {
          setSubmitted(true)
        }
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
      setValidationError(error instanceof Error ? error.message : "Failed to load vote data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVoteData()
  }, [id, router])

  // Re-check if user has voted when wallet changes
  useEffect(() => {
    if (wallet.connected && wallet.address && id) {
      suivote.hasVoted(wallet.address, id as string).then(voted => {
        setHasUserVoted(voted)
        if (voted) {
          setSubmitted(true)
        }
      })
    } else {
      setHasUserVoted(false)
    }
  }, [wallet.connected, wallet.address, id])

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
    if (!vote) return false

    // Check if wallet is connected
    if (!wallet.connected) {
      setValidationError("Please connect your wallet to vote")
      return false
    }

    // Check if all required polls have selections
    const requiredPolls = vote.requireAllPolls ? polls : polls.filter((poll) => poll.isRequired)

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
    if (!validateVote() || !vote || !id) return

    try {
      setSubmitting(true)
      setValidationError(null)

      // Prepare the poll indices and option selections
      const pollIndices: number[] = []
      const optionIndicesPerPoll: number[][] = []

      for (let i = 0; i < polls.length; i++) {
        const poll = polls[i]
        const selection = selections[poll.id]

        if (selection) {
          // Add the poll index (1-based index)
          pollIndices.push(i + 1)

          if (Array.isArray(selection)) {
            // For multi-select polls, convert option IDs to indices
            const optionIndices = selection.map(optionId => {
              // Find the index of this option
              const optionIndex = poll.options?.findIndex(opt => opt.id === optionId)
              // Return 1-based index
              return optionIndex !== undefined && optionIndex >= 0 ? optionIndex + 1 : 0
            }).filter(idx => idx > 0)
            
            optionIndicesPerPoll.push(optionIndices)
          } else {
            // For single-select polls, find the option index
            const optionIndex = poll.options?.findIndex(opt => opt.id === selection)
            // Push as an array with a single 1-based index
            optionIndicesPerPoll.push(optionIndex !== undefined && optionIndex >= 0 ? [optionIndex + 1] : [])
          }
        }
      }

      // If we have only one poll to vote on, use castVoteTransaction
      if (pollIndices.length === 1) {
        const transaction = suivote.castVoteTransaction(
          id as string, 
          pollIndices[0], 
          optionIndicesPerPoll[0],
          vote.paymentAmount
        )
        
        const response = await suivote.executeTransaction(transaction)
        console.log("Vote transaction response:", response)
      } else {
        // Use castMultipleVotesTransaction for multiple polls
        const transaction = suivote.castMultipleVotesTransaction(
          id as string,
          pollIndices,
          optionIndicesPerPoll,
          vote.paymentAmount
        )
        
        const response = await suivote.executeTransaction(transaction)
        console.log("Multiple votes transaction response:", response)
      }

      setSubmitted(true)
      setHasUserVoted(true)
    } catch (error) {
      console.error("Error submitting vote:", error)
      setValidationError(error instanceof Error ? error.message : "Failed to submit vote")
    } finally {
      setSubmitting(false)
    }
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

  if (!vote) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Vote not found or failed to load</AlertDescription>
        </Alert>
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
              {vote.status === "active" ? "Active" : vote.status === "upcoming" ? "Upcoming" : "Closed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{vote.totalVotes} votes</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Ends: {new Date(vote.endTimestamp).toLocaleDateString()}</span>
            </div>
          </div>

          {vote.paymentAmount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Payment Required:</span> {vote.paymentAmount}
                <span className="inline-flex items-center ml-1">
                  <img src="/images/sui-logo.png" alt="SUI" className="h-4 w-4 mr-1" />
                  SUI
                </span>{" "}
                per vote
              </p>
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

      {submitted || hasUserVoted ? (
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
          {polls.map((poll, index) => (
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
                      Select up to {poll.maxSelections || (poll.options?.length || 1)} option
                      {(poll.maxSelections || (poll.options?.length || 1)) !== 1 ? "s" : ""}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {poll.isMultiSelect ? (
                    <div className="space-y-4">
                      {poll.options?.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50 border border-transparent hover:border-border"
                        >
                          <Checkbox
                            id={option.id}
                            checked={isOptionSelected(poll.id, option.id)}
                            onCheckedChange={() =>
                              handleMultiSelect(poll.id, option.id, poll.maxSelections || (poll.options?.length || 1))
                            }
                            disabled={
                              (selections[poll.id] as string[])?.length >=
                                (poll.maxSelections || (poll.options?.length || 1)) && 
                                !isOptionSelected(poll.id, option.id)
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
                      {poll.options?.map((option) => (
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
                {index < polls.length - 1 && (
                  <CardFooter className="border-t px-6 py-4">
                    <Separator />
                  </CardFooter>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!submitted && !hasUserVoted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-end"
        >
          <Button 
            size="lg" 
            className="gap-2" 
            onClick={handleSubmit} 
            disabled={submitting || !wallet.connected}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : !wallet.connected ? (
              <>
                Connect Wallet to Vote
                <ArrowRight className="h-4 w-4" />
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
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${id}`}
      />
    </div>
  )
}