'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Users, 
  BarChart3, 
  Download, 
  RefreshCw, 
  Share2, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Eye, 
  EyeOff, 
  Search, 
  Filter, 
  ArrowUpDown,
  MoreVertical,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Wallet,
  Vote,
  PieChart,
  Activity,
  FileText,
  Settings
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useWallet } from '@/contexts/wallet-context'
import { useSuiVote } from '@/hooks/use-suivote'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/share-dialog'
import { 
  VoteDetails, 
  PollDetails, 
  VoterInfo 
} from '@/services/suivote-service'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'

// Types and Interfaces
interface VoterDisplayData {
  address: string
  shortAddress: string
  timestamp: number
  tokenBalance: number
  voteWeight: number
  pollResponses: {
    pollId: string
    selectedOptions: number[]
  }[]
}

interface PollAnalytics {
  pollId: string
  title: string
  totalResponses: number
  responseRate: number
  options: {
    id: string
    text: string
    votes: number
    percentage: number
    color: string
  }[]
}

interface VoteAnalytics {
  totalVoters: number
  participationRate: number
  averageTokenBalance: number
  totalVoteWeight: number
  votingTrend: {
    date: string
    votes: number
    cumulative: number
  }[]
  pollAnalytics: PollAnalytics[]
  topVoters: VoterDisplayData[]
  timeDistribution: {
    hour: number
    votes: number
  }[]
}

interface FilterOptions {
  search: string
  sortBy: 'timestamp' | 'tokenBalance' | 'voteWeight' | 'address'
  sortOrder: 'asc' | 'desc'
  minTokenBalance?: number
  maxTokenBalance?: number
  selectedPoll?: string // 'all' or specific poll ID
  selectedOptions?: number[] // specific option indices for the selected poll
}

// Constants
const CHART_COLORS = [
  '#0073ff', '#00c49f', '#ffbb28', '#ff8042', 
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c',
  '#8dd1e1', '#d084d0', '#ffb347', '#87ceeb'
]

const ITEMS_PER_PAGE = 20

// Utility Functions
const truncateAddress = (address: string): string => {
  if (!address) return ''
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
}

const formatTokenAmount = (amount: number | string): string => {
  const numAmount = Number(amount) || 0
  if (numAmount >= 1e9) return `${(numAmount / 1e9).toFixed(2)}B`
  if (numAmount >= 1e6) return `${(numAmount / 1e6).toFixed(2)}M`
  if (numAmount >= 1e3) return `${(numAmount / 1e3).toFixed(2)}K`
  return numAmount.toFixed(2)
}

const getVoteStatus = (voteDetails: VoteDetails): {
  status: string
  color: string
  icon: React.ReactNode
} => {
  const now = Date.now()
  const start = voteDetails.startTimestamp
  const end = voteDetails.endTimestamp

  if (voteDetails.isCancelled) {
    return {
      status: 'Cancelled',
      color: 'destructive',
      icon: <XCircle className="h-4 w-4" />
    }
  }

  if (now < start) {
    return {
      status: 'Upcoming',
      color: 'secondary',
      icon: <Timer className="h-4 w-4" />
    }
  }

  if (now >= start && now <= end) {
    return {
      status: 'Active',
      color: 'default',
      icon: <Activity className="h-4 w-4" />
    }
  }

  return {
    status: 'Ended',
    color: 'outline',
    icon: <CheckCircle className="h-4 w-4" />
  }
}

const convertVoterInfo = (voterInfo: VoterInfo): VoterDisplayData => ({
  address: voterInfo.voter,
  shortAddress: truncateAddress(voterInfo.voter),
  timestamp: voterInfo.timestamp,
  tokenBalance: voterInfo.tokenBalance,
  voteWeight: voterInfo.voteWeight,
  pollResponses: voterInfo.polls.map(poll => ({
    pollId: poll.pollId,
    selectedOptions: poll.optionIndices
  }))
})

