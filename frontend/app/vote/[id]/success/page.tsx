"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Share2,
  Home,
  BarChart2
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShareDialog } from "@/components/share-dialog"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import Link from "next/link"
import { SUI_CONFIG } from "@/config/sui-config"
import { cn } from "@/lib/utils"

export default function VoteSuccessPage() {
  const params = useParams()
  const router = useRouter()
  const wallet = useWallet()
  const suivote = useSuiVote()
  
  const [voteDetails, setVoteDetails] = useState(null)
  const [txDigest, setTxDigest] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Get the transaction digest from URL query parameters or local storage
  useEffect(() => {
    // Only run this once to avoid infinite loops
    if (hasInitialized) return;
    
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const digest = urlParams.get("digest")
      if (digest) {
        setTxDigest(digest)
        // Store in localStorage for future reference
        localStorage.setItem(`vote_${params.id}_txDigest`, digest)
      } else {
        // Try to get from local storage as fallback
        const storedDigest = localStorage.getItem(`vote_${params.id}_txDigest`)
        if (storedDigest) {
          setTxDigest(storedDigest)
        }
      }
    }
    
    setHasInitialized(true)
  }, [params.id, hasInitialized]);

  // Add a simple celebration effect
  useEffect(() => {
    if (!hasInitialized) return;
    
    // No animation effect needed - we'll just return to avoid any issues
    return () => {};
  }, [hasInitialized]);

  // Memoize the fetchVoteDetails function to prevent recreation on each render
  const fetchVoteDetails = useCallback(async () => {
    try {
      if (!params.id) {
        setError("Vote ID is required")
        setLoading(false)
        return;
      }
      
      // Get vote details
      const details = await suivote.getVoteDetails(params.id)
      
      if (!details) {
        setError("Vote not found")
        setLoading(false)
        return;
      }
      
      console.log("Vote details loaded:", details.title);
      setVoteDetails(details)
      
      // Update document title
      document.title = `Vote Submitted - ${details.title} - SuiVote`
      
    } catch (err) {
      console.error("Error fetching vote details:", err)
      setError(err.message || "Failed to load vote details")
    } finally {
      setLoading(false)
    }
  }, [params.id, suivote]);

  // Fetch data only once on component mount
  useEffect(() => {
    if (!hasInitialized) return;
    
    if (params.id) {
      setLoading(true);
      fetchVoteDetails();
      
      // Set up real-time updates subscription if we have a vote ID
      const unsubscribe = suivote.subscribeToVoteUpdates(params.id, (updatedVoteDetails) => {
        console.log("Received vote update on success page:", updatedVoteDetails)
        // Update the vote state with the latest data
        setVoteDetails(updatedVoteDetails)
      })
      
      // Clean up subscription when component unmounts or params change
      return () => {
        unsubscribe()
      }
    }
  }, [params.id, hasInitialized, suivote, fetchVoteDetails]);
  
  // Format date helper
  const formatDate = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, { 
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch (e) {
      return "Date unavailable"
    }
  }
  
  // Truncate address for display
  const truncateAddress = (address) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }
  
  // Get transaction explorer URL
  const getTransactionExplorerUrl = () => {
    if (!txDigest) return "#"

    const network = SUI_CONFIG.NETWORK.toLowerCase()
    if (network === "mainnet") {
      return `https://explorer.sui.io/txblock/${txDigest}`
    } else {
      return `https://explorer.sui.io/txblock/${txDigest}?network=${network}`
    }
  }
  
  // Handle share dialog
  const handleShare = () => {
    setShareDialogOpen(true)
  }
  
  // Handle manual redirection
  const handleViewResults = () => {
    if (voteDetails?.showLiveStats) {
      router.push(`/vote/${params.id}`);
    }
  }
  
  if (loading) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
          <p className="text-muted-foreground">Loading vote details...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="container max-w-3xl py-10 px-4 md:px-6">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/polls">
              <Home className="mr-2 h-4 w-4" />
              Return to Polls
            </Link>
          </Button>
        </div>
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
        transition={{ duration: 0.5 }}
      >
        <Card className="border-2 shadow-lg mb-8">
          <CardHeader className="pb-6 pt-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-3xl">Vote Submitted!</CardTitle>
            <CardDescription className="text-lg mt-2">
              Your vote on "{voteDetails?.title || 'this poll'}" has been successfully recorded.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pb-8">
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Thank you for participating in this vote. Your input has been securely recorded on the blockchain.
              </AlertDescription>
            </Alert>
            
            {txDigest && (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">Transaction Details:</p>
                <div className="flex items-center justify-between">
                  <code className="bg-muted p-2 rounded text-xs truncate max-w-xs">{txDigest}</code>
                  <a 
                    href={getTransactionExplorerUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/90 transition-colors flex items-center gap-1 ml-2"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="gap-2 flex-1">
                <Link href="/polls">
                  <Home className="h-4 w-4" />
                  Return to Polls
                </Link>
              </Button>
              
              {voteDetails?.showLiveStats && (
                <Button 
                  asChild
                  variant="outline" 
                  className="gap-2 flex-1"
                >
                  <Link href={`/vote/${params.id}`}>
                    <BarChart2 className="h-4 w-4" />
                    View Results
                  </Link>
                </Button>
              )}
              
              <Button 
                onClick={handleShare} 
                variant="outline" 
                className="gap-2 flex-1"
              >
                <Share2 className="h-4 w-4" />
                Share This Vote
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {voteDetails && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">About This Vote</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Vote Title</h3>
                <p className="text-muted-foreground">{voteDetails.title}</p>
              </div>
              
              {voteDetails.description && (
                <div>
                  <h3 className="font-medium mb-1">Description</h3>
                  <p className="text-muted-foreground">{voteDetails.description}</p>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <span>Status: </span>
                  <span className={cn(
                    voteDetails.status === "active" ? "text-green-600 dark:text-green-400" :
                    voteDetails.status === "upcoming" ? "text-blue-600 dark:text-blue-400" :
                    "text-muted-foreground"
                  )}>
                    {voteDetails.status.charAt(0).toUpperCase() + voteDetails.status.slice(1)}
                  </span>
                </Badge>
                
                <Badge variant="outline" className="flex items-center gap-1">
                  <span>Total Votes: </span>
                  <span>{voteDetails.totalVotes}</span>
                </Badge>
                
                {voteDetails.pollsCount && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span>Polls: </span>
                    <span>{voteDetails.pollsCount}</span>
                  </Badge>
                )}
                
                {voteDetails.endTimestamp && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span>Ends: </span>
                    <span>{formatDate(voteDetails.endTimestamp)}</span>
                  </Badge>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center pt-2 pb-6">
            
            </CardFooter>
          </Card>
        </motion.div>
      )}
      
      <Separator className="my-8" />
      
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Vote recorded on <span className="font-medium">{SUI_CONFIG.NETWORK}</span>. 
          {!voteDetails?.showLiveStats && " Results will be available once the vote closes."}
        </p>
      </div>
      
      {/* Share dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={voteDetails?.title || "Vote Submitted"}
        url={typeof window !== "undefined" ? window.location.origin + `/vote/${params.id}` : ""}
      />
    </div>
  )
}