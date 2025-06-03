"use client"

import { useState } from "react"
import { Check, AlertCircle, Loader2, ExternalLink, Copy, Circle, X, RefreshCw, Info, Wallet, Wifi, HelpCircle, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { toast } from "sonner" // or your toast library
import { cn } from "@/lib/utils"

// Define the transaction status enum for consistency
export enum TransactionStatus {
  IDLE = 0,
  BUILDING = 1,
  SIGNING = 2,
  EXECUTING = 3,
  CONFIRMING = 4,
  SUCCESS = 5,
  ERROR = 6,
}

interface TransactionStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  txStatus: TransactionStatus
  txDigest?: string | null
  transactionError?: string | null
  failedStep?: TransactionStatus // The step where the transaction failed
  onRetry?: () => void
  onSuccess?: () => void
  onClose?: () => void
  explorerUrl?: string // Base explorer URL
  title?: {
    default?: string
    success?: string
    error?: string
  }
  description?: {
    default?: string
    success?: string
    error?: string
  }
}

export function TransactionStatusDialog({
  open,
  onOpenChange,
  txStatus,
  txDigest,
  transactionError,
  failedStep,
  onRetry,
  onSuccess,
  onClose,
  explorerUrl = "https://explorer.sui.io", // Default SUI explorer
  title = {
    default: "Processing Transaction",
    success: "Transaction Successful!",
    error: "Transaction Failed"
  },
  description = {
    default: "Please wait while we process your transaction on the blockchain.",
    success: "Your transaction has been confirmed on the blockchain.",
    error: "There was an error processing your transaction."
  }
}: TransactionStatusDialogProps) {

  // Determine if the dialog can be closed
  const canClose = txStatus === TransactionStatus.SUCCESS || txStatus === TransactionStatus.ERROR

  // Get the appropriate title and description based on status
  const dialogTitle = txStatus === TransactionStatus.SUCCESS 
    ? title.success 
    : txStatus === TransactionStatus.ERROR 
      ? title.error 
      : title.default

  const dialogDescription = txStatus === TransactionStatus.SUCCESS 
    ? description.success 
    : txStatus === TransactionStatus.ERROR 
      ? description.error 
      : description.default

  const handleCopy = () => {
    if (txDigest) {
      navigator.clipboard.writeText(txDigest)
      toast.success("Transaction ID copied to clipboard")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Only allow closing if the transaction is complete or failed
      if (!newOpen && canClose) {
        onOpenChange(false)
        if (onClose) onClose()
      } else if (!newOpen) {
        return;
      } else {
        onOpenChange(false)
      }
    }}>
      <DialogContent className="w-[95vw] max-w-md mx-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 mb-1">
            {txStatus === TransactionStatus.SUCCESS && (
              <div className="bg-green-100 dark:bg-green-900/30 p-2 sm:p-3 rounded-full flex-shrink-0">
                <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
            )}
            {txStatus === TransactionStatus.ERROR && (
              <div className="bg-red-100 dark:bg-red-900/30 p-2 sm:p-3 rounded-full flex-shrink-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
              </div>
            )}
            {txStatus !== TransactionStatus.SUCCESS && txStatus !== TransactionStatus.ERROR && (
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 sm:p-3 rounded-full flex-shrink-0">
                <div className="relative h-4 w-4 sm:h-5 sm:w-5">
                  <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                </div>
              </div>
            )}
            <span className="text-sm sm:text-base lg:text-lg font-semibold leading-tight break-words word-wrap overflow-wrap-anywhere">{dialogTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words word-wrap overflow-wrap-anywhere">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Enhanced Transaction Progress Steps */}
          <div className="space-y-2 sm:space-y-3 mt-2">
            {[
              { status: TransactionStatus.BUILDING, label: 'Building Transaction', description: 'Preparing transaction data' },
              { status: TransactionStatus.SIGNING, label: 'Signing Transaction', description: 'Awaiting wallet signature' },
              { status: TransactionStatus.EXECUTING, label: 'Executing Transaction', description: 'Broadcasting to network' },
              { status: TransactionStatus.CONFIRMING, label: 'Confirming Transaction', description: 'Waiting for confirmation' },
            ].map((step, index) => {
              const isActive = txStatus === step.status
              const isCompleted = txStatus === TransactionStatus.SUCCESS || (txStatus !== TransactionStatus.ERROR && Object.values(TransactionStatus).indexOf(txStatus) > Object.values(TransactionStatus).indexOf(step.status))
              const hasError = txStatus === TransactionStatus.ERROR && failedStep === step.status
              const wasCompletedBeforeError = txStatus === TransactionStatus.ERROR && failedStep && Object.values(TransactionStatus).indexOf(failedStep) > Object.values(TransactionStatus).indexOf(step.status)
              
              return (
                <div key={step.status} className={cn(
                  "flex items-center gap-3 p-3 sm:p-4 rounded-lg transition-all duration-300 min-w-0",
                  isActive ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 shadow-sm" :
                  isCompleted || wasCompletedBeforeError ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 shadow-sm" :
                  hasError ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" :
                  "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                )}>
                  <div className={cn(
                    "p-2 sm:p-2.5 rounded-full flex-shrink-0",
                    isActive ? "bg-blue-100 dark:bg-blue-900/30" :
                    isCompleted || wasCompletedBeforeError ? "bg-green-100 dark:bg-green-900/30" :
                    hasError ? "bg-red-100 dark:bg-red-900/30" :
                    "bg-gray-100 dark:bg-gray-700"
                  )}>
                    {isCompleted || wasCompletedBeforeError ? (
                      <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                    ) : isActive ? (
                      <div className="relative h-3 w-3 sm:h-4 sm:w-4">
                        <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                      </div>
                    ) : hasError ? (
                      <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400" />
                    ) : (
                      <Circle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className={cn(
                      "text-xs sm:text-sm font-medium break-words",
                      isActive ? "text-blue-700 dark:text-blue-300" :
                      isCompleted || wasCompletedBeforeError ? "text-green-700 dark:text-green-300" :
                      hasError ? "text-red-700 dark:text-red-300" :
                      "text-gray-600 dark:text-gray-400"
                    )}>
                      {step.label}
                    </div>
                    {isActive && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 break-words">
                        {step.description}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium flex-shrink-0 ml-2">
                    {index + 1}/4
                  </div>
                  {isActive && (
                    <div className="ml-2 flex-shrink-0">
                      <div className="flex space-x-0.5 sm:space-x-1">
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Enhanced Success Transaction ID */}
          {txStatus === TransactionStatus.SUCCESS && txDigest && (
            <div className="mt-4 space-y-3">
              {/* Header section - stack on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm font-medium">Transaction ID</span>
                <Link
                  href={`${explorerUrl}/txblock/${txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors self-start sm:self-auto"
                >
                  View on Explorer
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </Link>
              </div>
              
              {/* Enhanced Transaction ID display */}
              <div className="flex items-center gap-2 bg-muted/50 p-3 sm:p-4 rounded-lg border min-w-0">
                <code className="text-xs sm:text-sm font-mono text-foreground/80 flex-1 min-w-0 block leading-relaxed break-all">
                  {txDigest}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 hover:bg-muted"
                  onClick={handleCopy}
                  title="Copy Transaction ID"
                >
                  <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Error Handling */}
          {txStatus === TransactionStatus.ERROR && transactionError && (
            <div className="mt-4 space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <AlertTitle>Transaction Failed</AlertTitle>
                <AlertDescription className="text-xs break-words word-wrap overflow-wrap-anywhere max-h-32 overflow-y-auto whitespace-pre-wrap">{transactionError}</AlertDescription>
              </Alert>

              {/* Error-specific guidance */}
              {transactionError.includes("rejection") || transactionError.includes("cancelled") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-medium break-words">You declined the transaction</p>
                      <p className="text-xs break-words">You can try again when you're ready by clicking the "Try Again" button below.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("insufficient") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-medium break-words">Insufficient funds</p>
                      <p className="text-xs break-words">Please add more SUI to your wallet to cover the transaction fee, then try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("network") || transactionError.includes("timeout") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wifi className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-medium break-words">Network issue detected</p>
                      <p className="text-xs break-words">Please check your internet connection and try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("wallet") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-medium break-words">Wallet connection issue</p>
                      <p className="text-xs break-words">Please check that your wallet is connected and try again.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800/30">
                  <div className="flex gap-2 text-blue-800 dark:text-blue-300">
                    <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-medium break-words">Something went wrong</p>
                      <p className="text-xs break-words">You can try again or come back later if the issue persists.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6">
          {txStatus === TransactionStatus.SUCCESS && (
            <Button
              onClick={() => {
                onOpenChange(false)
                if (onClose) onClose()
              }}
              className="w-full h-10 sm:h-11 text-sm sm:text-base font-medium"
              size="lg"
            >
              <Check className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              Complete
            </Button>
          )}
          
          {txStatus === TransactionStatus.ERROR && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  if (onClose) onClose()
                }}
                className="w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base font-medium order-2 sm:order-1"
                size="lg"
              >
                <X className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Cancel
              </Button>
              {onRetry && (
                <Button
                  onClick={() => {
                    onOpenChange(false)
                    onRetry()
                  }}
                  className="w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base font-medium order-1 sm:order-2"
                  size="lg"
                >
                  <RotateCcw className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Try Again
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}