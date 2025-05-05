"use client"

import { useState, useCallback } from "react"
import { useWallet } from "@suiet/wallet-kit"
import type { Transaction } from "@mysten/sui/transactions"
import {
  SuiVoteService,
  type PollData,
  type DashboardVote,
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
   * Get votes created by the current user
   */
  const getMyVotes = useCallback(async (address: string, limit = 20): Promise<{ data: DashboardVote[] }> => {
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
      pollData: PollData[],
    ): Transaction => {
      try {
        setLoading(true)
        setError(null)

        console.log("Creating vote transaction with:", {
          title,
          description,
          startTimestamp,
          endTimestamp,
          requiredToken,
          requiredAmount,
          paymentAmount,
          requireAllPolls,
          pollCount: pollData.length,
        })

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
          pollData,
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
   * Create a transaction to cast a vote
   */
  const castVoteTransaction = useCallback(
    (voteId: string, pollIndex: number, optionIndices: number[], payment = 0): Transaction => {
      try {
        setLoading(true)
        setError(null)

        const transaction = suiVoteService.castVoteTransaction(voteId, pollIndex, optionIndices, payment)
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
    (voteId: string, pollIndices: number[], optionIndicesPerPoll: number[][], payment = 0): Transaction => {
      try {
        setLoading(true)
        setError(null)

        const transaction = suiVoteService.castMultipleVotesTransaction(
          voteId,
          pollIndices,
          optionIndicesPerPoll,
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

  return {
    loading,
    error,
    getMyVotes,
    getVotesCreatedByAddress,
    getVotesParticipatedByAddress,
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
  }
}
