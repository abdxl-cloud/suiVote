/**
 * Configuration for SuiVote service
 *
 * This file contains all the configuration parameters for the SuiVote service.
 * It should be updated with the correct values for your deployment.
 */
export const SUI_CONFIG = {
  // Network configuration
  NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet",

  // Contract configuration
  PACKAGE_ID: process.env.NEXT_PUBLIC_SUIVOTE_PACKAGE_ID || "YOUR_PACKAGE_ID_HERE",
  ADMIN_ID: process.env.NEXT_PUBLIC_SUIVOTE_ADMIN_ID || "ADMIN_OBJECT_ID_FROM_PUBLISH_OUTPUT",

  // Feature flags
  ENABLE_LIVE_RESULTS: process.env.NEXT_PUBLIC_ENABLE_LIVE_RESULTS === "true",

  // Token requirements
  DEFAULT_TOKEN_TYPE: "0x2::sui::SUI",

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,

  // Transaction defaults
  DEFAULT_GAS_BUDGET: 30000000, // 30M gas units

  // Timeouts
  REQUEST_TIMEOUT_MS: 30000, // 30 seconds

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000, // 1 second

  // Logging
  VERBOSE_LOGGING: process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true",
}

export default SUI_CONFIG
