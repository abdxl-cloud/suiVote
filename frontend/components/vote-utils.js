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
  
  // Build the mapping
  poll.options.forEach((option, index) => {
    if (!option.id) {
      console.error(`[Mapping Error] Option at index ${index} has no ID:`, option);
      return;
    }
    
    // Store the mapping (convert to 1-based index for contract)
    optionIndexMap[option.id] = index + 1;
  
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

  return mappedIds;
}

/**
 * Diagnostic function to verify option mappings
 */
export function verifyOptionMappings(polls, selections) {
  
  polls.forEach((poll, pollIdx) => {
    
    poll.options.forEach((option, optIdx) => {
    });
    
    // Log selections for this poll
    const selectedIds = selections[poll.id] || [];
    if (selectedIds.length === 0) {
    } else {
      selectedIds.forEach(id => {
        const option = poll.options.find(opt => opt.id === id);
        if (option) {
          const index = poll.options.indexOf(option) + 1;
        } else {
          console.error(`  ERROR: Selected ID ${id} not found in poll options`);
        }
      });
    }

  });
  
}