const calculateAnalytics = (
  voters: VoterDisplayData[],
  polls: PollDetails[],
  voteDetails: VoteDetails
): VoteAnalytics => {
  const totalVoters = voters.length
  const totalVoteWeight = voters.reduce((sum, voter) => sum + voter.voteWeight, 0)
  const averageTokenBalance = totalVoters > 0 
    ? voters.reduce((sum, voter) => sum + voter.tokenBalance, 0) / totalVoters
    : 0

  // Calculate participation rate
  const participationRate = voteDetails.hasWhitelist 
    ? Math.min((totalVoters / Math.max(totalVoters, 1)) * 100, 100)
    : 100

  // Generate voting trend over time
  const sortedVoters = [...voters].sort((a, b) => a.timestamp - b.timestamp)
  const timeRange = voteDetails.endTimestamp - voteDetails.startTimestamp
  const intervals = Math.min(10, Math.max(5, Math.ceil(timeRange / (24 * 60 * 60 * 1000))))
  
  const votingTrend = []
  let cumulativeVotes = 0
  
  for (let i = 0; i < intervals; i++) {
    const intervalStart = voteDetails.startTimestamp + (i * timeRange / intervals)
    const intervalEnd = intervalStart + (timeRange / intervals)
    const intervalVotes = sortedVoters.filter(v => 
      v.timestamp >= intervalStart && v.timestamp < intervalEnd
    ).length
    
    cumulativeVotes += intervalVotes
    
    votingTrend.push({
      date: format(new Date(intervalStart), 'MMM dd'),
      votes: intervalVotes,
      cumulative: cumulativeVotes
    })
  }

  // Calculate poll analytics
  const pollAnalytics: PollAnalytics[] = polls.map(poll => {
    const pollResponses = voters.flatMap(voter => 
      voter.pollResponses.filter(response => response.pollId === poll.id)
    )
    
    const optionVotes = new Map<number, number>()
    let totalVotesForPoll = 0
    
    pollResponses.forEach(response => {
      response.selectedOptions.forEach(optionIndex => {
        optionVotes.set(optionIndex, (optionVotes.get(optionIndex) || 0) + 1)
        totalVotesForPoll++
      })
    })

    const totalResponses = pollResponses.length
    const responseRate = totalVoters > 0 ? (totalResponses / totalVoters) * 100 : 0
    
    const options = poll.options?.map((option, index) => {
      const votes = option.votes || 0
      return {
        id: option.id,
        text: option.text,
        votes,
        percentage: totalVotesForPoll > 0 ? (votes / totalVotesForPoll) * 100 : 0,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }
    }) || []

    return {
      pollId: poll.id,
      title: poll.title,
      totalResponses,
      responseRate,
      options
    }
  })

  // Get top voters by vote weight
  const topVoters = [...voters]
    .sort((a, b) => b.voteWeight - a.voteWeight)
    .slice(0, 10)

  // Calculate time distribution (votes by hour)
  const timeDistribution = Array.from({ length: 24 }, (_, hour) => {
    const hourVotes = voters.filter(voter => {
      const voteHour = new Date(voter.timestamp).getHours()
      return voteHour === hour
    }).length
    
    return { hour, votes: hourVotes }
  })

  return {
    totalVoters,
    participationRate,
    averageTokenBalance,
    totalVoteWeight,
    votingTrend,
    pollAnalytics,
    topVoters,
    timeDistribution
  }
}

