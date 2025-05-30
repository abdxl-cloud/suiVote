"use client"

import { useState } from "react"
import { Check, AlertCircle, Loader2, ExternalLink, Copy, Circle, X, RefreshCw, Info, Wallet, Wifi, HelpCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 mb-1">
            {txStatus === TransactionStatus.SUCCESS && (
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            )}
            {txStatus === TransactionStatus.ERROR && (
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            )}
            {txStatus !== TransactionStatus.SUCCESS && txStatus !== TransactionStatus.ERROR && (
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            <span>{dialogTitle}</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 mt-2">
            {/* Building Transaction Step */}
            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.BUILDING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.BUILDING && txStatus !== TransactionStatus.ERROR ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.BUILDING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.BUILDING && txStatus !== TransactionStatus.ERROR ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : txStatus === TransactionStatus.ERROR ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.BUILDING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.BUILDING && txStatus !== TransactionStatus.ERROR ? "font-medium" :
                      txStatus === TransactionStatus.ERROR ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                )}>
                  Building Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 1/4</span>
            </div>

            {/* Signing Transaction Step */}
            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.SIGNING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.SIGNING && txStatus !== TransactionStatus.ERROR ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.SIGNING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.SIGNING && txStatus !== TransactionStatus.ERROR ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.SIGNING ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.SIGNING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.SIGNING && txStatus !== TransactionStatus.ERROR ? "font-medium" :
                      txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.SIGNING ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                )}>
                  Signing Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 2/4</span>
            </div>

            {/* Executing Transaction Step */}
            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.EXECUTING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.EXECUTING && txStatus !== TransactionStatus.ERROR ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.EXECUTING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.EXECUTING && txStatus !== TransactionStatus.ERROR ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.EXECUTING ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.EXECUTING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.EXECUTING && txStatus !== TransactionStatus.ERROR ? "font-medium" :
                      txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.EXECUTING ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                )}>
                  Executing Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 3/4</span>
            </div>

            {/* Confirming Transaction Step */}
            <div className={cn(
              "flex items-center justify-between text-sm p-2.5 rounded-md transition-colors duration-300",
              txStatus === TransactionStatus.CONFIRMING ? "bg-primary/10 border border-primary/20" :
                txStatus > TransactionStatus.CONFIRMING && txStatus !== TransactionStatus.ERROR ? "bg-green-50 dark:bg-green-900/20" :
                  "bg-muted/20"
            )}>
              <span className="flex items-center gap-2">
                {txStatus === TransactionStatus.CONFIRMING ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : txStatus > TransactionStatus.CONFIRMING && txStatus !== TransactionStatus.ERROR ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.CONFIRMING ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(
                  txStatus === TransactionStatus.CONFIRMING ? "font-medium text-primary" :
                    txStatus > TransactionStatus.CONFIRMING && txStatus !== TransactionStatus.ERROR ? "font-medium" :
                      txStatus === TransactionStatus.ERROR && txStatus >= TransactionStatus.CONFIRMING ? "text-red-600 dark:text-red-400" :
                      "text-muted-foreground"
                )}>
                  Confirming Transaction
                </span>
              </span>
              <span className="text-xs text-muted-foreground font-medium">Step 4/4</span>
            </div>
          </div>

          {/* Success Transaction ID */}
          {txStatus === TransactionStatus.SUCCESS && txDigest && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Transaction ID</span>
                <Link
                  href={`${explorerUrl}/txblock/${txDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  View on Explorer
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-md">
                <code className="text-xs text-muted-foreground flex-1 truncate">{txDigest}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Error Handling */}
          {txStatus === TransactionStatus.ERROR && transactionError && (
            <div className="mt-4 space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Transaction Failed</AlertTitle>
                <AlertDescription className="text-xs break-all max-h-32 overflow-y-auto">{transactionError}</AlertDescription>
              </Alert>

              {/* Error-specific guidance */}
              {transactionError.includes("rejection") || transactionError.includes("cancelled") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Info className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">You declined the transaction</p>
                      <p className="text-xs">You can try again when you're ready by clicking the "Try Again" button below.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("insufficient") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Insufficient funds</p>
                      <p className="text-xs">Please add more SUI to your wallet to cover the transaction fee, then try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("network") || transactionError.includes("timeout") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wifi className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Network issue detected</p>
                      <p className="text-xs">Please check your internet connection and try again.</p>
                    </div>
                  </div>
                </div>
              ) : transactionError.includes("wallet") ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-200 dark:border-amber-800/30">
                  <div className="flex gap-2 text-amber-800 dark:text-amber-300">
                    <Wallet className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Wallet connection issue</p>
                      <p className="text-xs">Please check that your wallet is connected and try again.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800/30">
                  <div className="flex gap-2 text-blue-800 dark:text-blue-300">
                    <HelpCircle className="h-4 w-4 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Something went wrong</p>
                      <p className="text-xs">You can try again or come back later if the issue persists.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          {txStatus === TransactionStatus.SUCCESS ? (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false)
                if (onSuccess) onSuccess()
              }}
              className="w-full gap-2"
            >
              <Check className="h-4 w-4" />
              Close
            </Button>
          ) : txStatus === TransactionStatus.ERROR ? (
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  if (onClose) onClose()
                }}
                className="flex-1 gap-2"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (onRetry) onRetry()
                }}
                className="flex-1 gap-2 bg-primary hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          ) : (
            <Button type="button" disabled className="w-full gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}