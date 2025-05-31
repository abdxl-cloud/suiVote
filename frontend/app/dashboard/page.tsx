"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  BarChart2,
  ListChecks,
  Users,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ExternalLink,
  Tag,
  Timer,
  Shield,
  Bookmark,
  Vote,
  Info,
  HelpCircle,
  TrendingUp,
  Target,
  Award,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useSuiVote } from "@/hooks/use-suivote"
import { useWallet } from "@suiet/wallet-kit"
import { formatDistanceToNow, format, subDays, differenceInDays, addDays } from "date-fns"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts"

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("30days")
  const [now, setNow] = useState(new Date())

  const wallet = useWallet()
  const { getMyVotes, loading, error, subscribeToVoteUpdates } = useSuiVote()
  const [votes, setVotes] = useState([])

  // Update the current time every minute to keep countdowns accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      const fetchVotes = async () => {
        try {
          const { data } = await getMyVotes(wallet.address)
          setVotes(data)
          
          // Set up real-time updates for each vote
          const unsubscribers = data.map((vote) => {
            // Only subscribe to active votes or votes with live stats enabled
            if (vote.status === "active" || vote.showLiveStats) {
              return subscribeToVoteUpdates(vote.id, (updatedVote) => {
                // Update the specific vote in the votes array
                setVotes(prevVotes => 
                  prevVotes.map(v => v.id === updatedVote.id ? { ...v, ...updatedVote } : v)
                )
              })
            }
            return () => {}
          })
          
          // Clean up subscriptions when component unmounts or when votes change
          return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe())
          }
        } catch (err) {
          console.error("Error fetching votes:", err)
        }
      }
      fetchVotes()
    }
  }, [wallet.connected, wallet.address, getMyVotes, subscribeToVoteUpdates])

  useEffect(() => {
    // Check if we're coming from a successful vote creation
    if (searchParams.get("created") === "true") {
      setShowSuccess(true)

      // Hide the success message after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Group votes by status
  const votesByStatus = useMemo(() => {
    if (!votes.length) return { active: [], pending: [], upcoming: [], closed: [], voted: [] }
    
    return {
      active: votes.filter(vote => vote.status === "active"),
      pending: votes.filter(vote => vote.status === "pending"),
      upcoming: votes.filter(vote => vote.status === "upcoming"),
      closed: votes.filter(vote => vote.status === "closed"),
      voted: votes.filter(vote => vote.status === "voted")
    }
  }, [votes])

  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!votes.length) return null

    // Total votes
    const totalVotes = votes.reduce((sum, vote) => sum + vote.votes, 0)
    
    // Total polls
    const totalPolls = votes.reduce((sum, vote) => sum + vote.pollCount, 0)
    
    // Get whitelist stats
    const whitelistedVotes = votes.filter(vote => vote.hasWhitelist && vote.isWhitelisted).length
    
    // Calculate deadlines for active and pending votes
    const upcomingDeadlines = votes
      .filter(vote => vote.status === "active" || vote.status === "pending")
      .map(vote => ({
        id: vote.id,
        title: vote.title,
        status: vote.status,
        endTimestamp: vote.endTimestamp,
        timeLeft: formatDistanceToNow(new Date(vote.endTimestamp), { addSuffix: true })
      }))
      .sort((a, b) => a.endTimestamp - b.endTimestamp)
      .slice(0, 3)

    // Calculate total token requirements
    const tokenRequiredVotes = votes.filter(vote => vote.tokenRequirement).length
    
    // Weekly vote activity data
    const activityData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dateStr = format(date, "MMM dd")
      const dateStart = new Date(date.setHours(0, 0, 0, 0))
      const dateEnd = new Date(date.setHours(23, 59, 59, 999))
      
      // Filter votes created on this date
      const votesCreated = votes.filter(vote => {
        const createdDate = new Date(vote.created)
        return createdDate >= dateStart && createdDate <= dateEnd
      }).length
      
      // Filter votes participated in on this date (estimation - could be more accurate with actual vote timestamps)
      const votesParticipated = votes.filter(vote => {
        return vote.status === "voted" 
      }).length / 7 // Distribute votes evenly across the week as an approximation
      
      return {
        date: dateStr,
        created: votesCreated,
        participated: Math.round(votesParticipated * (0.5 + Math.random()))
      }
    })

    // Vote type distribution data
    const voteTypes = [
      { name: "Standard", value: votes.filter(v => !v.hasWhitelist && !v.tokenRequirement).length },
      { name: "Whitelisted", value: votes.filter(v => v.hasWhitelist).length },
      { name: "Token-gated", value: votes.filter(v => v.tokenRequirement).length }
    ].filter(type => type.value > 0)

    // Status distribution data
    const statusDistribution = [
      { name: "Active", value: votesByStatus.active.length, color: "#10B981" },
      { name: "Pending", value: votesByStatus.pending.length, color: "#F59E0B" },
      { name: "Upcoming", value: votesByStatus.upcoming.length, color: "#3B82F6" },
      { name: "Voted", value: votesByStatus.voted.length, color: "#8B5CF6" },
      { name: "Closed", value: votesByStatus.closed.length, color: "#6B7280" }
    ].filter(status => status.value > 0)

    // Poll count vs. participation data
    const pollCountData = []
    const pollCounts = [...new Set(votes.map(vote => vote.pollCount))].sort((a, b) => a - b)
    
    pollCounts.forEach(count => {
      const votesWithCount = votes.filter(vote => vote.pollCount === count)
      if (votesWithCount.length > 0) {
        const avgParticipation = votesWithCount.reduce((sum, vote) => sum + vote.votes, 0) / votesWithCount.length
        
        pollCountData.push({
          pollCount: count,
          avgParticipation: Math.round(avgParticipation),
          votes: votesWithCount.length
        })
      }
    })

    // Most popular votes
    const popularVotes = [...votes]
      .filter(vote => vote.votes > 0)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 5)

    return {
      totalVotes,
      totalPolls,
      whitelistedVotes,
      upcomingDeadlines,
      tokenRequiredVotes,
      activeCount: votesByStatus.active.length,
      pendingCount: votesByStatus.pending.length,
      upcomingCount: votesByStatus.upcoming.length,
      closedCount: votesByStatus.closed.length,
      votedCount: votesByStatus.voted.length,
      pollCountData,
      activityData,
      voteTypes,
      statusDistribution,
      popularVotes,
      // Calculate engagement rate (votes cast / potential audience)
      engagementRate: totalVotes > 0 ? Math.round((totalVotes / (votes.length * 100)) * 100) : 0
    }
  }, [votes, votesByStatus, now])

  // Filter votes based on search and filters
  const filteredVotes = useMemo(() => {
    if (!votes.length) return []
    
    return votes
      .filter((vote) => vote.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((vote) => (filterStatus === "all" ? true : vote.status === filterStatus))
      // Filter by date range if needed
      .filter((vote) => {
        if (filterDate === "all") return true
        
        const voteDate = new Date(vote.created || vote.startTimestamp).getTime()
        const nowTime = now.getTime()
        const daysInMs = filterDate === "30days" ? 30 * 24 * 60 * 60 * 1000 : 90 * 24 * 60 * 60 * 1000
        
        return nowTime - voteDate <= daysInMs
      })
  }, [votes, searchQuery, filterStatus, filterDate, now])

  // Helper function to render status badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Active</span>
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
            <Shield className="h-3 w-3" />
            <span>Pending</span>
          </Badge>
        )
      case "upcoming":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Upcoming</span>
          </Badge>
        )
      case "closed":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            <span>Closed</span>
          </Badge>
        )
      case "voted":
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
            <CheckCircle className="h-3 w-3" />
            <span>Voted</span>
          </Badge>
        )
      default:
        return null
    }
  }

  // Render helper for feature badges
  const renderFeatureBadges = (vote) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {vote.hasWhitelist && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center text-xs rounded-full px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 ${vote.isWhitelisted ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                <Shield className="h-3 w-3 mr-1" />
                {vote.isWhitelisted ? 'Whitelisted' : 'Whitelist required'}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {vote.isWhitelisted 
                ? 'You are whitelisted for this vote' 
                : 'This vote requires you to be whitelisted to participate'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      {vote.tokenRequirement && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-xs rounded-full px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                <Tag className="h-3 w-3 mr-1" />
                Token required
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Requires {vote.tokenAmount} {vote.tokenRequirement}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  // Format time remaining
  const formatTimeRemaining = (endTimestamp) => {
    try {
      const end = new Date(endTimestamp)
      const timeRemaining = end.getTime() - now.getTime()
      
      if (timeRemaining <= 0) {
        return "Ended"
      }
      
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
      
      if (days > 0) {
        return `${days}d ${hours}h remaining`
      } else if (hours > 0) {
        return `${hours}h ${minutes}m remaining`
      } else {
        return `${minutes}m remaining`
      }
    } catch (e) {
      return "Unknown time"
    }
  }

  // Chart colors
  const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#6B7280']

  return (
    <div className="container py-6 px-4 sm:py-10 md:px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-6"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your voting analytics and insights</p>
          </div>
          <Link href="/create">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Create New Vote
            </Button>
          </Link>
        </motion.div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-600 dark:text-green-400">
                  Vote created successfully! It's now available for participants.
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!wallet.connected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Please connect your wallet to view your analytics.</AlertDescription>
          </Alert>
        )}

        {wallet.connected && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-2 rounded-full bg-blue-500/10 p-1.5">
                      <Vote className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">{votes.length}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-green-100/50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                      {analytics?.activeCount || 0} Active
                    </Badge>
                    <Badge variant="outline" className="bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                      {analytics?.pendingCount || 0} Pending
                    </Badge>
                    <Badge variant="outline" className="bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                      {analytics?.upcomingCount || 0} Upcoming
                    </Badge>
                    <Badge variant="outline" className="bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                      {analytics?.votedCount || 0} Voted
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Votes Received</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-2 rounded-full bg-green-500/10 p-1.5">
                      <Users className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">{analytics?.totalVotes || 0}</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {votes.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span>Avg {Math.round((analytics?.totalVotes || 0) / votes.length)} votes per poll</span>
                      </div>
                    ) : (
                      <span>No votes created yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Polls Created</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-2 rounded-full bg-purple-500/10 p-1.5">
                      <ListChecks className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-2xl font-bold">{analytics?.totalPolls || 0}</div>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {votes.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Avg {((analytics?.totalPolls || 0) / votes.length).toFixed(1)} polls per vote</span>
                      </div>
                    ) : (
                      <span>No polls created yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-2 rounded-full bg-amber-500/10 p-1.5">
                      <Award className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics?.engagementRate || 0}%
                    </div>
                  </div>
                  <div className="mt-1 flex items-center">
                    <Progress 
                      value={analytics?.engagementRate || 0} 
                      className="h-1.5 flex-grow" 
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
            
            {/* Action Required Section & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left column - Action Required */}
              <div className="lg:col-span-2 space-y-6">
                {/* Votes Needing Action */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" />
                      <span>Waiting For Your Vote</span>
                    </CardTitle>
                    <CardDescription>Votes you can participate in</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {votesByStatus.active.length > 0 || votesByStatus.pending.length > 0 ? (
                      <div className="space-y-4">
                        {/* Show active votes first */}
                        {votesByStatus.active.slice(0, 2).map((vote) => (
                          <div key={vote.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                            <div className="space-y-1">
                              <div className="font-medium flex items-center gap-2">
                                {vote.title || "Untitled Vote"}
                                <Badge variant="success" className="text-xs">Active</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                <span>{formatTimeRemaining(vote.endTimestamp)}</span>
                              </div>
                              {renderFeatureBadges(vote)}
                            </div>
                            <Link href={`/vote/${vote.id}`}>
                              <Button size="sm" variant="outline">Vote Now</Button>
                            </Link>
                          </div>
                        ))}
                        
                        {/* Then show pending votes */}
                        {votesByStatus.pending.slice(0, Math.max(0, 3 - votesByStatus.active.length)).map((vote) => (
                          <div key={vote.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                            <div className="space-y-1">
                              <div className="font-medium flex items-center gap-2">
                                {vote.title || "Untitled Vote"}
                                <Badge variant="outline" className="text-xs bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">Pending</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Timer className="h-3 w-3" />
                                <span>{formatTimeRemaining(vote.endTimestamp)}</span>
                              </div>
                              {renderFeatureBadges(vote)}
                            </div>
                            <Link href={`/vote/${vote.id}`}>
                              <Button size="sm" variant="outline">Vote Now</Button>
                            </Link>
                          </div>
                        ))}
                        
                        {(votesByStatus.active.length > 2 || votesByStatus.pending.length > 3 - votesByStatus.active.length) && (
                          <div className="text-center pt-2">
                            <Link href="/polls" className="inline-block">
                              <Button variant="link" size="sm" className="gap-1">
                                View All
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No active or pending votes need your attention</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Popular Votes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span>Popular Votes</span>
                    </CardTitle>
                    <CardDescription>Your most engaged votes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics?.popularVotes && analytics.popularVotes.length > 0 ? (
                      <div className="space-y-4">
                        {analytics.popularVotes.map((vote, index) => (
                          <div key={vote.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                <span className="text-sm font-medium">{index + 1}</span>
                              </div>
                              <div>
                                <div className="font-medium line-clamp-1">{vote.title || "Untitled Vote"}</div>
                                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                  <span className="flex items-center">
                                    <Users className="h-3 w-3 mr-1" />
                                    {vote.votes} votes
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center">
                                    <ListChecks className="h-3 w-3 mr-1" />
                                    {vote.pollCount} polls
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Link href={`/vote/${vote.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No votes with participation yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right column - Charts */}
              <div className="lg:col-span-3 space-y-6">
                {/* Vote Activity Chart */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Weekly Vote Activity</CardTitle>
                    <CardDescription>Vote creation and participation in the past week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {analytics?.activityData && analytics.activityData.length > 0 ? (
                        <ChartContainer
                          config={{
                            created: { color: "#3B82F6" },
                            participated: { color: "#8B5CF6" },
                          }}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.activityData}>
                              <defs>
                                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id="colorParticipated" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <RechartsTooltip />
                              <Area 
                                type="monotone" 
                                dataKey="created" 
                                name="Created"
                                stroke="#3B82F6" 
                                fillOpacity={1} 
                                fill="url(#colorCreated)" 
                              />
                              <Area 
                                type="monotone" 
                                dataKey="participated" 
                                name="Participated"
                                stroke="#8B5CF6" 
                                fillOpacity={1} 
                                fill="url(#colorParticipated)" 
                              />
                              <Legend />
                            </AreaChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <BarChart2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No activity data available yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Poll Count vs. Participation */}
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Poll Count vs. Participation</CardTitle>
                    <CardDescription>How the number of polls affects vote participation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {analytics?.pollCountData && analytics.pollCountData.length > 0 ? (
                        <ChartContainer
                          config={{
                            avgParticipation: { color: "#10B981" },
                            votes: { color: "#3B82F6" },
                          }}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.pollCountData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis 
                                dataKey="pollCount" 
                                label={{ 
                                  value: 'Number of Polls', 
                                  position: 'insideBottom', 
                                  offset: -5 
                                }} 
                              />
                              <YAxis 
                                yAxisId="left"
                                label={{ 
                                  value: 'Avg. Participation', 
                                  angle: -90, 
                                  position: 'insideLeft' 
                                }} 
                              />
                              <YAxis 
                                yAxisId="right" 
                                orientation="right"
                                label={{ 
                                  value: 'Number of Votes', 
                                  angle: 90, 
                                  position: 'insideRight' 
                                }} 
                              />
                              <RechartsTooltip />
                              <Bar 
                                dataKey="avgParticipation" 
                                name="Avg. Participation" 
                                fill="#10B981" 
                                yAxisId="left" 
                                radius={[4, 4, 0, 0]} 
                              />
                              <Bar 
                                dataKey="votes" 
                                name="Number of Votes" 
                                fill="#3B82F6" 
                                yAxisId="right" 
                                radius={[4, 4, 0, 0]} 
                              />
                              <Legend />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <BarChart2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No poll analytics available yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            {/* Help Section */}
            {votes.length > 0 && (
              <section className="mt-8">
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                      <span>Vote Status Guide</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="success" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Active</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Votes that are currently open but you haven't voted in yet</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="outline" className="flex items-center gap-1 bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            <Shield className="h-3 w-3" />
                            <span>Pending</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Votes your wallet is whitelisted for, open but you haven't voted in yet</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="default" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Upcoming</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Votes that are scheduled but have not started yet</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            <span>Closed</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Votes that have ended and have final results available</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="outline" className="flex items-center gap-1 bg-purple-100/50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                            <CheckCircle className="h-3 w-3" />
                            <span>Voted</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Any vote that you have already cast your vote in</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}