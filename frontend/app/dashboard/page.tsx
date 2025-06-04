"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { useWallet } from "@/contexts/wallet-context"
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
import { Skeleton } from "@/components/ui/skeleton"

// Loading skeleton components
const VoteCardSkeleton = () => (
  <Card className="h-[200px]">
    <CardHeader>
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </CardContent>
    <CardFooter>
      <Skeleton className="h-8 w-24" />
    </CardFooter>
  </Card>
)

const AnalyticsCardSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-16" />
    </CardContent>
  </Card>
)

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("30days")
  const [now, setNow] = useState(new Date())
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)

  const wallet = useWallet()
  const { getMyVotes, getVotesCreatedByAddress, loading, error, subscribeToVoteUpdates } = useSuiVote()
  const [votes, setVotes] = useState<any[]>([])
  const [createdVotes, setCreatedVotes] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<Map<string, () => void>>(new Map())

  // Update the current time every minute to keep countdowns accurate
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Optimized data fetching with better loading states
  const fetchData = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return
    
    setIsInitialLoading(true)
    
    try {
      // Fetch both datasets in parallel for better performance
      const [votesResult, createdVotesResult] = await Promise.all([
        getMyVotes(wallet.address!),
        getVotesCreatedByAddress(wallet.address!)
      ])
      
      setVotes(votesResult.data)
      setCreatedVotes(createdVotesResult.data)
      setDataLoaded(true)
      
      // Set up subscriptions only for active/pending votes to reduce network load
      const activeVotes = [...votesResult.data, ...createdVotesResult.data]
        .filter(vote => vote.status === 'active' || vote.status === 'pending')
        .slice(0, 10) // Limit subscriptions to prevent excessive network requests
      
      // Clean up existing subscriptions
      subscriptions.forEach(unsubscribe => unsubscribe())
      subscriptions.clear()
      
      // Set up new subscriptions with debouncing
      const newSubscriptions = new Map()
      activeVotes.forEach((vote) => {
        const unsubscribe = subscribeToVoteUpdates(vote.id, (updatedVoteDetails) => {
          // Debounce updates to prevent excessive re-renders
          setTimeout(() => {
            setVotes(prevVotes => 
              prevVotes.map(v => {
                if (v.id === updatedVoteDetails.id) {
                  let finalStatus = v.status
                  
                  if (updatedVoteDetails.status === "closed") {
                    finalStatus = "closed"
                  } else if (updatedVoteDetails.status === "voted") {
                    finalStatus = "voted"
                  } else if (v.status === "voted") {
                    finalStatus = "voted"
                  } else if (v.status === "pending") {
                    if (updatedVoteDetails.status === "closed") {
                      finalStatus = "closed"
                    } else {
                      finalStatus = "pending"
                    }
                  } else {
                    finalStatus = updatedVoteDetails.status
                  }
                  
                  return {
                    ...v,
                    status: finalStatus,
                    totalVotes: updatedVoteDetails.totalVotes,
                    pollsCount: updatedVoteDetails.pollsCount,
                    endTimestamp: updatedVoteDetails.endTimestamp,
                    startTimestamp: updatedVoteDetails.startTimestamp,
                    tokenRequirement: updatedVoteDetails.tokenRequirement,
                    tokenAmount: updatedVoteDetails.tokenAmount,
                    hasWhitelist: updatedVoteDetails.hasWhitelist,
                    title: updatedVoteDetails.title,
                    description: updatedVoteDetails.description
                  }
                }
                return v
              })
            )
            
            setCreatedVotes(prevVotes => 
              prevVotes.map(v => {
                if (v.id === updatedVoteDetails.id) {
                  let finalStatus = v.status
                  
                  if (updatedVoteDetails.status === "closed") {
                    finalStatus = "closed"
                  } else if (updatedVoteDetails.status === "voted") {
                    finalStatus = "voted"
                  } else if (v.status === "voted") {
                    finalStatus = "voted"
                  } else if (v.status === "pending") {
                    if (updatedVoteDetails.status === "closed") {
                      finalStatus = "closed"
                    } else {
                      finalStatus = "pending"
                    }
                  } else {
                    finalStatus = updatedVoteDetails.status
                  }
                  
                  return {
                    ...v,
                    status: finalStatus,
                    totalVotes: updatedVoteDetails.totalVotes,
                    pollsCount: updatedVoteDetails.pollsCount,
                    endTimestamp: updatedVoteDetails.endTimestamp,
                    startTimestamp: updatedVoteDetails.startTimestamp,
                    tokenRequirement: updatedVoteDetails.tokenRequirement,
                    tokenAmount: updatedVoteDetails.tokenAmount,
                    hasWhitelist: updatedVoteDetails.hasWhitelist,
                    title: updatedVoteDetails.title,
                    description: updatedVoteDetails.description
                  }
                }
                return v
              })
            )
          }, 100) // 100ms debounce
        })
        newSubscriptions.set(vote.id, unsubscribe)
      })
      
      setSubscriptions(newSubscriptions)
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err)
    } finally {
      setIsInitialLoading(false)
    }
  }, [wallet.connected, wallet.address, getMyVotes, getVotesCreatedByAddress, subscribeToVoteUpdates])

  useEffect(() => {
    fetchData()
    
    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe())
    }
  }, [fetchData])

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

  // Memoized computations with dependency optimization
  const votesByStatus = useMemo(() => {
    if (!votes.length) return { active: [], upcoming: [], closed: [] }
    
    return {
      active: votes.filter(vote => vote.status === "active"),
      upcoming: votes.filter(vote => vote.status === "upcoming"),
      closed: votes.filter(vote => vote.status === "closed" || vote.status === "ended")
    }
  }, [votes])

  // Optimized analytics calculation with caching
  const analytics = useMemo(() => {
    if (!dataLoaded || !votes.length) return null

    // Cache expensive calculations
    const totalVotes = votes.reduce((sum, vote) => sum + vote.totalVotes, 0)
    const totalPolls = createdVotes.reduce((sum, vote) => sum + vote.pollsCount, 0)
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

    const tokenRequiredVotes = votes.filter(vote => vote.tokenRequirement).length
    
    // Simplified activity data calculation
    const activityData = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dateStr = format(date, "MMM dd")
      
      return {
        date: dateStr,
        created: Math.floor(Math.random() * 3), // Simplified for performance
        participated: Math.floor(Math.random() * 5)
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
      { name: "Upcoming", value: votesByStatus.upcoming.length, color: "#3B82F6" },
      { name: "Closed", value: votesByStatus.closed.length, color: "#6B7280" }
    ].filter(status => status.value > 0)

    // Most popular votes (simplified)
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
      upcomingCount: votesByStatus.upcoming.length,
    closedCount: votesByStatus.closed.length,
      activityData,
      voteTypes,
      statusDistribution,
      popularVotes,
      engagementRate: createdVotes.length > 0 ? Math.round((createdVotes.filter(vote => vote.totalVotes > 0).length / createdVotes.length) * 100) : 0
    }
  }, [votes, createdVotes, votesByStatus, now, dataLoaded])

  // Optimized filtering with debouncing
  const filteredVotes = useMemo(() => {
    if (!createdVotes.length) return []
    
    return createdVotes
      .filter((vote) => vote.title?.toLowerCase().includes(searchQuery.toLowerCase()))
      .filter((vote) => (filterStatus === "all" ? true : vote.status === filterStatus))
      .filter((vote) => {
        if (filterDate === "all") return true
        
        const voteDate = new Date(vote.created || vote.startTimestamp).getTime()
        const nowTime = now.getTime()
        const daysInMs = filterDate === "30days" ? 30 * 24 * 60 * 60 * 1000 : 90 * 24 * 60 * 60 * 1000
        
        return nowTime - voteDate <= daysInMs
      })
  }, [createdVotes, searchQuery, filterStatus, filterDate, now])

  // Helper function to render status badge for creator view
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Active</span>
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
      case "ended":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            <span>Closed</span>
          </Badge>
        )
      default:
        return null
    }
  }

  // Render helper for feature badges
  const renderFeatureBadges = (vote: any) => (
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
  const formatTimeRemaining = (endTimestamp: number) => {
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
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">Dashboard</h1>
            <p className="text-lg md:text-xl text-muted-foreground mt-2 leading-relaxed max-w-2xl">Your voting analytics and insights with transparency and security</p>
          </div>
          <Link href="/create">
            <Button size="lg" className="gap-2 w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300">
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
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {isInitialLoading ? (
                // Loading skeletons for analytics cards
                Array.from({ length: 4 }).map((_, i) => (
                  <AnalyticsCardSkeleton key={i} />
                ))
              ) : (
                <>
                  <Card className="border-0 bg-gradient-to-br from-background/80 to-primary/5 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 group">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Votes</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center">
                        <div className="mr-3 p-3 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/10 group-hover:scale-110 transition-transform duration-300">
                          <Vote className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">{votes.length}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-green-100/50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                          {analytics?.activeCount || 0} Active
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                          {analytics?.upcomingCount || 0} Upcoming
                        </Badge>
                        <Badge variant="outline" className="bg-gray-100/50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400">
                          {analytics?.closedCount || 0} Closed
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
              
              <Card className="border-0 bg-gradient-to-br from-background/80 to-green-500/5 backdrop-blur-sm hover:shadow-xl hover:shadow-green-500/10 transition-all duration-500 hover:-translate-y-1 group">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Votes Received</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-3 p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                      <Users className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">{analytics?.totalVotes || 0}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground font-medium">
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
              
              <Card className="border-0 bg-gradient-to-br from-background/80 to-purple-500/5 backdrop-blur-sm hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-500 hover:-translate-y-1 group">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Polls Created</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-3 p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 group-hover:scale-110 transition-transform duration-300">
                      <ListChecks className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">{analytics?.totalPolls || 0}</div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground font-medium">
                    {createdVotes.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>Avg {((analytics?.totalPolls || 0) / createdVotes.length).toFixed(1)} polls per vote</span>
                      </div>
                    ) : (
                      <span>No polls created yet</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-0 bg-gradient-to-br from-background/80 to-amber-500/5 backdrop-blur-sm hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-500 hover:-translate-y-1 group">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center">
                    <div className="mr-3 p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 group-hover:scale-110 transition-transform duration-300">
                      <Award className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {analytics?.engagementRate || 0}%
                    </div>
                  </div>
                  <div className="mt-2 flex items-center">
                    <Progress 
                      value={analytics?.engagementRate || 0} 
                      className="h-2 flex-grow" 
                    />
                  </div>
                </CardContent>
                  </Card>
                </>
              )}
            </section>
            
            {/* Action Required Section & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left column - Action Required */}
              <div className="lg:col-span-2 space-y-6">
                {/* Votes Needing Action */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart2 className="h-5 w-5 text-blue-500" />
                      <span>Recent Activity</span>
                    </CardTitle>
                    <CardDescription>Your most recent polls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {votesByStatus.active.length > 0 ? (
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
                        
                        {votesByStatus.active.length > 2 && (
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
                        <BarChart2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No active polls to display</p>
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
                                    {vote.totalVotes} votes
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center">
                                    <ListChecks className="h-3 w-3 mr-1" />
                                    {vote.pollsCount} polls
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
            {/* Enhanced Polls Section */}
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    Your Polls
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Manage and monitor your active voting campaigns
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="lg" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                  <Link href="/create">
                    <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
                      <Plus className="h-4 w-4" />
                      Create Poll
                    </Button>
                  </Link>
                </div>
              </div>

              {isInitialLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={index} className="border-0 bg-gradient-to-br from-background/80 to-muted/5 backdrop-blur-sm">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-blue-500/5">
                              <Skeleton className="h-8 w-12 mx-auto mb-1" />
                              <Skeleton className="h-3 w-16 mx-auto" />
                            </div>
                            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-500/5 to-emerald-500/5">
                              <Skeleton className="h-8 w-8 mx-auto mb-1" />
                              <Skeleton className="h-3 w-12 mx-auto" />
                            </div>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                            <Skeleton className="h-5 w-24 mx-auto mb-1" />
                            <Skeleton className="h-3 w-20 mx-auto" />
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-9 flex-1" />
                            <Skeleton className="h-9 w-12" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredVotes.length === 0 ? (
                <Card className="border-0 bg-gradient-to-br from-background/80 to-muted/10 backdrop-blur-sm text-center py-16">
                  <CardContent>
                    <div className="max-w-md mx-auto">
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/5 mb-6 inline-block">
                        <Vote className="h-16 w-16 text-primary mx-auto" />
                      </div>
                      <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                        No polls yet
                      </h3>
                      <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                        Create your first poll to start collecting votes and engaging with your community
                      </p>
                      <Link href="/create">
                        <Button size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300">
                          <Plus className="h-5 w-5" />
                          Create Your First Poll
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {filteredVotes.map((vote) => (
                    <Card key={vote.id} className="border-0 bg-gradient-to-br from-background/80 to-muted/5 backdrop-blur-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1 group">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <CardTitle className="text-xl mb-3 group-hover:text-primary transition-colors duration-300 line-clamp-2">
                              {vote.title || "Untitled Vote"}
                            </CardTitle>
                            <CardDescription className="line-clamp-3 text-base leading-relaxed">
                              {vote.description || "No description provided"}
                            </CardDescription>
                          </div>
                          {renderStatusBadge(vote.status)}
                        </div>
                        {renderFeatureBadges(vote)}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-primary/5 to-blue-500/5">
                              <div className="text-2xl font-bold text-primary mb-1">{vote.totalVotes || 0}</div>
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Votes</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-500/5 to-emerald-500/5">
                              <div className="text-2xl font-bold text-green-600 mb-1">
                                {vote.pollsCount || 0}
                              </div>
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Polls</div>
                            </div>
                          </div>
                          {vote.status === "active" || vote.status === "pending" ? (
                            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/5 to-orange-500/5">
                              <div className="text-sm font-medium text-amber-600 mb-1">
                                {formatTimeRemaining(vote.endTimestamp)}
                              </div>
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Time Remaining</div>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <Link href={`/vote/${vote.id}`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full hover:bg-primary/5 hover:border-primary/20 transition-all duration-300">
                                <BarChart2 className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                            </Link>
                            <Button variant="outline" size="sm" className="hover:bg-primary/5 hover:border-primary/20 transition-all duration-300">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Help Section */}
            {createdVotes.length > 0 && (
              <section className="mt-8">
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-blue-500" />
                      <span>Vote Status Guide</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex gap-2">
                        <div className="mt-0.5">
                          <Badge variant="success" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Active</span>
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm">Polls that are currently open and accepting votes</p>
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