import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../../config';

export const ParsedMedicalRecordSchema = z.object({
  documentType: z
    .enum(['MEDICAL_RECORD', 'FINANCIAL', 'LEGAL', 'INSURANCE', 'OTHER'])
    .optional()
    .default('OTHER'),
  patient: z
    .object({
      name: z.string().optional().nullable(),
      dateOfBirth: z.string().optional().nullable(),
      mrn: z.string().optional().nullable(),
    })
    .optional()
    .default({}),
  visit: z
    .object({
      dateOfService: z.string().optional().nullable(),
      facility: z.string().optional().nullable(),
      summary: z.string().optional().nullable(),
      provider: z
        .object({
          name: z.string().optional().nullable(),
          specialty: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          email: z.string().optional().nullable(),
          fax: z.string().optional().nullable(),
          address: z.string().optional().nullable(),
          department: z.string().optional().nullable(),
        })
        .optional()
        .default({}),
      followUp: z.string().optional().nullable(),
      nextAppointment: z.string().optional().nullable(),
    })
    .optional()
    .default({}),
  diagnoses: z
    .array(
      z.object({
        name: z.string(),
        icd10: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  medications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().optional().nullable(),
        frequency: z.string().optional().nullable(),
        route: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  allergies: z
    .array(
      z.object({
        substance: z.string(),
        reaction: z.string().optional().nullable(),
        severity: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  procedures: z
    .array(
      z.object({
        name: z.string(),
        date: z.string().optional().nullable(),
        cpt: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  recommendations: z
    .array(
      z.object({
        text: z.string(),
        type: z.string().optional().nullable(),
        priority: z.string().optional().nullable(),
        frequency: z.string().optional().nullable(),
        duration: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  warnings: z.array(z.string()).optional().default([]),
});

export type ParsedMedicalRecord = z.infer<typeof ParsedMedicalRecordSchema>;
export type ParsedRecommendation = ParsedMedicalRecord['recommendations'][number];

export type StreamEvent =
  | { type: 'status'; status: string; detail?: any }
  | { type: 'delta'; text: string }
  | { type: 'result'; parsed: ParsedMedicalRecord }
  | { type: 'error'; message: string };

const MODEL = 'claude-haiku-4-5-20251001';

export class ClaudeDocumentService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!config.anthropicApiKey) {
      throw new Error('Anthropic API key is not configured');
    }
    if (!this.client) {
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    return this.client;
  }

  private getSystemPrompt(): string {
    return `You are a careful medical information extractor. The input may be a scan, photo, printed report, clinician note, or AI-notetaker summary.
Extract as much clinically relevant information as is actually present. Populate the JSON schema fully where possible.
If a field is not present, set scalars to null and lists to []. Do not invent data. Use concise, normalized values when obvious (e.g., dates YYYY-MM-DD). Avoid any content beyond the requested fields.

You MUST respond with ONLY valid JSON. No markdown, no explanation, no extra text.`;
  }

  private getExtractionInstructions(docDomainType: string): string {
    return `Read the document and extract all relevant information available.
The content might be free-form notes, bullet points, or structured fields.
Domain type hint: ${docDomainType}.

FIRST, classify the document type:
- MEDICAL_RECORD: Medical records, doctor's notes, lab results, prescriptions, visit summaries, discharge notes, etc.
- FINANCIAL: Financial statements, bills, invoices, receipts, bank statements, etc.
- LEGAL: Legal documents, contracts, wills, power of attorney, advance directives, etc.
- INSURANCE: Insurance cards, policies, claims, explanation of benefits (EOB), etc.
- OTHER: Any document that doesn't fit the above categories

IMPORTANT for recommendations: Extract EVERY recommendation as a SEPARATE array entry. Do NOT summarize or combine multiple recommendations into one. If the document contains 5 distinct recommendations, the array MUST have 5 entries.

For each recommendation entry:
- text: the complete recommendation text
- type: classify as medication, exercise, diet, therapy, lifestyle, monitoring, followup, or tests
- priority: classify as urgent, high, medium, or low if discernible
- frequency: e.g., "daily", "3x per week", "twice daily"
- duration: e.g., "ongoing", "6 weeks", "until next visit"

Example: If a document says "Start Metformin 500mg daily", "Increase exercise to 30min 3x/week", and "Follow up in 2 weeks", you MUST create 3 separate array entries - do NOT combine them into one recommendation.

Output strictly minified JSON (no markdown, no code blocks) with these keys:
{
  "documentType": "MEDICAL_RECORD|FINANCIAL|LEGAL|INSURANCE|OTHER",
  "patient": { "name": null, "dateOfBirth": null, "mrn": null },
  "visit": {
    "dateOfService": null,
    "facility": null,
    "summary": null,
    "provider": { "name": null, "specialty": null, "phone": null, "email": null, "fax": null, "address": null, "department": null },
    "followUp": null,
    "nextAppointment": null
  },
  "diagnoses": [],
  "medications": [],
  "allergies": [],
  "procedures": [],
  "recommendations": [],
  "warnings": []
}`;
  }

  async streamParseImageDocument(
    params: {
      imageUrl: string;
      docDomainType: string;
    },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'analyzing', detail: { model: MODEL } });

    // Download image and convert to base64
    const imageResponse = await fetch(params.imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Determine media type from URL or default to jpeg
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
    const urlLower = params.imageUrl.toLowerCase();
    if (urlLower.includes('.png')) mediaType = 'image/png';
    else if (urlLower.includes('.gif')) mediaType = 'image/gif';
    else if (urlLower.includes('.webp')) mediaType = 'image/webp';

    let fullText = '';

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: this.getExtractionInstructions(params.docDomainType),
            },
          ],
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          fullText += delta.text;
          onEvent({ type: 'delta', text: delta.text });
        }
      }
    }

    return this.parseAndValidate(fullText, onEvent);
  }

  async streamParsePdfText(
    params: { text: string; docDomainType: string },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'analyzing', detail: { model: MODEL } });

    const truncatedText = this.truncateText(params.text);
    const instruction = `${this.getExtractionInstructions(params.docDomainType)}

PDF text follows between <doc> tags. If fields are not present, set them to null or empty arrays.
<doc>
${truncatedText}
</doc>`;

    let fullText = '';

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: instruction,
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          fullText += delta.text;
          onEvent({ type: 'delta', text: delta.text });
        }
      }
    }

    return this.parseAndValidate(fullText, onEvent);
  }

  async streamParsePdfWithImages(
    params: { pdfImages: { data: string; mediaType: 'image/jpeg' | 'image/png' }[] ; docDomainType: string },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'analyzing_pages', detail: { model: MODEL, pageCount: params.pdfImages.length } });

    // Build content array with all PDF page images
    const content: Anthropic.Messages.ContentBlockParam[] = [];

    for (const pageImage of params.pdfImages) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: pageImage.mediaType,
          data: pageImage.data,
        },
      });
    }

    content.push({
      type: 'text',
      text: this.getExtractionInstructions(params.docDomainType),
    });

    let fullText = '';

    const stream = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content,
        },
      ],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta;
        if ('text' in delta) {
          fullText += delta.text;
          onEvent({ type: 'delta', text: delta.text });
        }
      }
    }

    return this.parseAndValidate(fullText, onEvent);
  }

  private truncateText(text: string, maxChars = 60000): string {
    if (text.length <= maxChars) return text;
    const head = text.slice(0, Math.floor(maxChars * 0.7));
    const tail = text.slice(-Math.floor(maxChars * 0.1));
    return `${head}\n...\n[truncated]\n...\n${tail}`;
  }

  private extractJson(text: string): unknown {
    // Remove markdown code blocks if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) {
      throw new Error('Model did not return JSON');
    }
    const candidate = cleaned.slice(first, last + 1);
    return JSON.parse(candidate);
  }

  private parseAndValidate(
    fullText: string,
    onEvent: (evt: StreamEvent) => void
  ): ParsedMedicalRecord {
    const json = this.extractJson(fullText);
    const validated = ParsedMedicalRecordSchema.safeParse(json);
    if (!validated.success) {
      onEvent({ type: 'status', status: 'validation_warning', detail: { errors: validated.error.errors } });
      onEvent({ type: 'result', parsed: json as any });
      return json as any;
    }
    onEvent({ type: 'result', parsed: validated.data });
    return validated.data;
  }
}

export const claudeDocumentService = new ClaudeDocumentService();
