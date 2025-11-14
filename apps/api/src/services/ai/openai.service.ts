import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { z } from 'zod';
import { config } from '../../config';

export const ParsedMedicalRecordSchema = z.object({
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
      summary: z.string().optional().nullable(), // NEW: 2-3 sentence summary for journal
      provider: z
        .object({
          name: z.string().optional().nullable(),
          specialty: z.string().optional().nullable(),
          phone: z.string().optional().nullable(),
          email: z.string().optional().nullable(), // NEW
          fax: z.string().optional().nullable(), // NEW
          address: z.string().optional().nullable(), // NEW: full address if available
          department: z.string().optional().nullable(), // NEW
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
        // Accept any string to avoid rejecting useful data like "not currently taking"
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
        text: z.string(), // The recommendation itself
        type: z.string().optional().nullable(), // NEW: medication|exercise|diet|therapy|lifestyle|monitoring|followup|tests
        priority: z.string().optional().nullable(), // NEW: urgent|high|medium|low
        frequency: z.string().optional().nullable(), // NEW: "daily", "3x per week", etc.
        duration: z.string().optional().nullable(), // NEW: "ongoing", "6 weeks", etc.
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

export class OpenAiService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: config.openaiApiKey });
    }
    return this.client;
  }

  async streamParseImageDocument(
    params: {
      imageUrl: string;
      docDomainType: string; // e.g., MEDICAL_RECORD, FINANCIAL, etc.
    },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'analyzing', detail: { model: 'gpt-5-mini' } });

    const system = `You are a careful medical information extractor. The input may be a scan, photo, printed report, clinician note, or AI-notetaker summary.
Extract as much clinically relevant information as is actually present. Populate the JSON schema fully where possible.
If a field is not present, set scalars to null and lists to []. Do not invent data. Use concise, normalized values when obvious (e.g., dates YYYY-MM-DD). Avoid any content beyond the requested fields.`;

    const instruction = `Read the document image and extract all relevant medical information available.
The content might be free-form notes, bullet points, or structured fields.
Domain type: ${params.docDomainType}.

IMPORTANT for recommendations: Extract EVERY recommendation as a SEPARATE array entry. Do NOT summarize or combine multiple recommendations into one. If the document contains 5 distinct recommendations, the array MUST have 5 entries.

For each recommendation entry:
- text: the complete recommendation text
- type: classify as medication, exercise, diet, therapy, lifestyle, monitoring, followup, or tests
- priority: classify as urgent, high, medium, or low if discernible
- frequency: e.g., "daily", "3x per week", "twice daily"
- duration: e.g., "ongoing", "6 weeks", "until next visit"

Example: If a document says "Start Metformin 500mg daily", "Increase exercise to 30min 3x/week", and "Follow up in 2 weeks", you MUST create 3 separate array entries - do NOT combine them into one recommendation.

Output strictly minified JSON (no markdown) with these keys:
{
  patient: { name?, dateOfBirth?, mrn? },
  visit: {
    dateOfService?,
    facility?,
    summary?,  // 2-3 sentence summary of this visit for journal entry
    provider: { name?, specialty?, phone?, email?, fax?, address?, department? }?,
    followUp?,
    nextAppointment?
  },
  diagnoses: Array<{ name: string, icd10? }>,
  medications: Array<{ name: string, dosage?, frequency?, route?, startDate?, endDate?, status?, notes? }>,
  allergies: Array<{ substance: string, reaction?, severity? }>,
  procedures: Array<{ name: string, date?, cpt? }>,
  recommendations: Array<{ text: string, type?, priority?, frequency?, duration? }>,
  warnings: string[]
}`;

    // Enable real streaming with event handler
    const runner = (client as any).responses
      .stream({
        model: 'gpt-5-mini',
        text: { format: { type: 'json_object' } },
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: system }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instruction },
              { type: 'input_image', source: { type: 'url', url: params.imageUrl } },
            ],
          },
        ],
      })
      .on('response.output_text.delta', (diff: any) => {
        // Send real-time deltas to client as they arrive
        if (diff.delta) {
          onEvent({ type: 'delta', text: diff.delta });
        }
      });

    // Collect full response for JSON parsing
    let full = '';
    for await (const event of runner) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        full += event.delta;
      }
    }

    // Try to extract JSON object from streamed text
    const json = this.extractJson(full);
    const validated = ParsedMedicalRecordSchema.safeParse(json);
    if (!validated.success) {
      // Soft-fail: commit streamed JSON as-is
      onEvent({ type: 'status', status: 'validation_warning', detail: { errors: validated.error.errors } });
      onEvent({ type: 'result', parsed: json as any });
      return json as any;
    }
    onEvent({ type: 'result', parsed: validated.data });
    return validated.data;
  }

  async streamParsePdfText(
    params: { text: string; docDomainType: string },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'analyzing', detail: { model: 'gpt-5-mini' } });

    const system = `You are a careful medical information extractor. The user provides text that may be clinical notes, summaries, transcripts, or AI-notetaker output.
Extract as much clinically relevant information as is truly present. Populate the JSON schema where possible; otherwise use null/[] accordingly. Do not fabricate.`;

    const instruction = `Read the following text and extract all relevant medical information available.
The content may be bullet points, narrative, or structured lists.
Domain type: ${params.docDomainType}.

IMPORTANT for recommendations: Extract EVERY recommendation as a SEPARATE array entry. Do NOT summarize or combine multiple recommendations into one. If the document contains 5 distinct recommendations, the array MUST have 5 entries.

For each recommendation entry:
- text: the complete recommendation text
- type: classify as medication, exercise, diet, therapy, lifestyle, monitoring, followup, or tests
- priority: classify as urgent, high, medium, or low if discernible
- frequency: e.g., "daily", "3x per week", "twice daily"
- duration: e.g., "ongoing", "6 weeks", "until next visit"

Example: If a document says "Start Metformin 500mg daily", "Increase exercise to 30min 3x/week", and "Follow up in 2 weeks", you MUST create 3 separate array entries - do NOT combine them into one recommendation.

Output strictly minified JSON (no markdown) with these keys:
{
  patient: { name?, dateOfBirth?, mrn? },
  visit: {
    dateOfService?,
    facility?,
    summary?,  // 2-3 sentence summary of this visit for journal entry
    provider: { name?, specialty?, phone?, email?, fax?, address?, department? }?,
    followUp?,
    nextAppointment?
  },
  diagnoses: Array<{ name: string, icd10? }>,
  medications: Array<{ name: string, dosage?, frequency?, route?, startDate?, endDate?, status?, notes? }>,
  allergies: Array<{ substance: string, reaction?, severity? }>,
  procedures: Array<{ name: string, date?, cpt? }>,
  recommendations: Array<{ text: string, type?, priority?, frequency?, duration? }>,
  warnings: string[]
}

PDF text follows between <doc> tags. If fields are not present, set them to null or empty arrays.
<doc>
${this.truncateText(params.text)}
</doc>`;

    // Enable real streaming with event handler
    const runner = (client as any).responses
      .stream({
        model: 'gpt-5-mini',
        text: { format: { type: 'json_object' } },
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: system }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: instruction }],
          },
        ],
      })
      .on('response.output_text.delta', (diff: any) => {
        // Send real-time deltas to client as they arrive
        if (diff.delta) {
          onEvent({ type: 'delta', text: diff.delta });
        }
      });

    // Collect full response for JSON parsing
    let full = '';
    for await (const event of runner) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        full += event.delta;
      }
    }

    const json = this.extractJson(full);
    const validated = ParsedMedicalRecordSchema.safeParse(json);
    if (!validated.success) {
      onEvent({ type: 'status', status: 'validation_warning', detail: { errors: validated.error.errors } });
      onEvent({ type: 'result', parsed: json as any });
      return json as any;
    }
    onEvent({ type: 'result', parsed: validated.data });
    return validated.data;
  }

  private truncateText(text: string, maxChars = 60000): string {
    if (text.length <= maxChars) return text;
    // Keep head and tail if too large
    const head = text.slice(0, Math.floor(maxChars * 0.7));
    const tail = text.slice(-Math.floor(maxChars * 0.1));
    return `${head}\n...\n[truncated]\n...\n${tail}`;
  }

  private extractJson(text: string): unknown {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last < first) {
      throw new Error('Model did not return JSON');
    }
    const candidate = text.slice(first, last + 1);
    return JSON.parse(candidate);
  }

  async streamParsePdfFileUpload(
    params: { buffer: Buffer; docDomainType: string },
    onEvent: (evt: StreamEvent) => void
  ): Promise<ParsedMedicalRecord> {
    const client = this.getClient();

    onEvent({ type: 'status', status: 'uploading_file' });
    const file = await toFile(params.buffer, 'document.pdf', { type: 'application/pdf' });
    const uploaded = await client.files.create({ file, purpose: 'assistants' });

    onEvent({ type: 'status', status: 'analyzing_file', detail: { model: 'gpt-5-mini' } });

    const system = `You are a careful medical information extractor. The attached PDF may be clinical notes, summaries, reports, or AI-notetaker output.
Extract as much clinically relevant information as is present. Populate the JSON schema fully where possible; otherwise use null/[] accordingly. Do not fabricate.`;
    const instruction = `Read the attached PDF and extract all relevant medical information available.
Handle bullet lists, narrative text, and tables.
Domain type: ${params.docDomainType}.

IMPORTANT for recommendations: Extract EVERY recommendation as a SEPARATE array entry. Do NOT summarize or combine multiple recommendations into one. If the document contains 5 distinct recommendations, the array MUST have 5 entries.

For each recommendation entry:
- text: the complete recommendation text
- type: classify as medication, exercise, diet, therapy, lifestyle, monitoring, followup, or tests
- priority: classify as urgent, high, medium, or low if discernible
- frequency: e.g., "daily", "3x per week", "twice daily"
- duration: e.g., "ongoing", "6 weeks", "until next visit"

Example: If a document says "Start Metformin 500mg daily", "Increase exercise to 30min 3x/week", and "Follow up in 2 weeks", you MUST create 3 separate array entries - do NOT combine them into one recommendation.

Return minified JSON with complete schema:
{
  patient: { name?, dateOfBirth?, mrn? },
  visit: { dateOfService?, facility?, summary?, provider: { name?, specialty?, phone?, email?, fax?, address?, department? }?, followUp?, nextAppointment? },
  diagnoses: Array<{ name: string, icd10? }>,
  medications: Array<{ name: string, dosage?, frequency?, route?, startDate?, endDate?, status?, notes? }>,
  allergies: Array<{ substance: string, reaction?, severity? }>,
  procedures: Array<{ name: string, date?, cpt? }>,
  recommendations: Array<{ text: string, type?, priority?, frequency?, duration? }>,
  warnings: string[]
}`;

    // Enable real streaming with event handler
    const runner = (client as any).responses
      .stream({
        model: 'gpt-5-mini',
        text: { format: { type: 'json_object' } },
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: system }],
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: instruction },
              { type: 'input_file', file_id: uploaded.id },
            ],
          },
        ],
      })
      .on('response.output_text.delta', (diff: any) => {
        // Send real-time deltas to client as they arrive
        if (diff.delta) {
          onEvent({ type: 'delta', text: diff.delta });
        }
      });

    // Collect full response for JSON parsing
    let full = '';
    for await (const event of runner) {
      if (event.type === 'response.output_text.delta' && event.delta) {
        full += event.delta;
      }
    }

    const json = this.extractJson(full);
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

export const openAiService = new OpenAiService();
