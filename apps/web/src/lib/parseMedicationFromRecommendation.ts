/**
 * Parse medication details from recommendation text
 * Extracts dosage, frequency, and schedule times
 */

export interface ParsedMedicationData {
  dosage: string;
  frequency: string;
  scheduleTimes: string[];
  instructions: string;
}

/**
 * Parse dosage from recommendation text
 * Matches patterns like "10mg", "500mg", "2 tablets", "1.5mg"
 */
export function parseDosage(text: string): string {
  // Common dosage patterns
  const patterns = [
    /(\d+\.?\d*\s*(?:mg|mcg|g|ml|tablet|capsule|pill)s?)/gi,
    /(\d+\.?\d*\s*(?:milligram|microgram|gram|milliliter)s?)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      // Return the first match, normalized
      return matches[0].trim();
    }
  }

  return '';
}

/**
 * Parse frequency from recommendation text
 * Matches patterns like "twice daily", "once daily", "3 times per day", "every 8 hours"
 */
export function parseFrequency(text: string): string {
  // Common frequency patterns
  const patterns = [
    // "once daily", "twice daily", "three times daily"
    /(once|twice|three times?|1x|2x|3x)\s*(daily|a day|per day)/i,
    // "every X hours"
    /every\s+(\d+)\s+hours?/i,
    // "X times per day"
    /(\d+)\s*times?\s*(per day|daily|a day)/i,
    // "morning", "bedtime", "with meals"
    /(in the morning|at bedtime|with meals|before bed)/i,
    // "as needed", "PRN"
    /(as needed|prn|when needed)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return 'once daily'; // Default fallback
}

/**
 * Convert frequency text to schedule times
 * Maps common frequencies to time arrays
 */
export function frequencyToScheduleTimes(frequency: string): string[] {
  const freq = frequency.toLowerCase();

  // Common frequency mappings
  if (freq.includes('once') || freq.includes('1x') || freq.includes('1 time')) {
    return ['08:00'];
  }

  if (freq.includes('twice') || freq.includes('2x') || freq.includes('2 time')) {
    return ['08:00', '20:00'];
  }

  if (freq.includes('three') || freq.includes('3x') || freq.includes('3 time')) {
    return ['08:00', '14:00', '20:00'];
  }

  if (freq.includes('four') || freq.includes('4x') || freq.includes('4 time')) {
    return ['08:00', '12:00', '16:00', '20:00'];
  }

  // Every X hours
  const everyHoursMatch = freq.match(/every\s+(\d+)\s+hours?/);
  if (everyHoursMatch) {
    const hours = parseInt(everyHoursMatch[1]);
    if (hours === 4) return ['08:00', '12:00', '16:00', '20:00', '00:00', '04:00'];
    if (hours === 6) return ['08:00', '14:00', '20:00', '02:00'];
    if (hours === 8) return ['08:00', '16:00', '00:00'];
    if (hours === 12) return ['08:00', '20:00'];
  }

  // Time-specific
  if (freq.includes('morning')) return ['08:00'];
  if (freq.includes('bedtime') || freq.includes('before bed')) return ['21:00'];

  // Default: twice daily
  return ['08:00', '20:00'];
}

/**
 * Parse instructions from recommendation text
 * Extracts notes, warnings, or special instructions
 */
export function parseInstructions(text: string): string {
  // Look for instruction patterns
  const patterns = [
    /take with (food|meals|water)/i,
    /take (before|after) (meals|eating)/i,
    /do not take with/i,
    /avoid/i,
  ];

  const instructions: string[] = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      instructions.push(match[0]);
    }
  }

  return instructions.join('. ');
}

/**
 * Main parsing function
 * Extracts all medication details from recommendation text
 */
export function parseMedicationFromRecommendation(recommendation: {
  title: string;
  description: string;
  frequency?: string | null;
  duration?: string | null;
}): ParsedMedicationData {
  // Combine title and description for parsing
  const fullText = `${recommendation.title} ${recommendation.description}`;

  // Parse dosage
  const dosage = parseDosage(fullText);

  // Parse frequency - use recommendation.frequency if available, otherwise parse
  let frequency = recommendation.frequency || parseFrequency(fullText);

  // Normalize frequency
  frequency = normalizeFrequency(frequency);

  // Convert frequency to schedule times
  const scheduleTimes = frequencyToScheduleTimes(frequency);

  // Parse instructions
  const instructions = parseInstructions(fullText);

  return {
    dosage,
    frequency,
    scheduleTimes,
    instructions,
  };
}

/**
 * Normalize frequency to standard format
 */
function normalizeFrequency(frequency: string): string {
  const freq = frequency.toLowerCase().trim();

  // Normalize common variations
  const normalizations: Record<string, string> = {
    '1x daily': 'once daily',
    '1x per day': 'once daily',
    '1 time daily': 'once daily',
    '1 time per day': 'once daily',
    '2x daily': 'twice daily',
    '2x per day': 'twice daily',
    '2 times daily': 'twice daily',
    '2 times per day': 'twice daily',
    '3x daily': 'three times daily',
    '3x per day': 'three times daily',
    '3 times per day': 'three times daily',
    'bid': 'twice daily',
    'tid': 'three times daily',
    'qid': 'four times daily',
    'qd': 'once daily',
    'qhs': 'at bedtime',
  };

  return normalizations[freq] || frequency;
}

/**
 * Extract medication name from recommendation title or description
 */
export function parseMedicationName(recommendation: {
  title: string;
  description: string;
}): string {
  // Try to extract from title first
  // Common patterns: "Add new medication: Lisinopril" or "Dosage change: Lisinopril"
  const titlePatterns = [
    /(?:Add new medication|medication):\s*([A-Za-z]+)/i,
    /(?:Dosage change):\s*([A-Za-z]+)/i,
    /^([A-Za-z]+)\s+\d+/i, // "Lisinopril 10mg"
  ];

  for (const pattern of titlePatterns) {
    const match = recommendation.title.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Try to extract from description
  const descPatterns = [
    /Document lists\s+([A-Za-z]+)/i,
    /shows\s+([A-Za-z]+)\s+\d+/i,
  ];

  for (const pattern of descPatterns) {
    const match = recommendation.description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: use title as-is
  return recommendation.title.replace(/Add new medication:\s*/i, '').trim();
}
