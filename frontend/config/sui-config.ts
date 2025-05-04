/**
 * Configuration for SuiVote service
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
}

export default SUI_CONFIG
