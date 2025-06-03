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
  PACKAGE_ID: process.env.NEXT_PUBLIC_SUIVOTE_PACKAGE_ID || "0xbdac727e5cc414447972208250748eeb28290ade37aea7ca6f824e3e98723ba9",
  ADMIN_ID: process.env.NEXT_PUBLIC_SUIVOTE_ADMIN_ID || "0x0c043dbfbc21ecb4426af4853d51264695a1c42c80c388c11d1ca703ab75c879",

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

  // Walrus Storage Configuration
  WALRUS_PUBLISHER_URL: process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || "https://publisher.testnet.walrus.xyz",
  WALRUS_AGGREGATOR_URL: process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL || "https://aggregator.testnet.walrus.xyz",
  WALRUS_STORAGE_EPOCHS: process.env.NEXT_PUBLIC_WALRUS_STORAGE_EPOCHS || "10",
}

export default SUI_CONFIG
