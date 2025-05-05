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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatDistanceToNow } from "date-fns"
import { ShareDialog } from "@/components/share-dialog"

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [selectedVote, setSelectedVote] = useState<any | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterDate, setFilterDate] = useState("newest")

  const wallet = useWallet()
  const { getMyVotes, loading, error } = useSuiVote()
  const [votes, setVotes] = useState<any[]>([])

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

  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch (e) {
      return "Unknown date"
    }
  }

  const filteredVotes = votes
    .filter((vote) => vote.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((vote) => (filterStatus === "all" ? true : vote.status === filterStatus))
    .sort((a, b) => {
      const dateA = new Date(a.created).getTime()
      const dateB = new Date(b.created).getTime()
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
            <h1 className="text-3xl font-bold tracking-tight">Your Votes</h1>
            <p className="text-muted-foreground mt-1">Manage and track all your community votes</p>
          </div>
          <Link href="/create">
            <Button size="lg" className="gap-2">
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
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <Card className="overflow-hidden transition-all hover:shadow-md">
                  <div
                    className={`h-2 w-full ${vote.status === "active" ? "bg-green-500" : vote.status === "upcoming" ? "bg-blue-500" : "bg-gray-300"}`}
                  />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl">{vote.title}</CardTitle>
                      <Badge
                        variant={
                          vote.status === "active" ? "success" : vote.status === "upcoming" ? "default" : "secondary"
                        }
                      >
                        {vote.status === "active" ? "Active" : vote.status === "upcoming" ? "Upcoming" : "Closed"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-2">{vote.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{vote.created}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{vote.votes} votes</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{vote.pollCount}</span>
                      <span className="text-sm text-muted-foreground">poll{vote.pollCount !== 1 ? "s" : ""}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-4">
                    <Link href={`/vote/${vote.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleShare(vote)}>
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <MoreHorizontal className="h-4 w-4" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/edit/${vote.id}`}>
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                        </Link>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              {searchQuery
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
          title={selectedVote.title}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/vote/${selectedVote.id}`}
        />
      )}
    </div>
  )
}
