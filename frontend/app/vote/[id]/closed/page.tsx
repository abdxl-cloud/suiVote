"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Share2, BarChart2, Clock, Users, Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ShareDialog } from "@/components/share-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion } from "framer-motion"
import Link from "next/link"

// Sample data for a closed vote
const voteData = {
  id: "2",
  title: "Office Location Preferences",
  description: "Survey to determine preferences for our new office location",
  status: "closed",
  votes: 87,
  created: "2023-10-10",
  endDate: "2023-10-25",
  showLiveStats: false, // Added this property
  polls: [
    {
      id: "poll-1",
      title: "Which city do you prefer for our new office?",
      description: "Please select your preferred city for our new office location.",
      options: [
        { id: "option-1-1", text: "San Francisco", votes: 32 },
        { id: "option-1-2", text: "New York", votes: 28 },
        { id: "option-1-3", text: "Austin", votes: 15 },
        { id: "option-1-4", text: "Seattle", votes: 12 },
      ],
    },
    {
      id: "poll-2",
      title: "What amenities are most important to you?",
      description: "Select the amenities that you consider most important for the new office.",
      options: [
        { id: "option-2-1", text: "Gym/Fitness Center", votes: 45 },
        { id: "option-2-2", text: "Cafeteria", votes: 62 },
        { id: "option-2-3", text: "Outdoor Space", votes: 38 },
        { id: "option-2-4", text: "Game Room", votes: 29 },
        { id: "option-2-5", text: "Quiet Rooms", votes: 51 },
      ],
    },
  ],
}

export default function ClosedVotePage() {
  const params = useParams()
  const router = useRouter()
  const { id } = params

  const [vote, setVote] = useState(voteData)
  const [loading, setLoading] = useState(true)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  useEffect(() => {
    // In a real app, fetch the vote data based on the ID
    // For now, we'll just use the sample data
    setLoading(false)

    // Update document title
    document.title = `${voteData.title} (Closed) - SuiVote`
  }, [id])

  const handleShare = () => {
    setShareDialogOpen(true)
  }

  // Calculate total votes for a poll
  const getTotalVotes = (pollIndex: number) => {
    return vote.polls[pollIndex].options.reduce((sum, option) => sum + option.votes, 0)
  }

  // Calculate percentage for an option
  const getPercentage = (votes: number, totalVotes: number) => {
    return totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
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
      <Card className="border-2 shadow-lg mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-2xl">{vote.title}</CardTitle>
              <CardDescription className="mt-1">{vote.description}</CardDescription>
            </div>
            <Badge variant="secondary" className="text-sm px-3 py-1 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Closed
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
              <span>Ended: {vote.endDate}</span>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>This vote has ended and is no longer accepting responses.</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          Results
        </h2>
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Results
        </Button>
      </div>

      {vote.showLiveStats ? (
        <div className="space-y-8">
          {vote.polls.map((poll, pollIndex) => (
            <motion.div
              key={poll.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: pollIndex * 0.1 }}
            >
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">
                    {pollIndex + 1}. {poll.title}
                  </CardTitle>
                  {poll.description && <CardDescription>{poll.description}</CardDescription>}
                  <div className="text-sm text-muted-foreground">Total responses: {getTotalVotes(pollIndex)}</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {poll.options
                    .sort((a, b) => b.votes - a.votes)
                    .map((option) => {
                      const totalVotes = getTotalVotes(pollIndex)
                      const percentage = getPercentage(option.votes, totalVotes)

                      return (
                        <div key={option.id} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{option.text}</span>
                            <span className="text-sm font-medium">
                              {option.votes} votes ({percentage}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-600 dark:text-blue-400">
            Results for this vote are not publicly available. Please contact the vote creator for more information.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/dashboard">
          <Button className="gap-2">Back to Dashboard</Button>
        </Link>
      </div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={vote.title}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${vote.id}/closed`}
      />
    </div>
  )
}
