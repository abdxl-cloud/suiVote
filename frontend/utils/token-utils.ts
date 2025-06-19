/**
 * Token utility functions for converting between human-readable and decimal values
 */

/**
 * Convert human-readable token amount to decimal units (e.g., SUI to MIST)
 * @param amount Human-readable amount as string or number
 * @param decimals Number of decimal places for the token
 * @returns Amount in smallest decimal units as string
 */
export function toDecimalUnits(amount: string | number, decimals: number): string {
  if (!amount || amount === "" || amount === "0") {
    return "0"
  }

  const amountStr = typeof amount === "number" ? amount.toString() : amount
  
  if (isNaN(parseFloat(amountStr)) || parseFloat(amountStr) < 0) {
    throw new Error("Invalid amount")
  }

  // Split the amount into integer and fractional parts to avoid floating-point precision issues
  const [integerPart = "0", fractionalPart = ""] = amountStr.split(".")
  
  // Pad or truncate the fractional part to match the required decimals
  const paddedFractionalPart = fractionalPart.padEnd(decimals, "0").slice(0, decimals)
  
  // Combine integer and fractional parts
  const combinedStr = integerPart + paddedFractionalPart
  
  // Remove leading zeros and return
  return BigInt(combinedStr).toString()
}

/**
 * Convert decimal units to human-readable token amount (e.g., MIST to SUI)
 * @param decimalAmount Amount in smallest decimal units as string or number
 * @param decimals Number of decimal places for the token
 * @returns Human-readable amount as string
 */
export function fromDecimalUnits(decimalAmount: string | number, decimals: number): string {
  console.log(decimalAmount, decimals)
  if (!decimalAmount || decimalAmount === "" || decimalAmount === "0" || decimalAmount === 0) {
    return "0"
  }

  const decimalStr = typeof decimalAmount === "number" ? decimalAmount.toString() : decimalAmount
  const numDecimalAmount = parseFloat(decimalStr)
  
  if (isNaN(numDecimalAmount) || numDecimalAmount < 0) {
    throw new Error("Invalid decimal amount")
  }

  // Convert from decimal units by dividing by 10^decimals
  const humanAmount = numDecimalAmount / Math.pow(10, decimals)
  
  // Return with appropriate precision, avoiding scientific notation
  // Use toFixed to ensure proper decimal representation, then remove trailing zeros
  const fixed = humanAmount.toFixed(decimals)
  return parseFloat(fixed).toString()
}

/**
 * Format token amount for display with proper decimals and symbol
 * @param amount Amount in human-readable format
 * @param symbol Token symbol (e.g., "SUI", "USDC")
 * @param maxDecimals Maximum number of decimal places to show
 * @returns Formatted string like "1.5 SUI"
 */
export function formatTokenAmount(amount: string | number, symbol: string, maxDecimals: number = 6): string {
  const numAmount = typeof amount === "number" ? amount : parseFloat(amount)
  
  if (isNaN(numAmount)) {
    return `0 ${symbol}`
  }

  // Format with appropriate decimal places
  const formatted = numAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })
  
  return `${formatted} ${symbol}`
}

/**
 * Validate that an amount doesn't exceed the maximum allowed value
 * @param amount Amount in human-readable format
 * @param maxAmount Maximum allowed amount in human-readable format
 * @param tokenSymbol Token symbol for error messages
 * @returns true if valid, throws error if invalid
 */
export function validateMaxAmount(amount: string | number, maxAmount: string | number, tokenSymbol: string): boolean {
  const numAmount = typeof amount === "number" ? amount : parseFloat(amount)
  const numMaxAmount = typeof maxAmount === "number" ? maxAmount : parseFloat(maxAmount)
  
  if (isNaN(numAmount) || isNaN(numMaxAmount)) {
    throw new Error("Invalid amount values")
  }
  
  if (numAmount > numMaxAmount) {
    throw new Error(`Amount cannot exceed ${formatTokenAmount(numMaxAmount, tokenSymbol)}`)
  }
  
  return true
}

/**
 * Get maximum allowed amount for vote creation (in human-readable format)
 * This prevents overflow issues and sets reasonable limits
 * @param decimals Number of decimal places for the token
 * @returns Maximum amount in human-readable format
 */
export function getMaxVoteAmount(decimals: number): number {
  // Set a reasonable maximum that won't cause overflow
  // For SUI (9 decimals), this would be 1 billion SUI
  // For tokens with fewer decimals, adjust accordingly
  const maxDecimalValue = Math.pow(10, 18) // Maximum safe integer-ish value
  const maxHumanValue = maxDecimalValue / Math.pow(10, decimals)
  
  // Cap at 1 billion for most practical purposes
  return Math.min(maxHumanValue, 1_000_000_000)
}

/**
 * Common token decimals for quick reference
 */
export const COMMON_TOKEN_DECIMALS = {
  SUI: 9,
  USDC: 6,
  USDT: 6,
  ETH: 18,
  BTC: 8
} as const