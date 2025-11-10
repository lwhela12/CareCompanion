import { PrismaClient, ProviderType } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface ProviderData {
  name?: string | null;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  fax?: string | null;
  address?: string | null;
  department?: string | null;
}

export class ProviderAutoPopulationService {
  /**
   * Upsert a provider from parsed document data.
   * Matches by name + specialty to avoid duplicates.
   * Updates existing provider with new information if found.
   */
  async upsertProviderFromParsedData(
    familyId: string,
    facilityName: string | null | undefined,
    providerData: ProviderData
  ): Promise<string | null> {
    if (!providerData.name) {
      logger.debug('No provider name found, skipping provider creation');
      return null;
    }

    try {
      // Fuzzy match: find provider by name (case-insensitive partial match)
      const existingProviders = await prisma.provider.findMany({
        where: {
          familyId,
          isActive: true,
          name: {
            contains: providerData.name,
            mode: 'insensitive',
          },
        },
      });

      // If we found potential matches, check specialty too
      let matchedProvider = null;
      if (existingProviders.length > 0) {
        if (providerData.specialty) {
          // Find exact match on specialty
          matchedProvider = existingProviders.find(
            (p) =>
              p.specialty?.toLowerCase() === providerData.specialty?.toLowerCase()
          );
        } else {
          // No specialty provided, use first match
          matchedProvider = existingProviders[0];
        }
      }

      // Determine provider type from specialty
      const providerType = this.classifyProviderType(providerData.specialty);

      // Parse address from address string if provided
      const addressParts = providerData.address
        ? this.parseAddress(providerData.address)
        : {};

      if (matchedProvider) {
        // Update existing provider with new information (fill in blanks)
        const updated = await prisma.provider.update({
          where: { id: matchedProvider.id },
          data: {
            // Only update fields that are currently null/empty
            specialty: matchedProvider.specialty || providerData.specialty,
            phone: matchedProvider.phone || providerData.phone,
            email: matchedProvider.email || providerData.email,
            fax: matchedProvider.fax || providerData.fax,
            facility: matchedProvider.facility || facilityName,
            department: matchedProvider.department || providerData.department,
            addressLine1: matchedProvider.addressLine1 || addressParts.addressLine1,
            addressLine2: matchedProvider.addressLine2 || addressParts.addressLine2,
            city: matchedProvider.city || addressParts.city,
            state: matchedProvider.state || addressParts.state,
            zipCode: matchedProvider.zipCode || addressParts.zipCode,
            type: matchedProvider.type !== 'OTHER' ? matchedProvider.type : providerType,
            updatedAt: new Date(),
          },
        });

        logger.info(`Updated existing provider: ${updated.name} (${updated.id})`);
        return updated.id;
      } else {
        // Create new provider
        const created = await prisma.provider.create({
          data: {
            familyId,
            name: providerData.name,
            specialty: providerData.specialty,
            type: providerType,
            phone: providerData.phone,
            email: providerData.email,
            fax: providerData.fax,
            facility: facilityName,
            department: providerData.department,
            addressLine1: addressParts.addressLine1,
            addressLine2: addressParts.addressLine2,
            city: addressParts.city,
            state: addressParts.state,
            zipCode: addressParts.zipCode,
            isActive: true,
            isPrimary: false,
          },
        });

        logger.info(`Created new provider: ${created.name} (${created.id})`);
        return created.id;
      }
    } catch (error) {
      logger.error('Error upserting provider:', error);
      return null;
    }
  }

  /**
   * Classify provider type based on specialty keywords
   */
  private classifyProviderType(specialty: string | null | undefined): ProviderType {
    if (!specialty) return 'PHYSICIAN';

    const spec = specialty.toLowerCase();

    // Therapist keywords
    if (
      spec.includes('physical therapy') ||
      spec.includes('occupational therapy') ||
      spec.includes('speech therapy') ||
      spec.includes('pt') ||
      spec.includes('ot') ||
      spec.includes('slp')
    ) {
      return 'THERAPIST';
    }

    // Pharmacist
    if (spec.includes('pharmac')) {
      return 'PHARMACIST';
    }

    // Facility
    if (
      spec.includes('hospital') ||
      spec.includes('clinic') ||
      spec.includes('center') ||
      spec.includes('facility')
    ) {
      return 'FACILITY';
    }

    // Specialist (vs general physician)
    if (
      spec.includes('cardio') ||
      spec.includes('neuro') ||
      spec.includes('oncol') ||
      spec.includes('ortho') ||
      spec.includes('urol') ||
      spec.includes('dermat') ||
      spec.includes('ophthalm') ||
      spec.includes('ent') ||
      spec.includes('gastro') ||
      spec.includes('pulmon') ||
      spec.includes('endocrin') ||
      spec.includes('rheumato') ||
      spec.includes('nephro') ||
      spec.includes('hematol')
    ) {
      return 'SPECIALIST';
    }

    // Primary care
    if (
      spec.includes('primary') ||
      spec.includes('family') ||
      spec.includes('internal medicine') ||
      spec.includes('general practice')
    ) {
      return 'PHYSICIAN';
    }

    // Default to specialist if we don't recognize it
    return 'SPECIALIST';
  }

  /**
   * Parse address string into components
   * Basic implementation - can be enhanced with address parsing library
   */
  private parseAddress(addressString: string): {
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  } {
    // Very simple parsing - just store as addressLine1 for now
    // In production, you'd use a proper address parsing library
    const parts = addressString.split(',').map((p) => p.trim());

    if (parts.length === 1) {
      return { addressLine1: addressString };
    }

    if (parts.length === 2) {
      return {
        addressLine1: parts[0],
        city: parts[1],
      };
    }

    if (parts.length >= 3) {
      // Pattern: Street, City, State ZIP
      const lastPart = parts[parts.length - 1];
      const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);

      return {
        addressLine1: parts[0],
        city: parts[parts.length - 2],
        state: stateZipMatch?.[1],
        zipCode: stateZipMatch?.[2],
      };
    }

    return { addressLine1: addressString };
  }
}

export const providerAutoPopulationService = new ProviderAutoPopulationService();
