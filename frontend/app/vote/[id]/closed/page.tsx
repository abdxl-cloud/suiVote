"use client"

import { useState, useEffect, ReactNode } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  ArrowLeft,
  Share2,
  Lock,
  BarChart2,
  ExternalLink,
  Home,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ShareDialog } from "@/components/share-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import Link from "next/link"

export default function ClosedVotePage() {
  const params = useParams()
  const router = useRouter()
  const suivote = useSuiVote()
  
  const [vote, setVote] = useState(null)
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  // Format date
  const formatDate = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Date unavailable"
    }
  }

  // Function to detect URLs in text and convert them to clickable links
  const formatTextWithLinks = (text) => {
    if (!text) return [text]
    
    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g
    
    // Split the text by URLs
    const parts = text.split(urlRegex)
    
    // Find all URLs in the text
    const urls = text.match(urlRegex) || []
    
    // Combine parts and URLs
    const result = []
    
    parts.forEach((part, index) => {
      // Add the text part
      result.push(part)
      
      // Add the URL as a link if it exists
      if (urls[index]) {
        result.push(
          <a 
            key={index} 
            href={urls[index]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 hover:underline"
          >
            {urls[index]}
          </a>
        )
      }
    })
    
    return result
  }

  // Calculate percentages for options
  const getPercentage = (votes, totalVotes) => {
    if (!totalVotes) return 0
    return Math.round((votes / totalVotes) * 100)
  }

  // Truncate address for display
  const truncateAddress = (address) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // Fetch vote data on component mount
  useEffect(() => {
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
        
        // If vote is not closed, but has live stats, redirect to main vote page
        if (voteDetails.status !== "closed" && voteDetails.showLiveStats) {
          router.push(`/vote/${params.id}`)
          return
        }
        
        // Set vote details
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
              options: optionsWithPercentage || [],
              totalVotes: totalVotesForPoll
            }
          })
        )
        
        setPolls(pollsWithOptions || [])
        
        // Update document title
        document.title = `${voteDetails.title} (Closed) - SuiVote`
      } catch (err) {
        console.error("Error fetching vote data:", err)
        setError(err.message || "Failed to load vote details")
        
        toast.error("Error loading vote", {
          description: err.message || "Failed to load vote details"
        })
      } finally {
        setLoading(false)
      }
    }
    
    // Initial data fetch
    fetchVoteData()
    
    // Set up real-time updates subscription if we have a vote ID
    if (params.id) {
      // Subscribe to vote updates
      const unsubscribe = suivote.subscribeToVoteUpdates(params.id, (updatedVoteDetails) => {
        console.log("Received vote update on closed page:", updatedVoteDetails)
        
        // If vote is not closed, but has live stats, redirect to main vote page
        if (updatedVoteDetails.status !== "closed" && updatedVoteDetails.showLiveStats) {
          router.push(`/vote/${params.id}`)
          return
        }
        
        // Update the vote state with the latest data
        setVote(updatedVoteDetails)
      })
      
      // Clean up subscription when component unmounts or params change
      return () => {
        unsubscribe()
      }
    }
  }, [params.id, suivote, router])
  
  const handleShare = () => {
    setShareDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading vote results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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

  return (
    <div className="container max-w-3xl py-10 px-4 md:px-6">
      {/* Back button */}
      <div className="mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/polls">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Polls
          </Link>
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-2 shadow-lg mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-2xl">{vote.title}</CardTitle>
                <CardDescription className="mt-1">{formatTextWithLinks(vote.description)}</CardDescription>
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
                <span>{vote.totalVotes} votes</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Ended: {formatDate(vote.endTimestamp)}</span>
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
      </motion.div>

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
        // If showLiveStats is true, display the results
        <div className="space-y-8">
          {polls.map((poll, pollIndex) => (
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
                  {poll.description && <CardDescription>{formatTextWithLinks(poll.description)}</CardDescription>}
                  <div className="text-sm text-muted-foreground">Total responses: {poll.totalResponses}</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {poll.options
                    .sort((a, b) => b.votes - a.votes)
                    .map((option) => {
                      const percentage = getPercentage(option.votes, poll.totalResponses)

                      return (
                        <div key={option.id} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{option.text}</span>
                            <span className="text-sm font-medium">
                              {option.votes} votes ({percentage}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2">
                            <div 
                              className="h-full bg-sui-500"
                              style={{ 
                                width: `${percentage}%`,
                                // Apply different colors to the top options
                                backgroundColor: 
                                  poll.options.indexOf(option) === 0 ? 'var(--sui-500)' :
                                  poll.options.indexOf(option) === 1 ? 'var(--sui-400)' :
                                  poll.options.indexOf(option) === 2 ? 'var(--sui-300)' : 'var(--sui-200)'
                              }} 
                            />
                          </Progress>
                          
                          {option.mediaUrl && (
                            <div className="mt-2 rounded-md overflow-hidden max-h-48">
                              <img
                                src={option.mediaUrl || "/placeholder.svg"}
                                alt={option.text}
                                className="object-cover w-full max-h-48"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        // If showLiveStats is false, show message that results are not public
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-600 dark:text-blue-400">
              Results for this vote are not publicly available. Please contact the vote creator for more information.
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vote Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="font-medium mb-1 text-sm">Title</div>
                <p className="text-muted-foreground">{vote.title}</p>
              </div>
              
              {vote.description && (
                <div>
                  <div className="font-medium mb-1 text-sm">Description</div>
                  <p className="text-muted-foreground">{vote.description}</p>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Votes:</span>
                  <span className="font-medium">{vote.totalVotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Poll Count:</span>
                  <span className="font-medium">{vote.pollsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Status:</span>
                  <span className="font-medium">Closed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Voting Period:</span>
                  <span className="font-medium">
                    {formatDate(vote.startTimestamp)} - {formatDate(vote.endTimestamp)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-center pt-0">
              <div className="flex flex-col md:flex-row gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`https://explorer.sui.io/object/${params.id}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View on Explorer
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      View this vote on the Sui Explorer
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      )}

      <div className="mt-8 flex justify-center">
        <Link href="/polls">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            Back to Polls
          </Button>
        </Link>
      </div>

      {/* Vote metadata */}
      {vote && (
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
                {truncateAddress(vote.creator)}
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
      )}

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={vote?.title || "Closed Vote"}
        url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${params.id}/closed`}
      />
    </div>
  )
}