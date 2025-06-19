"use client"

import { useState, useCallback } from "react"
import { useWallet } from "@/contexts/wallet-context"
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import type { Transaction } from "@mysten/sui/transactions"
import { getFullnodeUrl } from "@mysten/sui/client"
import {
  SuiVoteService,
  type PollData,
  type VoteList,
  type VoteDetails,
  type PollDetails,
  type PollOptionDetails,
  type VoterInfo,
} from "@/services/suivote-service"
import { SUI_CONFIG } from "@/config/sui-config"

// Initialize the service
const suiVoteService = new SuiVoteService(SUI_CONFIG.NETWORK)

export function useSuiVote() {
  const wallet = useWallet()
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  /**
   * Get all voters and their voting information for a specific vote
   * @param voteId The vote object ID
   * @returns Array of voter information objects
   */
  const getVotersForVote = useCallback(async (voteId: string): Promise<VoterInfo[]> => {
    try {
      setLoading(true)
      setError(null)

      if (!voteId) {
        throw new Error("Vote ID is required")
      }

      const result = await suiVoteService.getVotersForVote(voteId)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error fetching voters for vote:", errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Subscribe to vote updates for real-time data
   * @param voteId The vote object ID
   * @param onUpdate Callback function to handle updates
   * @returns Unsubscribe function
   */
  const subscribeToVoteUpdates = useCallback(
    (voteId: string, onUpdate: (voteDetails: VoteDetails) => void): (() => void) => {
      try {
        if (!voteId) {
          throw new Error("Vote ID is required")
        }
        
        // Pass the user's wallet address to enable voting status checking
        return suiVoteService.subscribeToVoteUpdates(voteId, onUpdate, wallet.address || undefined)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Failed to subscribe to vote updates:", errorMessage)
        setError(errorMessage)
        // Return a no-op function in case of error
        return () => {}
      }
    },
    [wallet.address]
  )

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
  const getVoteDetails = useCallback(async (voteId: string): Promise<VoteDetails> => {
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
      throw err // Re-throw the error instead of returning null
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
    async (
      title: string,
      description: string,
      startTimestamp: number,
      endTimestamp: number,
      requiredToken = "",
      requiredAmount: number | string = 0,
      paymentAmount: number | string = 0,
      requireAllPolls = true,
      showLiveStats = false,
      pollData: PollData[],
      isTokenWeighted = false,
      tokenWeight: number | string = "1",
      enableWeightedPayment = false,
      whitelistAddresses: string[] = [],
      voterWeights: number[] = [],
      paymentTokenWeight: number | string = "0.1"
    ): Promise<Transaction> => {
      try {
        setLoading(true)
        setError(null)

        // Call the service method to create the transaction
        // Use provided voter weights or generate default ones if empty
        const finalVoterWeights = voterWeights.length > 0 
          ? voterWeights
          : whitelistAddresses.length > 0 
            ? whitelistAddresses.map(() => 100) // Default weight of 100 for each address
            : []
          
        // Convert amounts to numbers for service compatibility
        const numericRequiredAmount = typeof requiredAmount === 'string' ? parseFloat(requiredAmount) || 0 : requiredAmount;
        const numericPaymentAmount = typeof paymentAmount === 'string' ? parseFloat(paymentAmount) || 0 : paymentAmount;
        const numericTokenWeight = typeof tokenWeight === 'string' ? parseFloat(tokenWeight) || 1 : tokenWeight;
        const numericPaymentTokenWeight = typeof paymentTokenWeight === 'string' ? parseFloat(paymentTokenWeight) || 0.1 : paymentTokenWeight;
        
        const transaction = await suiVoteService.createCompleteVoteTransaction(
          title,
          description,
          startTimestamp,
          endTimestamp,
          requiredToken,
          numericRequiredAmount,
          numericPaymentAmount,
          requireAllPolls,
          showLiveStats,
          pollData,
          isTokenWeighted,
          numericTokenWeight,
          enableWeightedPayment,
          whitelistAddresses,
          finalVoterWeights,
          numericPaymentTokenWeight
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
    async (voteId: string, pollIndex: number, optionIndices: number[], tokenBalance: number = 0, payment: number | string = 0): Promise<Transaction> => {
      try {
        setLoading(true)
        setError(null)

        // Convert payment to number for service compatibility
        const numericPayment = typeof payment === 'string' ? parseFloat(payment) || 0 : payment;
        
        const transaction = await suiVoteService.castVoteTransaction(voteId, pollIndex, optionIndices, tokenBalance, numericPayment)
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
    async (voteId: string, pollIndices: number[], optionIndicesPerPoll: number[][],  tokenBalance: number = 0, payment: number | string = 0): Promise<Transaction> => {
      try {
        setLoading(true)
        setError(null)

        // Convert payment to number for service compatibility
        const numericPayment = typeof payment === 'string' ? parseFloat(payment) || 0 : payment;
        
        const transaction = await suiVoteService.castMultipleVotesTransaction(
          voteId,
          pollIndices,
          optionIndicesPerPoll,
          tokenBalance,
          numericPayment,
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

        const result = await signAndExecuteTransaction({ 
          transaction: transaction 
        })
        
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        console.error("Transaction execution error:", errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [signAndExecuteTransaction, wallet.connected]
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
   * @returns Object with hasBalance (boolean) and tokenBalance (number)
   */
  const checkTokenBalance = useCallback(async (
    userAddress: string,
    tokenType: string,
    requiredAmount: number
  ): Promise<{ hasBalance: boolean; tokenBalance: number }> => {
    try {
      setLoading(true)
      setError(null)

      if (!userAddress || !tokenType) {
        console.warn("Missing userAddress or tokenType in checkTokenBalance")
        return { hasBalance: false, tokenBalance: 0 }
      }

      const result = await suiVoteService.checkTokenBalance(userAddress, tokenType, String(requiredAmount))
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error checking token balance:", errorMessage)
      return { hasBalance: false, tokenBalance: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * @deprecated Votes start automatically based on timestamps
   * No manual transaction is needed to start a vote
   */
  const startVoteTransaction = useCallback((voteId: string): Transaction => {
    throw new Error('Vote starting is automatic based on timestamps. No manual transaction needed.')
  }, [])

  /**
   * Get the whitelist weight for a voter in a specific vote
   * @param voteId The vote object ID
   * @param voterAddress The voter's address
   * @returns The whitelist weight (0 if not whitelisted, 1+ if whitelisted)
   */
  const getWhitelistWeight = useCallback(async (voteId: string, voterAddress: string): Promise<number> => {
    try {
      setLoading(true)
      setError(null)

      if (!voteId || !voterAddress) {
        throw new Error("Vote ID and voter address are required")
      }

      const result = await suiVoteService.getWhitelistWeight(voteId, voterAddress)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error getting whitelist weight:", errorMessage)
      return 0
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get the SUI balance for a user address
   * @param userAddress The user's address
   * @returns The SUI balance in MIST units
   */
  const getSuiBalance = useCallback(async (userAddress: string): Promise<number> => {
    try {
      setLoading(true)
      setError(null)

      if (!userAddress) {
        throw new Error("User address is required")
      }

      const result = await suiVoteService.getSuiBalance(userAddress)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      console.error("Error getting SUI balance:", errorMessage)
      return 0
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
    startVoteTransaction,
    hasVoted,
    getVoteResults,
    executeTransaction,
    checkTokenBalance,
    getVotersForVote,
    addAllowedVotersTransaction,
    isVoterWhitelisted,
    getWhitelistedVoters,
    subscribeToVoteUpdates,
    getWhitelistWeight,
    getSuiBalance,
  }
}