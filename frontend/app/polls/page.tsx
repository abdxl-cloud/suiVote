"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  Eye,
  Share2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  CheckCircle,
  ListChecks,
  Loader2,
  AlertCircle,
  Shield,
  Clock,
  Timer,
  Info,
  Tag,
  Lock,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useSuiVote } from "@/hooks/use-suivote"
import { useWallet } from "@suiet/wallet-kit"
import { formatDistanceToNow, format, formatDistance, addDays } from "date-fns"
import { ShareDialog } from "@/components/share-dialog"

export default function PollsPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [selectedVote, setSelectedVote] = useState<any | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("newest")
  const [now, setNow] = useState(new Date())

  const wallet = useWallet()
  const { getMyVotes, loading, error } = useSuiVote()
  const [votes, setVotes] = useState<any[]>([])

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
          const { data } = await getMyVotes(wallet.address!)
          setVotes(data)
        } catch (err) {
          console.error("Error fetching votes:", err)
        }
      }
      fetchVotes()
    }
  }, [wallet.connected, wallet.address, getMyVotes])

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

  const handleShare = (vote: any) => {
    setSelectedVote(vote)
    setShareDialogOpen(true)
  }

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

  const calculatePercentage = (vote: number, total: number) => {
    if (!total) return 0
    return Math.round((vote / total) * 100)
  }

  const renderStatusBadge = (status: string) => {
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

  // Render feature badges (whitelist, token requirement)
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

  const filteredVotes = votes
    .filter((vote) => vote.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((vote) => (filterStatus === "all" ? true : vote.status === filterStatus))
    .sort((a, b) => {
      // Use created date or fallback to endTimestamp if created is missing
      const dateA = new Date(a.created || a.endTimestamp).getTime()
      const dateB = new Date(b.created || b.endTimestamp).getTime()
      return filterDate === "newest" ? dateB - dateA : dateA - dateB
    })

  return (
    <div className="container py-10 px-4 md:px-6">
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
            <h1 className="text-3xl font-bold tracking-tight">Your Polls</h1>
            <p className="text-muted-foreground mt-1">
              {votes.length > 0 
                ? `${votes.length} polls available. ${votes.filter(v => v.status === 'active' || v.status === 'pending').length} need your attention.`
                : "Manage and track all your community votes"}
            </p>
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
            <AlertDescription>Please connect your wallet to view your votes.</AlertDescription>
          </Alert>
        )}

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
        >
          <div className="relative w-full sm:w-[260px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search votes..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setFilterStatus("all")} className="flex items-center justify-between">
                  All Votes
                  {filterStatus === "all" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterStatus("active")}
                  className="flex items-center justify-between"
                >
                  Active Votes
                  {filterStatus === "active" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterStatus("pending")}
                  className="flex items-center justify-between"
                >
                  Pending Votes
                  {filterStatus === "pending" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterStatus("upcoming")}
                  className="flex items-center justify-between"
                >
                  Upcoming Votes
                  {filterStatus === "upcoming" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterStatus("voted")}
                  className="flex items-center justify-between"
                >
                  Voted By Me
                  {filterStatus === "voted" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFilterStatus("closed")}
                  className="flex items-center justify-between"
                >
                  Closed Votes
                  {filterStatus === "closed" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilterDate("newest")} className="flex items-center justify-between">
                  Newest First
                  {filterDate === "newest" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterDate("oldest")} className="flex items-center justify-between">
                  Oldest First
                  {filterDate === "oldest" && <CheckCircle className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredVotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVotes.map((vote, index) => (
              <motion.div
                key={vote.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.5) }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Card className="overflow-hidden transition-all hover:shadow-md flex flex-col h-full">
                  <div
                    className={`h-2 w-full ${
                      vote.status === "active" ? "bg-green-500" : 
                      vote.status === "pending" ? "bg-amber-500" : 
                      vote.status === "upcoming" ? "bg-blue-500" : 
                      vote.status === "voted" ? "bg-purple-500" : "bg-gray-300"
                    }`}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-xl line-clamp-1">{vote.title || "Untitled Vote"}</CardTitle>
                      {renderStatusBadge(vote.status)}
                    </div>
                    <CardDescription className="line-clamp-2 min-h-[40px]">
                      {vote.description || " "}
                    </CardDescription>
                    {renderFeatureBadges(vote)}
                  </CardHeader>
                  <CardContent className="pb-4 flex-grow">
                    <div className="space-y-3">
                      {/* Date info */}
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{vote.created || "Unknown date"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{vote.votes} votes</span>
                        </div>
                      </div>
                      
                      {/* Time remaining for active/pending/upcoming votes */}
                      {(vote.status === "active" || vote.status === "pending") && (
                        <div className="mt-3">
                          <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Timer className="h-4 w-4" />
                              {formatTimeRemaining(vote.endTimestamp)}
                            </span>
                          </div>
                          <Progress 
                            value={100 - calculatePercentage(
                              vote.endTimestamp - now.getTime(),
                              vote.endTimestamp - new Date(vote.created || vote.startTimestamp).getTime()
                            )} 
                            className="h-1.5"
                          />
                        </div>
                      )}

                      {vote.status === "upcoming" && (
                        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>Starts {formatDistanceToNow(new Date(vote.startTimestamp), { addSuffix: true })}</span>
                        </div>
                      )}

                      {/* Whitelist stats */}
                      {vote.hasWhitelist && vote.whitelistCount && (
                        <div className="mt-2 text-sm flex items-center gap-1">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>{vote.votes} of {vote.whitelistCount} whitelisted addresses voted</span>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-1">
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{vote.pollCount || 0}</span>
                        <span className="text-sm text-muted-foreground">poll{(vote.pollCount !== 1) ? "s" : ""}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-4 mt-auto">
                    <Link href={`/vote/${vote.id}`} className="w-1/2">
                      <Button 
                        variant={vote.status === "active" || vote.status === "pending" ? "default" : "ghost"} 
                        size="sm" 
                        className="gap-1 w-full"
                      >
                        <Eye className="h-4 w-4" />
                        {vote.status === "active" || vote.status === "pending" 
                          ? "Vote Now" 
                          : vote.status === "voted" 
                          ? "Vote" 
                          : "View"}
                      </Button>
                    </Link>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="px-2.5" onClick={() => handleShare(vote)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="px-2.5">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/vote/${vote.id}`}>
                            <DropdownMenuItem className="cursor-pointer">
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </Link>
                          {vote.creator === wallet.address && (
                            <>
                              <Link href={`/edit/${vote.id}`}>
                                <DropdownMenuItem className="cursor-pointer">Edit</DropdownMenuItem>
                              </Link>
                              <DropdownMenuItem className="cursor-pointer">Duplicate</DropdownMenuItem>
                              {vote.status !== "closed" && (
                                <DropdownMenuItem className="cursor-pointer text-amber-600 dark:text-amber-400">
                                  {vote.status === "upcoming" ? "Cancel Vote" : "Close Early"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem className="cursor-pointer" onClick={() => handleShare(vote)}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <Link href={`https://explorer.sui.io/object/${vote.id}`} target="_blank" rel="noopener noreferrer">
                            <DropdownMenuItem className="cursor-pointer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View on Explorer
                            </DropdownMenuItem>
                          </Link>
                          {vote.creator === wallet.address && (
                            <DropdownMenuItem className="cursor-pointer text-destructive">Delete</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : wallet.connected ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted rounded-full p-3 mb-4">
              <ListChecks className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No votes found</h3>
            <p className="text-muted-foreground mt-1 mb-4 max-w-md">
              {searchQuery || filterStatus !== "all"
                ? "No votes match your search criteria."
                : "You haven't created or participated in any votes yet."}
            </p>
            <Link href="/create">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Vote
              </Button>
            </Link>
          </div>
        ) : null}
      </motion.div>

      {selectedVote && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          title={selectedVote.title || "Untitled Vote"}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${selectedVote.id}`}
        />
      )}
    </div>
  )
}