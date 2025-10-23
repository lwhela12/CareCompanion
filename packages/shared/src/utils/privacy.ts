// Privacy-preserving utilities for patient dignity

const SENSITIVE_TERMS = [
  // Bathroom/hygiene
  'bathroom', 'toilet', 'diaper', 'accident', 'incontinence', 'bowel', 'urinate',
  // Family conflicts
  'argue', 'fight', 'yell', 'angry', 'hate', 'divorce',
  // Financial
  'money', 'broke', 'afford', 'debt', 'bills',
  // Death/End of life
  'die', 'death', 'funeral', 'suicide', 'kill',
];

export function sanitizeJournalContent(content: string): {
  sanitized: string;
  hasSensitiveContent: boolean;
  categories: string[];
} {
  let sanitized = content;
  const detectedCategories = new Set<string>();
  let hasSensitiveContent = false;
  
  // Check for sensitive terms
  const lowerContent = content.toLowerCase();
  
  for (const term of SENSITIVE_TERMS) {
    if (lowerContent.includes(term)) {
      hasSensitiveContent = true;
      
      // Categorize the sensitive content
      if (['bathroom', 'toilet', 'diaper', 'accident', 'incontinence'].includes(term)) {
        detectedCategories.add('hygiene');
      } else if (['argue', 'fight', 'yell', 'angry', 'hate', 'divorce'].includes(term)) {
        detectedCategories.add('family_dynamics');
      } else if (['money', 'broke', 'afford', 'debt', 'bills'].includes(term)) {
        detectedCategories.add('financial');
      } else if (['die', 'death', 'funeral', 'suicide', 'kill'].includes(term)) {
        detectedCategories.add('end_of_life');
      }
    }
  }
  
  // Generate sanitized summary if sensitive content detected
  if (hasSensitiveContent) {
    sanitized = generatePrivacyPreservingSummary(content, Array.from(detectedCategories));
  }
  
  return {
    sanitized,
    hasSensitiveContent,
    categories: Array.from(detectedCategories),
  };
}

function generatePrivacyPreservingSummary(_content: string, categories: string[]): string {
  const summaries: Record<string, string> = {
    hygiene: 'Patient experienced challenges with daily activities',
    family_dynamics: 'Family interaction noted',
    financial: 'Financial concerns discussed',
    end_of_life: 'Patient expressed existential thoughts',
  };
  
  const summaryParts = categories.map(cat => summaries[cat] || 'Personal matter discussed');
  
  if (summaryParts.length === 1) {
    return summaryParts[0];
  }
  
  return `Multiple concerns noted: ${summaryParts.join('; ')}`;
}

export function anonymizePatientData(data: any): any {
  // Deep clone the data
  const anonymized = JSON.parse(JSON.stringify(data));
  
  // Replace names with initials
  if (anonymized.name) {
    const parts = anonymized.name.split(' ');
    anonymized.name = parts.map((p: string) => p[0] + '.').join(' ');
  }
  
  // Remove specific identifiers
  delete anonymized.medicalRecordNumber;
  delete anonymized.socialSecurityNumber;
  delete anonymized.insuranceId;
  
  // Generalize dates
  if (anonymized.dateOfBirth) {
    const dob = new Date(anonymized.dateOfBirth);
    anonymized.age = new Date().getFullYear() - dob.getFullYear();
    delete anonymized.dateOfBirth;
  }
  
  return anonymized;
}

export function maskSensitiveNumbers(text: string): string {
  // Mask SSN patterns
  text = text.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, 'XXX-XX-XXXX');
  
  // Mask credit card patterns
  text = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'XXXX-XXXX-XXXX-XXXX');
  
  // Mask Medicare ID patterns
  text = text.replace(/\b[0-9]{3}-?[0-9]{2}-?[0-9]{4}-?[A-Z]\b/g, 'XXX-XX-XXXX-X');
  
  return text;
}