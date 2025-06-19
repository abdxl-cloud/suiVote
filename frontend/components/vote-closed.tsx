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

interface VoteDetails {
  id: string
  title: string
  description?: string
  status: 'active' | 'upcoming' | 'ended' | 'closed' | 'pending' | 'voted'
  totalVotes: number
  pollsCount?: number
  endTimestamp?: number
  showLiveStats?: boolean
  creator?: string
  creatorName?: string
}

interface PollOption {
  id: string
  text: string
  votes: number
  percentage: number
}

interface Poll {
  id: string
  title: string
  description?: string
  options: PollOption[]
  totalVotes: number
  isRequired: boolean
  isMultiSelect: boolean
  maxSelections?: number
}

interface VoteClosedProps {
  vote: VoteDetails
  polls: Poll[]
  onShare: () => void
}

export function VoteClosed({ vote, polls, onShare }: VoteClosedProps) {
  // Format date
  const formatDate = (timestamp: number) => {
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
  const formatTextWithLinks = (text: string): ReactNode[] => {
    if (!text) return [text]
    
    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g
    
    // Split the text by URLs
    const parts = text.split(urlRegex)
    
    // Find all URLs in the text
    const urls = text.match(urlRegex) || []
    
    // Combine parts and URLs
    const result: ReactNode[] = []
    
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
  const getPercentage = (votes: number, totalVotes: number) => {
    if (!totalVotes) return 0
    return Math.round((votes / totalVotes) * 100)
  }

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  return (
    <div className="space-y-8">
      {/* Vote Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 shadow-xl">
          <div className="h-2 bg-gray-500 w-full"></div>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Lock className="h-8 w-8 text-gray-600" />
                  {vote.title}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge className="bg-gray-500 hover:bg-gray-600 text-white">
                    Closed
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {vote.totalVotes} votes
                  </Badge>
                  {vote.endTimestamp && (
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      Ended {formatDate(vote.endTimestamp)}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share Results
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {vote.description && (
              <div className="mb-6 text-muted-foreground text-base leading-relaxed">
                {formatTextWithLinks(vote.description)}
              </div>
            )}

            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">Final Results</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                This vote has ended and the results are now final. All votes have been tallied and recorded on the blockchain.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Final Results</h2>
        </div>

        {polls.map((poll, pollIndex) => (
          <Card key={poll.id} className="shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      {pollIndex + 1}
                    </span>
                    {poll.title}
                  </CardTitle>
                  {poll.description && (
                    <CardDescription className="mt-2 text-base">
                      {formatTextWithLinks(poll.description)}
                    </CardDescription>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {poll.isRequired && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                  {poll.isMultiSelect && (
                    <Badge variant="outline" className="text-xs">
                      Multi-select
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Total responses: {poll.totalVotes}
                </span>
                {poll.isMultiSelect && poll.maxSelections && (
                  <span className="text-xs text-muted-foreground">
                    Max {poll.maxSelections} selections
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {poll.options
                  .sort((a, b) => b.votes - a.votes) // Sort by votes descending
                  .map((option, optionIndex) => {
                    const percentage = getPercentage(option.votes, vote.totalVotes)
                    const isWinner = optionIndex === 0 && option.votes > 0
                    
                    return (
                      <div
                        key={option.id}
                        className={`relative p-4 rounded-lg border transition-all duration-200 ${
                          isWinner 
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 shadow-md'
                            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {isWinner && (
                          <div className="absolute -top-2 -right-2">
                            <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                              Winner
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 text-base font-medium">
                            {formatTextWithLinks(option.text)}
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className="text-sm font-bold text-primary">
                              {option.votes} votes
                            </span>
                            <span className={`text-lg font-bold ${
                              isWinner ? 'text-green-600' : 'text-muted-foreground'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: pollIndex * 0.1 + optionIndex * 0.05 }}
                            className={`h-full rounded-full ${
                              isWinner 
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-blue-500 to-purple-500'
                            }`}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Vote Metadata */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Separator className="my-6" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Created by:</span>
            <a
              href={`https://explorer.sui.io/address/${vote.creator}?network=${SUI_CONFIG.NETWORK.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              {vote.creatorName || truncateAddress(vote.creator || '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}