/**
 * Configuration for SuiVote service
 *
 * This file contains all the configuration parameters for the SuiVote service.
 * It should be updated with the correct values for your deployment.
 */
export const SUI_CONFIG = {
  // Network configuration
  NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet",
  explorerUrl: process.env.NEXT_PUBLIC_SUI_EXPLORER_URL || "https://testnet.suivision.xyz",

  // Contract configuration
  PACKAGE_ID: process.env.NEXT_PUBLIC_SUIVOTE_PACKAGE_ID || "0x8be15953dd10056899242f2758739d4fa38b06f13589a3ea82a002673b90ae95",
  ADMIN_ID: process.env.NEXT_PUBLIC_SUIVOTE_ADMIN_ID || "0xeb0a953ae7db98619da9a2ddce05efc13f2865de860d9aacee5bb1406b222679",

  // Feature flags
  ENABLE_LIVE_RESULTS: process.env.NEXT_PUBLIC_ENABLE_LIVE_RESULTS === "true",

  // Token requirements
  DEFAULT_TOKEN_TYPE: "0x2::sui::SUI",

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,

  // Transaction defaults
  DEFAULT_GAS_BUDGET: 30000000, // 30M gas units

  // Timeouts
  REQUEST_TIMEOUT_MS: 10000, // 10 seconds

  // Retry configuration
  MAX_RETRIES: 5,
  RETRY_DELAY_MS: 500, // 5 milliseconds

  // Logging
  VERBOSE_LOGGING: process.env.NEXT_PUBLIC_VERBOSE_LOGGING === "true",

  // Walrus Storage Configuration
  WALRUS_PUBLISHER_URL: process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL || "https://publisher.testnet.walrus.xyz",
  WALRUS_AGGREGATOR_URL: process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL || "https://aggregator.testnet.walrus.xyz",
  WALRUS_STORAGE_EPOCHS: process.env.NEXT_PUBLIC_WALRUS_STORAGE_EPOCHS || "10",
}

export default SUI_CONFIG
