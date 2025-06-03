"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Share2,
  Home,
  BarChart2,
  Copy,
  Loader2,
  Sparkles,
  Calendar,
  Twitter,
  Facebook,
  Send,
  QrCode,
  ClipboardCopy,
  Link as LinkIcon,
  ArrowRight,
  Users,
  ChevronRight,
  AlertCircle, // Added missing import
  Clock, // Added missing import
  Info, // Added missing import
  Wallet, // Added missing import
  ListChecks, // Added missing import
  Plus // Moved from the bottom to the top imports
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ShareDialog } from "@/components/share-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import { useWallet } from "@/contexts/wallet-context"
import confetti from "canvas-confetti"
import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';



export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const suivote = useSuiVote()
  const wallet = useWallet()
  const shareButtonRef = useRef(null)

  // Get transaction digest from URL params
  const txDigest = searchParams.get("digest")

  // Improved state management
  const [fetchState, setFetchState] = useState({
    loading: true,
    error: null,
    voteId: null,
    voteDetails: null,
    attemptCount: 0
  });

  // UI states
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrVisible, setQrVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("share")
  const [confettiLaunched, setConfettiLaunched] = useState(false)

  // Convenience references for components
  const loading = fetchState.loading;
  const error = fetchState.error;
  const voteDetails = fetchState.voteDetails;
  const voteId = fetchState.voteId;

  // Comprehensive vote data fetching
  useEffect(() => {
    let isMounted = true;
    
    const fetchVoteData = async () => {
      // Skip if we've already loaded successfully or tried too many times
      if (fetchState.voteDetails || fetchState.attemptCount > 5) return;
      
      try {
        // Start with transaction digest from URL
        const digest = searchParams.get("digest");
        if (!digest) {
          throw new Error("Transaction digest not found in URL");
        }
        
        // If we don't have a vote ID yet, try to extract it from the transaction
        let targetVoteId = fetchState.voteId;
        
        if (!targetVoteId) {
          console.log("Attempting to extract vote ID from transaction:", digest);
          
          // Create new client directly using network from config
          const client = new SuiClient({ 
            url: getFullnodeUrl(SUI_CONFIG.NETWORK.toLowerCase()) 
          });
          
          // Fetch transaction with all details
          const txResult = await client.getTransactionBlock({
            digest,
            options: { 
              showEffects: true,
              showObjectChanges: true,  // Important to get created objects
              showEvents: true
            }
          });
          
          console.log("Transaction data received:", 
            txResult.effects?.created?.length || 0, "created objects",
            txResult.objectChanges?.length || 0, "object changes",
            txResult.events?.length || 0, "events"
          );
          
          // Look for Vote object in object changes (better than effects)
          let voteObjectId = null;
          
          // Check object changes first (most reliable)
          if (txResult.objectChanges && txResult.objectChanges.length > 0) {
            const voteObject = txResult.objectChanges.find(change => 
              change.type === 'created' && 
              change.objectType && 
              change.objectType.includes('::voting::Vote')
            );
            
            if (voteObject) {
              voteObjectId = voteObject.objectId;
              console.log("Found vote ID from object changes:", voteObjectId);
            }
          }
          
          // Fall back to created objects in effects
          if (!voteObjectId && txResult.effects?.created && txResult.effects.created.length > 0) {
            // Try to identify the Vote object from the list of created objects
            // We'll look at each object's type if available
            for (const obj of txResult.effects.created) {
              if (obj.owner?.AddressOwner === 'Shared') {
                // Most likely this is our vote object (votes are shared)
                voteObjectId = obj.reference.objectId;
                console.log("Found vote ID from shared object:", voteObjectId);
                break;
              }
            }
            
            // If we still don't have an ID, take the second object as a fallback
            if (!voteObjectId && txResult.effects.created.length > 1) {
              voteObjectId = txResult.effects.created[1].reference.objectId;
              console.log("Falling back to second created object:", voteObjectId);
            }
          }
          
          // Also check for vote creation events
          if (!voteObjectId && txResult.events && txResult.events.length > 0) {
            const voteCreatedEvent = txResult.events.find(event => 
              event.type && event.type.includes('::voting::VoteCreated')
            );
            
            if (voteCreatedEvent && voteCreatedEvent.parsedJson && voteCreatedEvent.parsedJson.vote_id) {
              voteObjectId = voteCreatedEvent.parsedJson.vote_id;
              console.log("Found vote ID from VoteCreated event:", voteObjectId);
            }
          }
          
          // If we found a vote ID, update state
          if (voteObjectId) {
            targetVoteId = voteObjectId;
            if (isMounted) {
              setFetchState(prev => ({
                ...prev, 
                voteId: voteObjectId,
                attemptCount: prev.attemptCount + 1
              }));
            }
          } else {
            console.error("Could not find vote ID in transaction");
            throw new Error("Could not identify vote object in transaction");
          }
        }
        
        // Now try to fetch details if we have a vote ID
        if (targetVoteId) {
          console.log("Fetching vote details for ID:", targetVoteId);
          const details = await suivote.getVoteDetails(targetVoteId);
          
          if (details) {
            console.log("Successfully retrieved vote details:", details.title);
            if (isMounted) {
              setFetchState(prev => ({
                ...prev,
                loading: false,
                voteDetails: details
              }));
              
              document.title = `Vote Created: ${details.title} - SuiVote`;
              
              // Launch confetti with a slight delay for better UX
              setTimeout(() => {
                launchConfetti();
              }, 500);
            }
          } else {
            console.warn("Vote details returned null for ID:", targetVoteId);
            if (isMounted) {
              // Increment attempt count but keep trying
              setFetchState(prev => ({
                ...prev,
                attemptCount: prev.attemptCount + 1,
                // Don't set error yet, we'll retry
              }));
              
              // If we've made a few attempts without success, add a delay
              if (fetchState.attemptCount >= 2) {
                console.log(`Attempt ${fetchState.attemptCount + 1} failed, retrying in 2 seconds...`);
                setTimeout(() => {
                  if (isMounted) {
                    // Force a re-render to trigger the effect again
                    setFetchState(prev => ({ ...prev }));
                  }
                }, 2000);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error in fetch flow:", err);
        if (isMounted) {
          setFetchState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load vote details",
            attemptCount: prev.attemptCount + 1
          }));
        }
      }
    };
    
    fetchVoteData();
    
    return () => {
      isMounted = false;
    };
  }, [fetchState.voteId, fetchState.attemptCount, searchParams]);

  // Format date
  const formatDate = (timestamp: number) => {
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
      })
    } catch (e) {
      console.error("Error formatting date:", e)
      return "Date unavailable"
    }
  }

  // Format remaining time
  const formatRemainingTime = (endTimestamp: number) => {
    try {
      const now = Date.now()
      const timeRemaining = endTimestamp - now

      if (timeRemaining <= 0) return "Ended"

      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
      const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

      if (days > 0) {
        return `${days}d ${hours}h remaining`
      } else {
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m remaining`
      }
    } catch (e) {
      return "Time unavailable"
    }
  }

  // Truncate address for display
  const truncateAddress = (address: string | null | undefined) => {
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

  // Get vote explorer URL
  const getVoteExplorerUrl = () => {
    if (!voteId) return "#"

    const network = SUI_CONFIG.NETWORK.toLowerCase()
    if (network === "mainnet") {
      return `https://explorer.sui.io/object/${voteId}`
    } else {
      return `https://explorer.sui.io/object/${voteId}?network=${network}`
    }
  }

  // Generate share URL
  const getShareUrl = () => {
    if (typeof window === "undefined") return ""

    return `${window.location.origin}/vote/${voteId}`
  }

  // Handle copy share link
  const handleCopyLink = async () => {
    const shareUrl = getShareUrl()

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)

      // Animate the copy button
      if (shareButtonRef.current) {
        const button = shareButtonRef.current as HTMLElement
        button.classList.add("scale-110")
        setTimeout(() => button.classList.remove("scale-110"), 200)
      }

      toast.success("Link copied to clipboard", {
        description: "Share it with your participants"
      })

      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Failed to copy link")
    }
  }

  // Launch confetti effect
  const launchConfetti = () => {
    if (confettiLaunched) return
    setConfettiLaunched(true)

    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)

      // Since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      })
    }, 250)
  }

  // Handle share dialog
  const handleShare = () => {
    setShareDialogOpen(true)
  }

  // Toggle QR code visibility
  const toggleQrCode = () => {
    setQrVisible(prev => !prev)
  }

  // Create social share links
  const socialShareLinks = [
    {
      name: "Twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Vote on "${voteDetails?.title || 'My Vote'}" on SuiVote ✅`)}&url=${encodeURIComponent(getShareUrl())}`,
      color: "bg-[#1DA1F2] hover:bg-[#1a94da]",
    },
    {
      name: "Facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`,
      color: "bg-[#1877F2] hover:bg-[#166fe5]",
    },
    {
      name: "Telegram",
      icon: Send,
      url: `https://t.me/share/url?url=${encodeURIComponent(getShareUrl())}&text=${encodeURIComponent(`Vote on "${voteDetails?.title || 'My Vote'}" on SuiVote ✅`)}`,
      color: "bg-[#0088cc] hover:bg-[#0077b5]",
    },
  ];

  // Loading state with enhanced animation
  if (loading) {
    return (
      <div className="container max-w-4xl py-8 px-4 md:py-10 md:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center min-h-[60vh] space-y-8"
        >
          {/* Animated Logo/Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </motion.div>
          </motion.div>

          {/* Animated Text */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center space-y-3"
          >
            <motion.h2
              className="text-2xl font-semibold text-foreground font-poppins"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              Processing Your Vote
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-muted-foreground max-w-md font-inter"
            >
              We're fetching your vote details and preparing everything for you...
            </motion.p>
          </motion.div>

          {/* Progress Dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="flex space-x-2"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-primary rounded-full"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut"
                }}
              />
            ))}
          </motion.div>

          {/* Loading Steps */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="text-center space-y-2 text-sm text-muted-foreground font-inter"
          >
            <motion.div
              className="flex items-center justify-center space-x-2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            >
              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
              <span>Verifying transaction</span>
            </motion.div>
            <motion.div
              className="flex items-center justify-center space-x-2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            >
              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
              <span>Loading vote details</span>
            </motion.div>
            <motion.div
              className="flex items-center justify-center space-x-2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
            >
              <div className="w-1.5 h-1.5 bg-primary rounded-full" />
              <span>Preparing success page</span>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-4xl py-10 px-4 md:px-6">
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading vote details</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-8 text-center">
            <p className="mb-6 text-muted-foreground">
              We couldn't load the vote details. However, your vote was created successfully
              {txDigest && " and the transaction was processed on the blockchain"}.
            </p>

            {txDigest && (
              <div className="mb-6 text-sm">
                <Label>Transaction ID</Label>
                <div className="flex items-center justify-center mt-2">
                  <code className="bg-muted p-2 rounded text-xs overflow-x-auto max-w-full">{txDigest}</code>
                  <a
                    href={getTransactionExplorerUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:text-primary/90 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild>
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Return to Dashboard
                </Link>
              </Button>

              <Button variant="outline" asChild>
                <Link href="/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Another Vote
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8 px-4 md:py-10 md:px-6">
      {/* Floating action bar on mobile */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-background/80 backdrop-blur-md border-t z-50 p-3 flex justify-center gap-3">
        <Button asChild className="flex-1" size="sm">
          <Link href={`/vote/${voteId}`}>
            <BarChart2 className="h-4 w-4 mr-1.5" />
            View
          </Link>
        </Button>

        <Button variant="outline" className="flex-1" size="sm" onClick={handleCopyLink} ref={shareButtonRef}>
          {copied ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>

        <Button variant="outline" className="flex-1" size="sm" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-1.5" />
          Share
        </Button>
      </div>

      {/* Back button */}
      <div className="mb-6 flex justify-between items-center">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
          <Link href="/create" className="gap-2 text-muted-foreground hover:text-foreground">
            Create Another Vote
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Card className="border border-border overflow-hidden shadow-sm relative bg-card">
          {/* Achievement badge */}
          <div className="absolute -right-12 -top-3 rotate-45 bg-primary text-primary-foreground text-xs font-medium py-1 w-36 text-center shadow-sm">
            CREATED
          </div>

          <CardHeader className="pb-6 pt-8 text-center">
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2
                }}
                className="relative"
              >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                >
                  <Sparkles className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              </motion.div>
            </div>
            <CardTitle className="text-3xl font-semibold text-center mb-3 text-foreground font-poppins">
              Vote Created Successfully!
            </CardTitle>
            <CardDescription className="text-lg text-center max-w-2xl mx-auto text-muted-foreground font-inter">
              {voteDetails ? (
                <span>
                  Your vote "<span className="font-medium">{voteDetails.title}</span>" has been published to the blockchain.
                </span>
              ) : (
                "Your vote has been successfully created and published to the blockchain."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-300">
                Your vote is now ready to receive responses. Share the link with participants to start collecting votes.
              </AlertDescription>
            </Alert>

            {/* Tabs for different actions */}
            <Tabs defaultValue="share" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="share" className="text-sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Share Vote</span>
                  <span className="sm:hidden">Share</span>
                </TabsTrigger>
                <TabsTrigger value="details" className="text-sm">
                  <Info className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Vote Details</span>
                  <span className="sm:hidden">Details</span>
                </TabsTrigger>
                <TabsTrigger value="tx" className="text-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Transaction</span>
                  <span className="sm:hidden">Tx</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="share" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                {/* Share link */}
                <div className="space-y-2">
                  <Label htmlFor="share-link" className="text-sm flex items-center justify-between">
                    <span>Share Link</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={toggleQrCode}>
                      <QrCode className="h-4 w-4 mr-1.5" />
                      <span className="text-xs">QR Code</span>
                    </Button>
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="share-link"
                      value={getShareUrl()}
                      readOnly
                      className="font-mono text-sm"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 gap-1.5 transition-all duration-200"
                      onClick={handleCopyLink}
                      ref={shareButtonRef}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>

                {/* QR Code */}
                <AnimatePresence>
                  {qrVisible && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-center my-4 overflow-hidden"
                    >
                      <div className="bg-white p-4 rounded-lg">
                        <QRCodeSVG
                          value={getShareUrl()}
                          size={180}
                          level="H"
                          includeMargin={true}
                          className="mx-auto"
                          imageSettings={{
                            src: "logo.png",
                            height: 60,
                            width: 60,
                            excavate: true,
                          }}
                        />
                        <p className="text-xs text-center mt-2 text-muted-foreground">Scan to vote</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Social sharing */}
                <div className="space-y-2">
                  <Label className="text-sm">Share on Social Media</Label>
                  <div className="flex flex-wrap gap-3">
                    {socialShareLinks.map((item) => (
                      <Button
                        key={item.name}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-white border-0 gap-1.5",
                          item.color
                        )}
                        asChild
                      >
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="hidden sm:inline">{item.name}</span>
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="hidden md:flex flex-col sm:flex-row gap-4 pt-2">
                  <Button asChild className="gap-2 flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all duration-200 font-medium">
                    <Link href={`/vote/${voteId}`}>
                      <BarChart2 className="h-4 w-4" />
                      View Vote
                    </Link>
                  </Button>

                  <Button
                    onClick={handleShare}
                    variant="outline"
                    className="gap-2 flex-1 border border-border hover:bg-muted/50 transition-all duration-200 font-medium"
                  >
                    <Share2 className="h-4 w-4" />
                    Share More Options
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                {voteDetails ? (
                  <>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Vote Title</h3>
                      <p className="font-medium text-lg">{voteDetails.title}</p>
                    </div>

                    {voteDetails.description && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Description</h3>
                        <p>{voteDetails.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Start Date</h3>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>{formatDate(voteDetails.startTimestamp)}</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">End Date</h3>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>{formatDate(voteDetails.endTimestamp)}</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Time Remaining</h3>
                        <Badge variant="outline" className="gap-1 bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
                          <Clock className="h-3.5 w-3.5" />
                          {formatRemainingTime(voteDetails.endTimestamp)}
                        </Badge>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Poll Count</h3>
                        <Badge variant="outline" className="gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          {voteDetails.pollsCount} {voteDetails.pollsCount === 1 ? "poll" : "polls"}
                        </Badge>
                      </div>
                    </div>

                    {voteDetails.requiredToken && (
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Token Requirement</h3>
                        <div className="flex items-center gap-2">
                          <Badge className="gap-1.5 bg-blue-100 dark:bg-blue-800/80 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700">
                            <Wallet className="h-3.5 w-3.5" />
                            {voteDetails.requiredAmount} {voteDetails.requiredToken.split("::").pop()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">required to vote</span>
                        </div>
                      </div>
                    )}

                    {/* Creator info */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Created by: {truncateAddress(voteDetails.creator)}</span>
                      </div>

                      <a
                        href={getVoteExplorerUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors text-xs"
                      >
                        View on Explorer <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {/* Action button */}
                    <div className="pt-2 hidden md:block">
                      <Button asChild className="w-full">
                        <Link href={`/vote/${voteId}`} className="gap-2">
                          <BarChart2 className="h-4 w-4" />
                          View Vote Details
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="bg-muted/50 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <Info className="h-6 w-6" />
                    </div>
                    <p>Vote details are not available.</p>
                    <p className="text-sm mt-1">The vote was created successfully, but we couldn't fetch additional details.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tx" className="focus-visible:outline-none focus-visible:ring-0">
                {txDigest ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm">Transaction ID</Label>
                      <div className="bg-muted/70 rounded-lg p-4 mt-1.5">
                        <div className="flex items-center justify-between">
                          <code className="text-xs sm:text-sm font-mono break-all">{txDigest}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 flex-shrink-0 h-8 w-8 p-0"
                            onClick={async () => {
                              await navigator.clipboard.writeText(txDigest)
                              toast.success("Transaction ID copied")
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Vote Object ID</Label>
                      <div className="bg-muted/70 rounded-lg p-4 mt-1.5">
                        <div className="flex items-center justify-between">
                          <code className="text-xs sm:text-sm font-mono break-all">{voteId}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 flex-shrink-0 h-8 w-8 p-0"
                            onClick={async () => {
                              if (voteId) {
                                await navigator.clipboard.writeText(voteId)
                                toast.success("Vote ID copied")
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Blockchain</span>
                        <Badge variant="outline">{SUI_CONFIG.NETWORK}</Badge>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Status</span>
                        <Badge className="bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
                          Confirmed
                        </Badge>
                      </div>
                      <div className="flex justify-end mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          asChild
                        >
                          <a
                            href={getTransactionExplorerUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on Explorer
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="bg-muted/50 rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-3">
                      <Info className="h-6 w-6" />
                    </div>
                    <p>Transaction details are not available.</p>
                    <p className="text-sm mt-1">The vote was created successfully, but we couldn't fetch the transaction details.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="pt-0 pb-6 flex justify-center">
            <div className="space-x-1 text-xs text-muted-foreground">
              <span>Created on {SUI_CONFIG.NETWORK.charAt(0).toUpperCase() + SUI_CONFIG.NETWORK.slice(1)}</span>
              <span>•</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Next steps card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-12 md:mb-6"
      >
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 font-semibold font-poppins">
              <Sparkles className="h-5 w-5 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-muted/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center">
                    <Share2 className="h-4 w-4 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs font-inter">Step 1</Badge>
                </div>
                <h3 className="font-medium mb-1 font-poppins">Share the Vote</h3>
                <p className="text-sm text-muted-foreground font-inter">Share the vote link with your intended participants</p>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs font-inter">Step 2</Badge>
                </div>
                <h3 className="font-medium mb-1 font-poppins">Collect Responses</h3>
                <p className="text-sm text-muted-foreground font-inter">Wait for participants to submit their votes</p>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center">
                    <BarChart2 className="h-4 w-4 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs font-inter">Step 3</Badge>
                </div>
                <h3 className="font-medium mb-1 font-poppins">View Results</h3>
                <p className="text-sm text-muted-foreground font-inter">Check vote results in real-time or after closing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Share dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={voteDetails?.title || "Vote Created"}
        url={getShareUrl()}
      />
    </div>
  )
}