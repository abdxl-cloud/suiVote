"use client"

import { useState, useCallback } from "react"
import { useWallet } from "@suiet/wallet-kit"
import type { Transaction } from "@mysten/sui/transactions"
import {
  SuiVoteService,
  type PollData,
  type VoteList,
  type VoteDetails,
  type PollDetails,
  type PollOptionDetails,
} from "@/services/suivote-service"
import { SUI_CONFIG } from "@/config/sui-config"

// Initialize the service
const suiVoteService = new SuiVoteService(SUI_CONFIG.NETWORK)

export function useSuiVote() {
  const wallet = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Get votes created by, participated in, or whitelisted for the current user
   * This function categorizes votes into five statuses:
   * - active: Votes that are open but user has not voted in
   * - pending: Votes that user's wallet is whitelisted for, are open but has not voted in
   * - upcoming: Votes that are scheduled but have not started yet
   * - closed: Votes that have ended
   * - voted: Any vote that the user has already voted in
   */
  const getMyVotes = useCallback(async (address: string, limit = 20): Promise<{ data: VoteList[] }> => {
    try {
      setLoading(true)
      setError(null)

      if (!address) {
        throw new Error("Wallet address is required")
      }

      const result = await suiVoteService.getMyVotes(address, limit)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error fetching votes:", errorMessage)
      return { data: [] }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get votes created by a specific address
   */
  const getVotesCreatedByAddress = useCallback(
    async (address: string, limit = 20, cursor?: string): Promise<{ data: VoteDetails[]; nextCursor?: string }> => {
      try {
        setLoading(true)
        setError(null)

        if (!address) {
          throw new Error("Address is required")
        }

        const result = await suiVoteService.getVotesCreatedByAddress(address, limit, cursor)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Error fetching votes:", errorMessage)
        return { data: [] }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Get votes that a user has participated in
   */
  const getVotesParticipatedByAddress = useCallback(
    async (address: string, limit = 20, cursor?: string): Promise<{ data: VoteDetails[]; nextCursor?: string }> => {
      try {
        setLoading(true)
        setError(null)

        if (!address) {
          throw new Error("Address is required")
        }

        const result = await suiVoteService.getVotesParticipatedByAddress(address, limit, cursor)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Error fetching votes:", errorMessage)
        return { data: [] }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Get detailed information about a specific vote
   */
  const getVoteDetails = useCallback(async (voteId: string): Promise<VoteDetails | null> => {
    try {
      setLoading(true)
      setError(null)

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const result = await suiVoteService.getVoteDetails(voteId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error fetching vote details:", errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get detailed information about a vote's polls
   */
  const getVotePolls = useCallback(async (voteId: string): Promise<PollDetails[]> => {
    try {
      setLoading(true)
      setError(null)

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const result = await suiVoteService.getVotePolls(voteId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error fetching vote polls:", errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get detailed information about a poll's options
   */
  const getPollOptions = useCallback(async (voteId: string, pollIndex: number): Promise<PollOptionDetails[]> => {
    try {
      setLoading(true)
      setError(null)

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const result = await suiVoteService.getPollOptions(voteId, pollIndex)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error fetching poll options:", errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a transaction to create a complete vote with polls and options
   */
  const createCompleteVoteTransaction = useCallback(
    (
      title: string,
      description: string,
      startTimestamp: number,
      endTimestamp: number,
      requiredToken = "",
      requiredAmount = 0,
      paymentAmount = 0,
      requireAllPolls = true,
      showLiveStats = false,
      pollData: PollData[],
      isTokenWeighted = false,
      tokenWeight = "1",
      whitelistAddresses: string[] = [] 
    ): Transaction => {
      try {
        setLoading(true)
        setError(null)

        // Call the service method to create the transaction
        const transaction = suiVoteService.createCompleteVoteTransaction(
          title,
          description,
          startTimestamp,
          endTimestamp,
          requiredToken,
          requiredAmount,
          paymentAmount,
          requireAllPolls,
          showLiveStats,
          pollData,
          isTokenWeighted,
          tokenWeight,
          whitelistAddresses 
        )

        return transaction
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Error creating vote transaction:", errorMessage)
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Create a transaction to add allowed voters to a vote's whitelist
   */
  const addAllowedVotersTransaction = useCallback(
    (voteId: string, voterAddresses: string[]): Transaction => {
      try {
        setLoading(true)
        setError(null)

        console.log(`Creating transaction to add ${voterAddresses.length} voters to whitelist for vote ${voteId}`)

        const transaction = suiVoteService.addAllowedVotersTransaction(voteId, voterAddresses)
        return transaction
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Error creating add allowed voters transaction:", errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Check if a voter is whitelisted for a vote
   */
  const isVoterWhitelisted = useCallback(async (voteId: string, voterAddress: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const result = await suiVoteService.isVoterWhitelisted(voteId, voterAddress)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error checking if voter is whitelisted:", errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get the whitelisted voters for a vote
   */
  const getWhitelistedVoters = useCallback(async (voteId: string): Promise<string[]> => {
    try {
      setLoading(true)
      setError(null)

      const result = await suiVoteService.getWhitelistedVoters(voteId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error getting whitelisted voters:", errorMessage)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a transaction to cast a vote
   */
  const castVoteTransaction = useCallback(
    (voteId: string, pollIndex: number, optionIndices: number[], tokenBalance: number = 0, payment = 0): Transaction => {
      try {
        setLoading(true)
        setError(null)

        const transaction = suiVoteService.castVoteTransaction(voteId, pollIndex, optionIndices, tokenBalance, payment)
        return transaction
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Create a transaction to cast multiple votes at once
   */
  const castMultipleVotesTransaction = useCallback(
    (voteId: string, pollIndices: number[], optionIndicesPerPoll: number[][],  tokenBalance: number = 0, payment = 0): Transaction => {
      try {
        setLoading(true)
        setError(null)

        const transaction = suiVoteService.castMultipleVotesTransaction(
          voteId,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          payment,
        )
        return transaction
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  /**
   * Create a transaction to close a vote
   */
  const closeVoteTransaction = useCallback((voteId: string): Transaction => {
    try {
      setLoading(true)
      setError(null)

      const transaction = suiVoteService.closeVoteTransaction(voteId)
      return transaction
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a transaction to cancel a vote
   */
  const cancelVoteTransaction = useCallback((voteId: string): Transaction => {
    try {
      setLoading(true)
      setError(null)

      const transaction = suiVoteService.cancelVoteTransaction(voteId)
      return transaction
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Create a transaction to extend a vote's voting period
   */
  const extendVotingPeriodTransaction = useCallback((voteId: string, newEndTimestamp: number): Transaction => {
    try {
      setLoading(true)
      setError(null)

      const transaction = suiVoteService.extendVotingPeriodTransaction(voteId, newEndTimestamp)
      return transaction
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Check if a user has voted on a specific vote
   */
  const hasVoted = useCallback(async (userAddress: string, voteId: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const result = await suiVoteService.hasVoted(userAddress, voteId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error checking if user has voted:", errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get vote results
   */
  const getVoteResults = useCallback(async (voteId: string) => {
    try {
      setLoading(true)
      setError(null)

      const results = await suiVoteService.getVoteResults(voteId)
      return results
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error getting vote results:", errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Execute a transaction using the wallet
   */
  const executeTransaction = useCallback(
    async (transaction: Transaction) => {
      try {
        setLoading(true)
        setError(null)

        if (!wallet.connected) {
          throw new Error("Wallet not connected")
        }

        const response = await wallet.signAndExecuteTransaction({
          transaction,
          chain: SUI_CONFIG.NETWORK,
        })

        return response
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Error executing transaction:", errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [wallet],
  )

  /**
   * Get votes where a user is whitelisted
   */
  const getVotesWhitelistedForAddress = useCallback(
    async (address: string, limit = 20, cursor?: string): Promise<{ data: VoteDetails[]; nextCursor?: string }> => {
      try {
        setLoading(true)
        setError(null)

        if (!address) {
          throw new Error("Address is required")
        }

        const result = await suiVoteService.getVotesWhitelistedForAddress(address, limit, cursor)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Error fetching whitelisted votes:", errorMessage)
        return { data: [] }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // frontend/hooks/use-suivote.ts

  // Add this function to the useSuiVote hook:

  /**
   * Check if a user has the required token balance
   * @param userAddress User address
   * @param tokenType Token type (e.g., "0x2::sui::SUI" or custom token)
   * @param requiredAmount Minimum amount required
   * @returns Boolean indicating if the user has sufficient balance
   */
  const checkTokenBalance = useCallback(async (
    userAddress: string,
    tokenType: string,
    requiredAmount: number
  ): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      if (!userAddress || !tokenType) {
        console.warn("Missing userAddress or tokenType in checkTokenBalance")
        return false
      }

      const result = await suiVoteService.checkTokenBalance(userAddress, tokenType, requiredAmount)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error checking token balance:", errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    getMyVotes,
    getVotesCreatedByAddress,
    getVotesParticipatedByAddress,
    getVotesWhitelistedForAddress,
    getVoteDetails,
    getVotePolls,
    getPollOptions,
    createCompleteVoteTransaction,
    castVoteTransaction,
    castMultipleVotesTransaction,
    closeVoteTransaction,
    cancelVoteTransaction,
    extendVotingPeriodTransaction,
    hasVoted,
    getVoteResults,
    executeTransaction,
    checkTokenBalance,
    // Whitelist functionality
    addAllowedVotersTransaction,
    isVoterWhitelisted,
    getWhitelistedVoters,
  }
}