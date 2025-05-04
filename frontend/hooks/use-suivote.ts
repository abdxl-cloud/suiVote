// hooks/use-suivote.ts
import { useState, useCallback, useEffect } from 'react';
import { SuiVoteService } from '../services/suivote-service';
import { Transaction } from '@mysten/sui/transactions';
import { useWallet } from '@suiet/wallet-kit';

// Create a reusable hook for accessing the SuiVoteService
export function useSuiVote() {
  const wallet = useWallet();
  const [service, setService] = useState<SuiVoteService | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize the service with network from wallet when connected
  useEffect(() => {
    if (wallet.connected) {
      try {
        // Get the network from wallet if available, otherwise use 'devnet'
        const network = wallet.chain?.name?.toLowerCase() || 'devnet';
        console.log(`Initializing SuiVoteService with network: ${network}`);
        
        const suivoteService = new SuiVoteService(network);
        setService(suivoteService);
        setError(null);
      } catch (error) {
        console.error('Failed to initialize SuiVoteService:', error);
        setError(`Failed to initialize voting service: ${(error instanceof Error) ? error.message : String(error)}`);
      }
    } else {
      // If wallet disconnected, clear service
      setService(null);
    }
  }, [wallet.connected, wallet.chain]);

  /**
   * Create a complete vote transaction with proper validation and error handling
   */
  const createCompleteVoteTransaction = useCallback((
    title: string,
    description: string,
    startTimestamp: number,
    endTimestamp: number,
    requiredToken: string = '',
    requiredAmount: number = 0,
    paymentAmount: number = 0,
    requireAllPolls: boolean = true,
    pollData: any[]
  ): Transaction => {
    setLoading(true);
    setError(null);

    try {
      if (!service) {
        throw new Error('SuiVote service not initialized. Please connect your wallet.');
      }

      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      
      // Validate and sanitize poll data
      console.log('Preparing poll data for transaction');
      
      // Ensure all fields have proper values
      const sanitizedPollData = pollData.map(poll => ({
        title: poll.title || '',
        description: poll.description || '',
        isMultiSelect: !!poll.isMultiSelect,
        maxSelections: Math.max(1, poll.isMultiSelect ? Math.min(poll.maxSelections || 1, poll.options.length - 1) : 1),
        isRequired: !!poll.isRequired,
        options: poll.options.map((option: any) => ({
          text: option.text || '',
          mediaUrl: option.mediaUrl || ''
        }))
      }));
      
      // Log transaction parameters for debugging
      console.log('Creating vote transaction with parameters:', {
        title,
        descriptionLength: description?.length || 0,
        startTimestamp: new Date(startTimestamp).toISOString(),
        endTimestamp: new Date(endTimestamp).toISOString(),
        requiredToken: requiredToken || 'none',
        requiredAmount,
        paymentAmount,
        requireAllPolls,
        pollCount: sanitizedPollData.length,
        totalOptions: sanitizedPollData.reduce((sum, poll) => sum + poll.options.length, 0)
      });
      
      // Create the transaction
      const transaction = service.createCompleteVote(
        title,
        description,
        startTimestamp,
        endTimestamp,
        requiredToken,
        requiredAmount,
        paymentAmount,
        requireAllPolls,
        sanitizedPollData
      );
      
      setLoading(false);
      return transaction;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Error creating vote transaction:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      
      // Return an empty transaction as fallback - the error will be handled by the component
      return new Transaction();
    }
  }, [service, wallet.connected]);

  /**
   * Get votes created by the connected wallet
   */
  const getMyCreatedVotes = useCallback(async (limit = 20, cursor?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!service) {
        throw new Error('SuiVote service not initialized. Please connect your wallet.');
      }

      if (!wallet.connected || !wallet.account?.address) {
        throw new Error('Wallet not connected');
      }
      
      const result = await service.getVotesCreatedByAddress(wallet.account.address, limit, cursor);
      setLoading(false);
      return result;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Error fetching created votes:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      return { data: [], nextCursor: undefined };
    }
  }, [service, wallet.connected, wallet.account?.address]);

  /**
   * Get votes participated in by the connected wallet
   */
  const getMyParticipatedVotes = useCallback(async (limit = 20, cursor?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!service) {
        throw new Error('SuiVote service not initialized. Please connect your wallet.');
      }

      if (!wallet.connected || !wallet.account?.address) {
        throw new Error('Wallet not connected');
      }
      
      const result = await service.getVotesParticipatedByAddress(wallet.account.address, limit, cursor);
      setLoading(false);
      return result;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Error fetching participated votes:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      return { data: [], nextCursor: undefined };
    }
  }, [service, wallet.connected, wallet.account?.address]);

  /**
   * Cast a vote on a poll
   */
  const castVote = useCallback((
    voteId: string,
    pollIndex: number,
    optionIndices: number[],
    paymentAmount: number = 0
  ): Transaction => {
    setLoading(true);
    setError(null);
    
    try {
      if (!service) {
        throw new Error('SuiVote service not initialized. Please connect your wallet.');
      }

      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      
      const transaction = service.castVote(voteId, pollIndex, optionIndices, paymentAmount);
      setLoading(false);
      return transaction;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Error creating cast vote transaction:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      return new Transaction();
    }
  }, [service, wallet.connected]);

  /**
   * Cast votes on multiple polls at once
   */
  const castMultipleVotes = useCallback((
    voteId: string,
    pollIndices: number[],
    optionIndicesPerPoll: number[][],
    paymentAmount: number = 0
  ): Transaction => {
    setLoading(true);
    setError(null);
    
    try {
      if (!service) {
        throw new Error('SuiVote service not initialized. Please connect your wallet.');
      }

      if (!wallet.connected) {
        throw new Error('Wallet not connected');
      }
      
      const transaction = service.castMultipleVotes(voteId, pollIndices, optionIndicesPerPoll, paymentAmount);
      setLoading(false);
      return transaction;
    } catch (error) {
      const errorMessage = (error instanceof Error) ? error.message : String(error);
      console.error('Error creating cast multiple votes transaction:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      return new Transaction();
    }
  }, [service, wallet.connected]);

  // Return all the useful functions and state from the hook
  return {
    service,
    loading,
    error,
    createCompleteVoteTransaction,
    getMyCreatedVotes,
    getMyParticipatedVotes,
    castVote,
    castMultipleVotes,
    clearError: () => setError(null)
  };
}