"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  Share2,
  Home,
  BarChart2,
  AlertCircle,
  Clock,
  Trophy,
  Sparkles,
  Copy,
  Calendar,
  Users,
  Target,
  Zap,
  Hash
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ShareDialog } from "@/components/share-dialog"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import Link from "next/link"
import { SUI_CONFIG } from "@/config/sui-config"
import { cn } from "@/lib/utils"

interface VoteDetails {
  id: string
  title: string
  description?: string
  status: 'active' | 'upcoming' | 'ended' | 'pending' | 'closed' | 'voted'
  totalVotes: number
  pollsCount?: number
  endTimestamp?: number
  showLiveStats?: boolean
  creator?: string
}

interface VoteSuccessProps {
  vote: VoteDetails
  txDigest?: string | null
  onShare: () => void
}

// Confetti component
const Confetti = () => {
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 2,
    color: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 5)]
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: piece.color,
            left: `${piece.x}%`,
            top: '-10px'
          }}
          initial={{ y: -10, rotate: 0, opacity: 1 }}
          animate={{
            y: typeof window !== 'undefined' ? window.innerHeight + 10 : 800,
            rotate: 360,
            opacity: 0
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  )
}

// Floating particles background
const FloatingParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-gradient-to-r from-green-400/20 to-blue-400/20"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

export function VoteSuccess({ vote, txDigest, onShare }: VoteSuccessProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [copied, setCopied] = useState(false)

  // Trigger confetti on mount
  useEffect(() => {
    setShowConfetti(true)
    const timer = setTimeout(() => {
      setShowConfetti(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  // Truncate address for display
  const truncateAddress = (address: string) => {
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

  // Handle copy transaction
  const handleCopyTransaction = () => {
    if (txDigest) {
      navigator.clipboard.writeText(txDigest)
      setCopied(true)
      toast.success("Transaction hash copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }
  console.log(vote)


  return (
    <>
      {/* Confetti Animation */}
      <AnimatePresence>
        {showConfetti && <Confetti />}
      </AnimatePresence>

      {/* Floating Particles Background */}
      <FloatingParticles />

      <div className="relative z-10">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-6 shadow-lg">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
            Vote Submitted Successfully!
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your vote has been recorded on the blockchain. Thank you for participating in the democratic process.
          </p>
        </motion.div>

        {/* Vote Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="h-6 w-6 text-green-600" />
                <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {vote.title}
                </CardTitle>
              </div>
              {vote.description && (
                <CardDescription className="text-base text-muted-foreground">
                  {vote.description}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Vote Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
                  <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{vote.totalVotes}</div>
                  <div className="text-sm text-muted-foreground">Total Votes</div>
                </div>
                
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
                  <BarChart2 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">{vote.pollsCount || 0}</div>
                  <div className="text-sm text-muted-foreground">Questions</div>
                </div>
                
                <div className="text-center p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border">
                  <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-orange-600">
                    {vote.endTimestamp && Date.now() > vote.endTimestamp ? 'Ended' : 'Active'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {vote.endTimestamp && Date.now() <= vote.endTimestamp 
                      ? `Closes ${new Date(vote.endTimestamp).toLocaleDateString()}`
                      : 'Status'
                    }
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              {txDigest && (
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Hash className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200">Transaction Details</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Transaction Hash:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">
                          {truncateAddress(txDigest)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyTransaction}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className={cn("h-4 w-4", copied && "text-green-600")} />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="gap-2"
                      >
                        <a
                          href={getTransactionExplorerUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View on Explorer
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          {vote.showLiveStats && (
            <Button
              size="lg"
              className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => window.location.reload()}
            >
              <BarChart2 className="h-5 w-5" />
              View Live Results
            </Button>
          )}
          
          <Button
            variant="outline"
            size="lg"
            onClick={onShare}
            className="gap-2 hover:bg-primary/10 transition-colors"
          >
            <Share2 className="h-5 w-5" />
            Share Vote
          </Button>
          

        </motion.div>

        {/* Success Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12"
        >
          <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">What happens next?</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Your vote is now permanently recorded on the Sui blockchain. 
              {vote.showLiveStats 
                ? " You can view live results as other participants vote."
                : " Results will be revealed when the voting period ends."
              }
              {txDigest && " You can always verify your vote using the transaction hash above."}
            </AlertDescription>
          </Alert>
        </motion.div>
      </div>
    </>
  )
}