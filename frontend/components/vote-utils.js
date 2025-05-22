// voteUtils.js - Create this file with the utility functions

/**
 * Maps frontend option IDs to blockchain indices with validation
 */
export function mapOptionIdsToIndices(poll, selectedOptionIds) {
  if (!poll || !poll.options || !Array.isArray(poll.options)) {
    console.error("[Mapping Error] Invalid poll structure:", poll);
    return [];
  }
  
  if (!selectedOptionIds || !Array.isArray(selectedOptionIds)) {
    console.error("[Mapping Error] Invalid selections:", selectedOptionIds);
    return [];
  }
  
  // Create a map of option ID to index for quick lookups
  const optionIndexMap = {};
  
  // Log all options for debugging
  console.log(`[Mapping Debug] Poll "${poll.title}" has ${poll.options.length} options:`);
  
  // Build the mapping
  poll.options.forEach((option, index) => {
    if (!option.id) {
      console.error(`[Mapping Error] Option at index ${index} has no ID:`, option);
      return;
    }
    
    // Store the mapping (convert to 1-based index for contract)
    optionIndexMap[option.id] = index + 1;
    
    // Debug output for each option
    console.log(`[Mapping Debug] Option "${option.text}" (ID: ${option.id}) → Index: ${index + 1}`);
  });
  
  // Map selected IDs to indices
  const mappedIndices = selectedOptionIds.map(optionId => {
    const index = optionIndexMap[optionId];
    
    if (!index) {
      console.error(`[Mapping Error] Could not find index for option ID: ${optionId}`);
      return null;
    }
    
    return index;
  }).filter(index => index !== null);
  
  // Log the mapping results
  console.log("[Mapping Debug] Selection mapping results:", {
    selectedIds: selectedOptionIds,
    mappedIndices: mappedIndices
  });
  
  return mappedIndices;
}

/**
 * Maps blockchain indices back to frontend option IDs
 */
export function mapIndicesToOptionIds(poll, optionIndices) {
  if (!poll || !poll.options || !Array.isArray(poll.options)) {
    console.error("[Mapping Error] Invalid poll structure:", poll);
    return [];
  }
  
  if (!optionIndices || !Array.isArray(optionIndices)) {
    console.error("[Mapping Error] Invalid indices:", optionIndices);
    return [];
  }
  
  // Map indices back to option IDs
  const mappedIds = optionIndices.map(index => {
    // Convert from 1-based to 0-based for array access
    const arrayIndex = index - 1;
    
    if (arrayIndex < 0 || arrayIndex >= poll.options.length) {
      console.error(`[Mapping Error] Invalid option index: ${index} (array index: ${arrayIndex})`);
      return null;
    }
    
    const option = poll.options[arrayIndex];
    return option.id;
  }).filter(id => id !== null);
  
  // Log the mapping results
  console.log("[Mapping Debug] Index to ID mapping results:", {
    indices: optionIndices,
    mappedIds: mappedIds
  });
  
  return mappedIds;
}

/**
 * Diagnostic function to verify option mappings
 */
export function verifyOptionMappings(polls, selections) {
  console.group("🔍 Option Mapping Verification");
  
  polls.forEach((poll, pollIdx) => {
    console.group(`Poll ${pollIdx + 1}: "${poll.title}"`);
    
    // Log all options in this poll
    console.log("Options:");
    poll.options.forEach((option, optIdx) => {
      console.log(`  ${optIdx + 1}. ID: ${option.id}, Text: "${option.text}"`);
    });
    
    // Log selections for this poll
    const selectedIds = selections[poll.id] || [];
    console.log("User selections:");
    if (selectedIds.length === 0) {
      console.log("  None");
    } else {
      selectedIds.forEach(id => {
        const option = poll.options.find(opt => opt.id === id);
        if (option) {
          const index = poll.options.indexOf(option) + 1;
          console.log(`  Selected: "${option.text}" (ID: ${id}, Index: ${index})`);
        } else {
          console.error(`  ERROR: Selected ID ${id} not found in poll options`);
        }
      });
    }
    
    // Calculate expected blockchain indices
    const expectedIndices = mapOptionIdsToIndices(poll, selectedIds);
    console.log("Mapped indices (will be sent to blockchain):", expectedIndices);
    
    console.groupEnd();
  });
  
  console.groupEnd();
}