const exportData = {
  csv: (data: any[], filename: string) => {
    if (!data.length) return
    
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
  
  txt: (addresses: string[], filename: string) => {
    const content = addresses.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
  
  json: (data: any, filename: string) => {
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

// Loading Components
const LoadingSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
    
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  </div>
)

// Error Component
const ErrorDisplay = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
    <AlertCircle className="h-12 w-12 text-destructive" />
    <div className="text-center space-y-2">
      <h3 className="text-lg font-semibold">Something went wrong</h3>
      <p className="text-muted-foreground max-w-md">{error}</p>
    </div>
    <Button onClick={onRetry} variant="outline">
      <RefreshCw className="h-4 w-4 mr-2" />
      Try Again
    </Button>
  </div>
)

// Stats Cards Component
const StatsCards = ({ analytics, voteDetails }: { 
  analytics: VoteAnalytics; 
  voteDetails: VoteDetails 
}) => {
  // Calculate total payments received if payment is required
  const totalPaymentsReceived = voteDetails.paymentAmount > 0 
    ? voteDetails.paymentAmount * analytics.totalVoters 
    : 0

  const baseStats = [
    {
      title: 'Total Voters',
      value: analytics.totalVoters.toLocaleString(),
      icon: <Users className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Participation Rate',
      value: `${analytics.participationRate.toFixed(1)}%`,
      icon: <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Avg Token Balance',
      value: formatTokenAmount(analytics.averageTokenBalance),
      icon: <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Vote Weight',
      value: formatTokenAmount(analytics.totalVoteWeight),
      icon: <Vote className="h-4 w-4 sm:h-5 sm:w-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  // Add payment stats if payment is required
  const stats = voteDetails.paymentAmount > 0 
    ? [
        ...baseStats,
        {
          title: 'Total Payments',
          value: `${formatTokenAmount(totalPaymentsReceived)} SUI`,
          icon: <Activity className="h-4 w-4 sm:h-5 sm:w-5" />,
          color: 'text-emerald-600',
          bgColor: 'bg-emerald-50'
        }
      ]
    : baseStats

  return (
    <div className="grid gap-3 grid-cols-2 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="relative overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                  {stat.title}
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{stat.value}</p>
              </div>
              <div className={`p-2 sm:p-3 rounded-full ${stat.bgColor} self-start sm:self-center flex-shrink-0`}>
                <div className={stat.color}>{stat.icon}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Vote Header Component
const VoteHeader = ({ 
  voteDetails, 
  onBack, 
  onShare, 
  onRefresh, 
  isRefreshing 
}: {
  voteDetails: VoteDetails
  onBack: () => void
  onShare: () => void
  onRefresh: () => void
  isRefreshing: boolean
}) => {
  const status = getVoteStatus(voteDetails)
  
  return (
    <div className="space-y-4">
      {/* Mobile-first header layout */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" size="sm" onClick={onBack} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{voteDetails.title}</h1>
            <Badge variant={status.color as any} className="flex items-center gap-1 self-start">
              {status.icon}
              {status.status}
            </Badge>
          </div>
          
          <p className="text-muted-foreground mt-1 text-sm sm:text-base line-clamp-2">
            {voteDetails.description}
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex-1 sm:flex-none"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          
          <Button variant="outline" size="sm" onClick={onShare} className="flex-1 sm:flex-none">
            <Share2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          

        </div>
      </div>
      
      {/* Mobile-responsive info section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">
              {format(new Date(voteDetails.startTimestamp), 'MMM dd, yyyy')}
              {' - '}
              {format(new Date(voteDetails.endTimestamp), 'MMM dd, yyyy')}
            </span>
            <span className="sm:hidden">
              {format(new Date(voteDetails.startTimestamp), 'MMM dd')} - {format(new Date(voteDetails.endTimestamp), 'MMM dd')}
            </span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {voteDetails.endTimestamp > Date.now() 
              ? `Ends ${formatDistanceToNow(new Date(voteDetails.endTimestamp), { addSuffix: true })}`
              : `Ended ${formatDistanceToNow(new Date(voteDetails.endTimestamp), { addSuffix: true })}`
            }
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>{voteDetails.pollsCount} polls</span>
        </div>
      </div>
    </div>
  )
}

// Voters Table Component
const VotersTable = ({ 
  voters, 
  polls, 
  filters, 
  onFiltersChange 
}: {
  voters: VoterDisplayData[]
  polls: PollDetails[]
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  
  const filteredVoters = useMemo(() => {
    let filtered = [...voters]
    
    // Apply search filter
    if (filters.search) {
      filtered = filtered.filter(voter => 
        voter.address.toLowerCase().includes(filters.search.toLowerCase())
      )
    }
    
    // Apply token balance filters
    if (filters.minTokenBalance !== undefined) {
      filtered = filtered.filter(voter => voter.tokenBalance >= filters.minTokenBalance!)
    }
    
    if (filters.maxTokenBalance !== undefined) {
      filtered = filtered.filter(voter => voter.tokenBalance <= filters.maxTokenBalance!)
    }
    
    // Apply poll-specific filters
    if (filters.selectedPoll && filters.selectedPoll !== 'all') {
      // Find the poll index for the selected poll ID
      const selectedPollIndex = polls.findIndex(poll => poll.id === filters.selectedPoll)
      const pollIdToMatch = selectedPollIndex !== -1 ? (selectedPollIndex + 1).toString() : filters.selectedPoll
      
      filtered = filtered.filter(voter => {
        // Try both the poll object ID and the poll index (1-based) as string
        const pollResponse = voter.pollResponses.find(response => 
          response.pollId === filters.selectedPoll || response.pollId === pollIdToMatch
        )
        if (!pollResponse) return false
        
        // If specific options are selected, filter by those options
        if (filters.selectedOptions && filters.selectedOptions.length > 0) {
          return pollResponse.selectedOptions.some(option => 
            filters.selectedOptions!.includes(parseInt(option)) || 
            filters.selectedOptions!.includes(option)
          )
        }
        
        return true
      })
    } else if (filters.selectedOptions && filters.selectedOptions.length > 0) {
      // If options are selected but no specific poll, filter across all polls
      filtered = filtered.filter(voter => 
        voter.pollResponses.some(response => 
          response.selectedOptions.some(option => 
            filters.selectedOptions!.includes(parseInt(option)) || 
            filters.selectedOptions!.includes(option)
          )
        )
      )
    }
    

    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[filters.sortBy]
      const bValue = b[filters.sortBy]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }
      
      return filters.sortOrder === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
    
    return filtered
  }, [voters, filters])
  
  const paginatedVoters = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredVoters.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredVoters, currentPage])
  
  const totalPages = Math.ceil(filteredVoters.length / ITEMS_PER_PAGE)
  
  const handleExport = (exportFormat: 'csv' | 'txt' | 'json') => {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
    const selectedPoll = polls.find(p => p.id === filters.selectedPoll)
    const pollSuffix = selectedPoll ? `-${(selectedPoll.title).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}` : ''
    const optionsSuffix = filters.selectedOptions && filters.selectedOptions.length > 0 
      ? `-${filters.selectedOptions.length}options` 
      : ''
    
    switch (exportFormat) {
      case 'csv':
        const csvData = filteredVoters.map(voter => {
          const baseData = {
            address: voter.address,
            timestamp: format(new Date(voter.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            tokenBalance: voter.tokenBalance,
            voteWeight: voter.voteWeight,
            totalPollResponses: voter.pollResponses.length
          }
          
          // Add poll-specific data if filtering by specific poll
          if (selectedPoll) {
            const pollResponse = voter.pollResponses.find(r => r.pollId === selectedPoll.id)
            const selectedOption = pollResponse ? selectedPoll.options?.find(o => o.id === pollResponse.pollId) : null
            return {
              ...baseData,
              pollQuestion: selectedPoll.title,
              selectedOption: selectedOption?.text || 'No response',
              optionId: pollResponse?.selectedOptions || 'N/A'
            }
          }
          
          return baseData
        })
        exportData.csv(csvData, `voters${pollSuffix}${optionsSuffix}-${timestamp}.csv`)
        break
        
      case 'txt':
        exportData.txt(
          filteredVoters.map(v => v.address), 
          `voter-addresses${pollSuffix}${optionsSuffix}-${timestamp}.txt`
        )
        break
        
      case 'json':
        const jsonData = {
          exportInfo: {
            timestamp: new Date().toISOString(),
            totalVoters: filteredVoters.length,
            filters: {
              search: filters.search,
              selectedPoll: selectedPoll?.title || 'All Polls',
              selectedOptions: filters.selectedOptions?.map(blockchainIndex => {
                // Convert from 1-based blockchain index to 0-based array index
                const arrayIndex = blockchainIndex - 1
                const option = selectedPoll?.options?.[arrayIndex]
                return option?.text || `Option ${blockchainIndex}`
              }) || []
            }
          },
          voters: filteredVoters
        }
        exportData.json(jsonData, `voters${pollSuffix}${optionsSuffix}-${timestamp}.json`)
        break
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              Voters ({filteredVoters.length})
            </CardTitle>
            <CardDescription className="text-sm">
              Detailed breakdown of all voters and their responses
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV ({filteredVoters.length} voters)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                Export Addresses Only ({filteredVoters.length} addresses)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                Export as JSON (Full Data)
              </DropdownMenuItem>
              {filters.selectedPoll && filters.selectedPoll !== 'all' && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Filtered by: {polls.find(p => p.id === filters.selectedPoll)?.title}
                    {filters.selectedOptions && filters.selectedOptions.length > 0 && (
                      <div>Options: {filters.selectedOptions.length} selected</div>
                    )}
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          
          <Select
            value={filters.selectedPoll}
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              selectedPoll: value,
              selectedOptions: [] // Reset options when poll changes
            })}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by poll" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Polls</SelectItem>
              {polls && polls.length > 0 ? (
                polls.map((poll) => (
                  <SelectItem key={poll.id} value={poll.id}>
                    {poll.title}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-polls" disabled>
                  No polls available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          
          {filters.selectedPoll && filters.selectedPoll !== 'all' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Options ({filters.selectedOptions?.length || 0})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => onFiltersChange({ ...filters, selectedOptions: [] })}
                >
                  All Options
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {polls.find(p => p.id === filters.selectedPoll)?.options?.map((option, optionIndex) => {
                  // Convert to 1-based index to match blockchain data
                  const blockchainIndex = optionIndex + 1
                  return (
                    <DropdownMenuItem 
                      key={option.id}
                      onClick={() => {
                        const isSelected = filters.selectedOptions?.includes(blockchainIndex) || false
                        const newOptions = isSelected
                          ? filters.selectedOptions?.filter(idx => idx !== blockchainIndex) || []
                          : [...(filters.selectedOptions || []), blockchainIndex]
                        onFiltersChange({ ...filters, selectedOptions: newOptions })
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {filters.selectedOptions?.includes(blockchainIndex) && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                        {option.text}
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort: {filters.sortBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => onFiltersChange({ ...filters, sortBy: 'timestamp' })}
              >
                Sort by Time
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onFiltersChange({ ...filters, sortBy: 'tokenBalance' })}
              >
                Sort by Token Balance
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onFiltersChange({ ...filters, sortBy: 'voteWeight' })}
              >
                Sort by Vote Weight
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onFiltersChange({ ...filters, sortBy: 'address' })}
              >
                Sort by Address
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onFiltersChange({ 
                  ...filters, 
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
                })}
              >
                {filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Voter</TableHead>
                <TableHead className="hidden sm:table-cell min-w-[120px]">Vote Time</TableHead>
                <TableHead className="text-right min-w-[100px]">Balance</TableHead>
                <TableHead className="text-right min-w-[100px]">Weight</TableHead>
                <TableHead className="hidden md:table-cell min-w-[150px]">Poll Responses</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedVoters.map((voter) => (
                <TableRow key={voter.address}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-mono text-sm">{voter.shortAddress}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                        {voter.address}
                      </div>
                      <div className="sm:hidden text-xs text-muted-foreground">
                        {format(new Date(voter.timestamp), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="hidden sm:table-cell">
                    <div className="space-y-1">
                      <div className="text-sm">
                        {format(new Date(voter.timestamp), 'MMM dd, HH:mm')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(voter.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="font-mono text-sm">
                      {formatTokenAmount(voter.tokenBalance)}
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <div className="font-mono font-semibold text-sm">
                      {formatTokenAmount(voter.voteWeight)}
                    </div>
                  </TableCell>
                  
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {voter.pollResponses.map((response, idx) => {
                        const poll = polls.find(p => p.id === response.pollId)
                        return (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {poll?.title.substring(0, 8)}...
                            ({response.selectedOptions.join(', ')})
                          </Badge>
                        )
                      })}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => navigator.clipboard.writeText(voter.address)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Address
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a 
                            href={`https://suiscan.xyz/mainnet/account/${voter.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View on Explorer
                          </a>
                        </DropdownMenuItem>
                        <div className="md:hidden">
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1 text-xs text-muted-foreground">
                            Poll Responses:
                          </div>
                          {voter.pollResponses.map((response, idx) => {
                            const poll = polls.find(p => p.id === response.pollId)
                            return (
                              <div key={idx} className="px-2 py-1 text-xs">
                                {poll?.title}: {response.selectedOptions.join(', ')}
                              </div>
                            )
                          })}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 mt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredVoters.length)} of{' '}
              {filteredVoters.length} voters
            </div>
            
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  const page = i + 1
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  )
                })}
                {totalPages > 3 && (
                  <span className="text-muted-foreground px-2">...</span>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Analytics Charts Component
const AnalyticsCharts = ({ analytics }: { analytics: VoteAnalytics }) => {
  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-1 lg:grid-cols-2">
      {/* Voting Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            Voting Trend
          </CardTitle>
          <CardDescription className="text-sm">
            Vote submissions over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <AreaChart data={analytics.votingTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="cumulative" 
                stroke="#0073ff" 
                fill="#0073ff" 
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="votes" 
                stroke="#00c49f" 
                fill="#00c49f" 
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Time Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            Voting by Hour
          </CardTitle>
          <CardDescription className="text-sm">
            Distribution of votes throughout the day
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <BarChart data={analytics.timeDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                fontSize={12}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  fontSize: '12px',
                  padding: '8px',
                  borderRadius: '6px'
                }}
              />
              <Bar 
                dataKey="votes" 
                fill="#0073ff" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// Poll Results Component
const PollResults = ({ analytics }: { analytics: VoteAnalytics }) => {
  const handlePollExport = (poll: PollAnalytics, format: 'csv' | 'json') => {
    const timestamp = new Date().toISOString().slice(0,16).replace(/[-:]/g, '')
    const pollName = poll.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    
    switch (format) {
      case 'csv':
        const csvData = poll.options?.map(option => ({
          option: option.text,
          votes: option.votes,
          percentage: option.percentage.toFixed(2)
        }))
        exportData.csv(csvData, `poll-${pollName}-results-${timestamp}.csv`)
        break
        
      case 'json':
        const jsonData = {
          pollInfo: {
            title: poll.title,
            pollId: poll.pollId,
            totalResponses: poll.totalResponses,
            responseRate: poll.responseRate,
            exportTimestamp: new Date().toISOString()
          },
          results: poll.options
        }
        exportData.json(jsonData, `poll-${pollName}-results-${timestamp}.json`)
        break
    }
  }
  
  const handleAllPollsExport = (format: 'csv' | 'json') => {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm')
    
    switch (format) {
      case 'csv':
        const csvData = analytics.pollAnalytics.flatMap(poll => 
          poll.options.map(option => ({
            pollTitle: poll.title,
            pollId: poll.pollId,
            option: option.text,
            votes: option.votes,
            percentage: option.percentage.toFixed(2)
          }))
        )
        exportData.csv(csvData, `all-polls-results-${timestamp}.csv`)
        break
        
      case 'json':
        const jsonData = {
          exportInfo: {
            totalPolls: analytics.pollAnalytics.length,
            exportTimestamp: new Date().toISOString()
          },
          polls: analytics.pollAnalytics
        }
        exportData.json(jsonData, `all-polls-results-${timestamp}.json`)
        break
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Export All Polls Button */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                Poll Results Overview
              </CardTitle>
              <CardDescription className="text-sm">
                {analytics.pollAnalytics.length} polls • Export all poll results
              </CardDescription>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAllPollsExport('csv')}>
                  Export All as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAllPollsExport('json')}>
                  Export All as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
      </Card>
      
      {analytics.pollAnalytics.map((poll, index) => (
        <Card key={poll.pollId}>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <PieChart className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="truncate">{poll.title}</span>
                </CardTitle>
                <CardDescription className="text-sm">
                  {poll.totalResponses} responses • {poll.responseRate.toFixed(1)}% response rate
                </CardDescription>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePollExport(poll, 'csv')}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePollExport(poll, 'json')}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-1 lg:grid-cols-2">
              {/* Pie Chart */}
              <div>
                {poll.options && poll.options.length > 0 && poll.options.some(opt => opt.votes > 0) ? (
                  <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
                    <RechartsPieChart>
                      <Pie
                        data={poll.options.filter(opt => opt.votes > 0).map(opt => ({
                          ...opt,
                          name: opt.text
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="votes"
                        label={({ name, percent }) => 
                          `${name.length > 15 ? name.substring(0, 15) + '...' : name}: ${(percent * 100).toFixed(1)}%`
                        }
                        labelStyle={{ fontSize: '12px' }}
                      >
                        {poll.options.filter(opt => opt.votes > 0).map((option, idx) => (
                          <Cell key={idx} fill={option.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          fontSize: '12px',
                          padding: '8px',
                          borderRadius: '6px'
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] sm:h-[250px] text-muted-foreground">
                    <div className="text-center">
                      <PieChart className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No votes recorded yet</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Options List */}
              <div className="space-y-3 sm:space-y-4">
                {poll.options.map((option, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: option.color }}
                        />
                        <span className="font-medium text-sm sm:text-base truncate">{option.text}</span>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                        {option.votes} votes
                      </div>
                    </div>
                    <Progress value={option.percentage} className="h-2" />
                    <div className="text-xs text-muted-foreground text-right">
                      {option.percentage.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Main Component
export default function VoteManagePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const wallet = useWallet()
  const { getVoteDetails, getVotePolls, getVotersForVote, getPollOptions } = useSuiVote()
  
  // State
  const [voteDetails, setVoteDetails] = useState<VoteDetails | null>(null)
  const [polls, setPolls] = useState<PollDetails[]>([])
  const [voters, setVoters] = useState<VoterDisplayData[]>([])
  const [analytics, setAnalytics] = useState<VoteAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    sortBy: 'timestamp',
    sortOrder: 'desc',
    selectedPoll: 'all',
    selectedOptions: []
  })
  
  const voteId = params.id as string
  
  // Fetch data function
  const fetchData = useCallback(async (showLoading = true) => {
    if (!wallet.connected || !wallet.address) {
      setError('Please connect your wallet')
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }
    
    if (showLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    
    setError(null)
    
    try {
      // Fetch vote details
      const details = await getVoteDetails(voteId)
      if (!details) {
        throw new Error('Vote not found')
      }
      setVoteDetails(details)
      
      // Fetch polls
      const pollsData = await getVotePolls(voteId)
      
      // Fetch options for each poll
      const pollsWithOptions = await Promise.all(
        pollsData.map(async (poll, index) => {
          try {
            const options = await getPollOptions(voteId, index + 1)
            return { ...poll, options }
          } catch (error) {
            console.error(`Failed to fetch options for poll ${index + 1}:`, error)
            return { ...poll, options: [] }
          }
        })
      )
      setPolls(pollsWithOptions || [])
      
      // Fetch voters with timeout and error handling
      try {
        // Set a timeout for the voters fetch to prevent hanging
        const votersPromise = getVotersForVote(voteId)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Fetching voters timed out after 30 seconds')), 30000)
        })
        
        const votersData = await Promise.race([votersPromise, timeoutPromise])
        const convertedVoters = votersData.map(convertVoterInfo)
        setVoters(convertedVoters)
        
        // Calculate analytics
        const analyticsData = calculateAnalytics(convertedVoters, pollsWithOptions, details)
        setAnalytics(analyticsData)
      } catch (voterError) {
        console.error('⚠️ Error fetching voters:', voterError)
        // Continue with empty voters array rather than failing the whole operation
        setVoters([])
        
        // Still generate analytics with available data
        const analyticsData = calculateAnalytics([], pollsWithOptions, details)
        setAnalytics(analyticsData)
        
        // Set a warning but don't fail the entire operation
        toast({
          title: 'Warning',
          description: 'Could not load voter data. Some analytics may be limited.',
          variant: 'destructive'
        })
      }
      
      setLastUpdated(new Date())
      
      if (!showLoading) {
        toast({
          title: 'Data refreshed',
          description: 'Vote data has been updated successfully'
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vote data'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [voteId, wallet.connected, wallet.address, getVoteDetails, getVotePolls, getVotersForVote, getPollOptions, toast])
  
  // Initial data fetch
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      fetchData()
    } else {
      setIsLoading(false)
      setError('Please connect your wallet')
    }
  }, [fetchData, wallet.connected, wallet.address])
  
  // Auto-refresh for active votes
  useEffect(() => {
    if (!voteDetails || voteDetails.isCancelled) return
    
    const now = Date.now()
    const isActive = now >= voteDetails.startTimestamp && now <= voteDetails.endTimestamp
    
    if (isActive) {
      const interval = setInterval(() => {
        fetchData(false)
      }, 30000) // Refresh every 30 seconds for active votes
      
      return () => clearInterval(interval)
    }
  }, [voteDetails, fetchData])
  
  // Handlers
  const handleBack = () => {
    router.push('/dashboard')
  }
  
  const handleRefresh = () => {
    fetchData(false)
  }
  
  const handleShare = () => {
    setShareDialogOpen(true)
  }
  
  const handleRetry = () => {
    fetchData()
  }
  
  const handleDistributeRewards = () => {
    toast({
      title: 'Coming Soon',
      description: 'Reward distribution feature is currently under development and will be available soon.',
      variant: 'default'
    })
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSkeleton />
      </div>
    )
  }
  
  // Error state
  if (error || !voteDetails || !analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorDisplay error={error || 'Failed to load vote data'} onRetry={handleRetry} />
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <VoteHeader 
        voteDetails={voteDetails}
        onBack={handleBack}
        onShare={handleShare}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}

      />
      
      {/* Stats Cards */}
      <StatsCards analytics={analytics} voteDetails={voteDetails} />
      
      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3">
            <BarChart3 className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="voters" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate">Voters</span>
          </TabsTrigger>
          <TabsTrigger value="polls" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3">
            <PieChart className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate">Polls</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 p-2 sm:p-3">
            <Activity className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs sm:text-sm truncate">Analytics</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Vote Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{analytics.totalVoters}</div>
                    <div className="text-sm text-muted-foreground">Total Voters</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{voteDetails.pollsCount}</div>
                    <div className="text-sm text-muted-foreground">Polls</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Participation Rate</span>
                    <span>{analytics.participationRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={analytics.participationRate} />
                </div>
                
                {lastUpdated && (
                  <div className="text-xs text-muted-foreground">
                    Last updated: {format(lastUpdated, 'MMM dd, HH:mm:ss')}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Top Voters */}
            <Card>
              <CardHeader>
                <CardTitle>Top Voters by Weight</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topVoters.slice(0, 5).map((voter, index) => (
                    <div key={voter.address} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-mono text-sm">{voter.shortAddress}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(voter.timestamp), 'MMM dd, HH:mm')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatTokenAmount(voter.voteWeight)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTokenAmount(voter.tokenBalance)} tokens
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Voting Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {voters
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 10)
                  .map((voter) => (
                    <div key={voter.address} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Vote className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-sm">{voter.shortAddress}</div>
                          <div className="text-xs text-muted-foreground">
                            Voted {formatDistanceToNow(new Date(voter.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          Weight: {formatTokenAmount(voter.voteWeight)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {voter.pollResponses.length} poll{voter.pollResponses.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="voters" className="space-y-4">
          {/* Distribute Rewards Button */}
          <div className="flex justify-end">
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleDistributeRewards}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Activity className="h-4 w-4 mr-2" />
              Distribute Rewards
            </Button>
          </div>
          
          <VotersTable 
            voters={voters}
            polls={polls}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </TabsContent>
        
        <TabsContent value="polls">
          <PollResults analytics={analytics} />
        </TabsContent>
        
        <TabsContent value="analytics">
          <AnalyticsCharts analytics={analytics} />
        </TabsContent>
      </Tabs>
      
      {/* Share Dialog */}
      <ShareDialog 
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title={voteDetails.title}
        url={`${window.location.origin}/vote/${voteId}`}
        description={voteDetails.description}
        endDate={voteDetails.endTime}
        participantCount={voters.length}
      />
    </div>
  )
}