"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  ArrowLeft,
  Download,
  Users,
  BarChart3,
  Calendar,
  Clock,
  Eye,
  Share2,
  Copy,
  ExternalLink,
  FileText,
  Wallet,
  TrendingUp,
  Award,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Filter,
  Search
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ShareDialog } from "@/components/share-dialog"
import Link from "next/link"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

// Types
interface VoteParticipant {
  address: string
  pollId: string
  optionIndices: number[]
  tokenBalance: number
  voteWeight: number
  timestamp: number
}

interface PollAnalytics {
  pollId: string
  title: string
  totalVotes: number
  options: {
    text: string
    votes: number
    percentage: number
  }[]
}

export default function VoteDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const suivote = useSuiVote()

  // State
  const [vote, setVote] = useState(null)
  const [polls, setPolls] = useState([])
  const [participants, setParticipants] = useState<VoteParticipant[]>([])
  const [pollAnalytics, setPollAnalytics] = useState<PollAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [error, setError] = useState(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPoll, setSelectedPoll] = useState("all")

  // Check if user is the creator
  const isCreator = wallet.address && vote?.creator === wallet.address

  // Fetch vote details and participants
  const fetchVoteData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get vote details
      const voteDetails = await suivote.getVoteDetails(params.id)
      if (!voteDetails) {
        setError("Vote not found")
        return
      }

      setVote(voteDetails)

      // Get polls
      const pollsData = await suivote.getVotePolls(params.id)
      setPolls(pollsData)

      // Only fetch participants if user is the creator
      if (wallet.address === voteDetails.creator) {
        await fetchParticipants(voteDetails.id)
      }

      // Update document title
      document.title = `${voteDetails.title} - Vote Details - SuiVote`

    } catch (err) {
      console.error("Error fetching vote data:", err)
      setError(err.message || "Failed to load vote details")
    } finally {
      setLoading(false)
    }
  }, [params.id, wallet.address, suivote])

  // Fetch participants data
  const fetchParticipants = async (voteId: string) => {
    try {
      setLoadingParticipants(true)
      
      // Query VoteCast events for this specific vote
      const { data: events } = await suivote.client.queryEvents({
        query: {
          MoveEventType: `${suivote.PACKAGE_ID}::voting::VoteCast`
        },
        limit: 1000, // Adjust based on expected participation
        descending_order: true
      })

      // Filter events for this vote and extract participant data
      const voteParticipants: VoteParticipant[] = []
      const uniqueParticipants = new Set<string>()

      for (const event of events) {
        if (!event.parsedJson) continue
        
        const voteCastEvent = event.parsedJson as any
        if (voteCastEvent.vote_id !== voteId) continue

        // Avoid duplicate entries for the same participant
        const participantKey = `${voteCastEvent.voter}-${voteCastEvent.poll_id}`
        if (uniqueParticipants.has(participantKey)) continue
        uniqueParticipants.add(participantKey)

        voteParticipants.push({
          address: voteCastEvent.voter,
          pollId: voteCastEvent.poll_id,
          optionIndices: voteCastEvent.option_indices || [],
          tokenBalance: voteCastEvent.token_balance || 0,
          voteWeight: voteCastEvent.vote_weight || 1,
          timestamp: event.timestampMs ? parseInt(event.timestampMs) : Date.now()
        })
      }

      setParticipants(voteParticipants)
      
      // Generate analytics
      generatePollAnalytics(voteParticipants)

    } catch (err) {
      console.error("Error fetching participants:", err)
      toast.error("Failed to load participant data")
    } finally {
      setLoadingParticipants(false)
    }
  }

  // Generate poll analytics
  const generatePollAnalytics = (participantData: VoteParticipant[]) => {
    const analytics: PollAnalytics[] = []
    
    polls.forEach(poll => {
      const pollParticipants = participantData.filter(p => p.pollId === poll.id)
      const totalVotes = pollParticipants.length
      
      const optionVotes = poll.options?.map((option, index) => {
        const votes = pollParticipants.filter(p => 
          p.optionIndices.includes(index)
        ).length
        
        return {
          text: option.text,
          votes,
          percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0
        }
      }) || []
      
      analytics.push({
        pollId: poll.id,
        title: poll.title,
        totalVotes,
        options: optionVotes
      })
    })
    
    setPollAnalytics(analytics)
  }

  // Download participants as TXT file
  const downloadParticipants = (pollFilter = "all") => {
    let filteredParticipants = participants
    
    if (pollFilter !== "all") {
      filteredParticipants = participants.filter(p => p.pollId === pollFilter)
    }
    
    const uniqueAddresses = [...new Set(filteredParticipants.map(p => p.address))]
    const content = uniqueAddresses.join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${vote?.title || 'vote'}-participants${pollFilter !== 'all' ? `-poll-${pollFilter}` : ''}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Downloaded ${uniqueAddresses.length} participant addresses`)
  }

  // Download detailed analytics as CSV
  const downloadAnalytics = () => {
    const csvContent = [
      ['Poll Title', 'Option', 'Votes', 'Percentage'].join(','),
      ...pollAnalytics.flatMap(poll => 
        poll.options.map(option => 
          [poll.title, option.text, option.votes, option.percentage.toFixed(2)].join(',')
        )
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${vote?.title || 'vote'}-analytics.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Analytics downloaded successfully')
  }

  // Copy share URL
  const copyShareUrl = () => {
    const url = `${window.location.origin}/vote/${params.id}`
    navigator.clipboard.writeText(url)
    toast.success('Vote URL copied to clipboard')
  }

  // Filter participants based on search and poll selection
  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = participant.address.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPoll = selectedPoll === "all" || participant.pollId === selectedPoll
    return matchesSearch && matchesPoll
  })

  // Get unique participant addresses
  const uniqueParticipants = [...new Set(participants.map(p => p.address))]

  useEffect(() => {
    if (params.id) {
      fetchVoteData()
    }
  }, [params.id, fetchVoteData])

  // Redirect if not creator
  useEffect(() => {
    if (!loading && vote && !isCreator) {
      router.push(`/vote/${params.id}`)
    }
  }, [loading, vote, isCreator, router, params.id])

  if (loading) {
    return (
      <div className="container max-w-6xl py-10 px-4 md:px-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading vote details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-10 px-4 md:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!vote || !isCreator) {
    return (
      <div className="container max-w-6xl py-10 px-4 md:px-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only the vote creator can view detailed analytics.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-6xl py-10 px-4 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{vote.title}</h1>
          <p className="text-muted-foreground mt-1">Vote Details & Analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyShareUrl}
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/vote/${params.id}`)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View Vote
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueParticipants.length}</div>
            <p className="text-xs text-muted-foreground">
              Unique wallet addresses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vote.totalVotes}</div>
            <p className="text-xs text-muted-foreground">
              Across all polls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{vote.status}</div>
            <p className="text-xs text-muted-foreground">
              {vote.status === 'active' ? 'Voting in progress' : 
               vote.status === 'closed' ? 'Voting ended' : 
               vote.status === 'upcoming' ? 'Not started yet' : 'Unknown'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">End Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {format(new Date(vote.endTimestamp), 'MMM d')}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(vote.endTimestamp), 'yyyy, HH:mm')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Poll Results
              </CardTitle>
              <CardDescription>
                Detailed breakdown of votes for each poll
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {pollAnalytics.map((poll, index) => (
                <motion.div
                  key={poll.pollId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{poll.title}</h3>
                    <Badge variant="secondary">{poll.totalVotes} votes</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {poll.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{option.text}</span>
                          <span className="text-muted-foreground">
                            {option.votes} votes ({option.percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={option.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>
                  
                  {index < pollAnalytics.length - 1 && <Separator />}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Participants
                {loadingParticipants && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                Wallet addresses that participated in this vote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by wallet address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      {selectedPoll === "all" ? "All Polls" : `Poll ${selectedPoll}`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSelectedPoll("all")}>
                      All Polls
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {polls.map((poll, index) => (
                      <DropdownMenuItem
                        key={poll.id}
                        onClick={() => setSelectedPoll(poll.id)}
                      >
                        Poll {index + 1}: {poll.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Participants List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredParticipants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {participants.length === 0 ? "No participants yet" : "No participants match your filters"}
                  </div>
                ) : (
                  filteredParticipants.map((participant, index) => (
                    <motion.div
                      key={`${participant.address}-${participant.pollId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-mono text-sm">{participant.address}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(participant.timestamp), 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {participant.voteWeight > 1 && (
                          <Badge variant="secondary">
                            Weight: {participant.voteWeight}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(participant.address)
                            toast.success('Address copied to clipboard')
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Export Participants
                </CardTitle>
                <CardDescription>
                  Download wallet addresses as text files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => downloadParticipants("all")}
                  className="w-full flex items-center gap-2"
                  disabled={participants.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download All Participants ({uniqueParticipants.length})
                </Button>
                
                <Separator />
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Download by Poll:</p>
                  {polls.map((poll, index) => {
                    const pollParticipants = [...new Set(
                      participants
                        .filter(p => p.pollId === poll.id)
                        .map(p => p.address)
                    )]
                    
                    return (
                      <Button
                        key={poll.id}
                        variant="outline"
                        onClick={() => downloadParticipants(poll.id)}
                        className="w-full flex items-center gap-2 justify-between"
                        disabled={pollParticipants.length === 0}
                      >
                        <span className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Poll {index + 1}: {poll.title}
                        </span>
                        <Badge variant="secondary">{pollParticipants.length}</Badge>
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Export Analytics
                </CardTitle>
                <CardDescription>
                  Download detailed vote analytics and results
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={downloadAnalytics}
                  className="w-full flex items-center gap-2"
                  disabled={pollAnalytics.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download Analytics (CSV)
                </Button>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Poll results and vote counts</p>
                  <p>• Option percentages</p>
                  <p>• Participation statistics</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Additional Features
              </CardTitle>
              <CardDescription>
                More tools for managing your vote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => setShareDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share Vote
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => router.push(`/edit/${params.id}`)}
                  className="flex items-center gap-2"
                  disabled={vote.status === 'closed' || vote.totalVotes > 0}
                >
                  <FileText className="h-4 w-4" />
                  Edit Vote
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://suiscan.xyz/mainnet/object/${params.id}`, '_blank')}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View on Explorer
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => fetchVoteData()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={vote?.title || "Vote"}
        url={`${typeof window !== 'undefined' ? window.location.origin : ''}/vote/${params.id}`}
      />
    </div>
  )
}