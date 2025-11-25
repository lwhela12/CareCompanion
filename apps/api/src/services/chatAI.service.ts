import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@carecompanion/database';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { mealAnalysisService } from './ai/mealAnalysis.service';
import {
  chatTools,
  CreateJournalInput,
  UpdateJournalEntryInput,
  DeleteJournalEntryInput,
  LogMealInput,
  UpdateMealInput,
  DeleteMealInput,
  CreateMedicationInput,
  CreateCareTaskInput,
  CompleteCareTaskInput,
  UpdateCareTaskInput,
  DeleteCareTaskInput,
  UpdateMedicationInput,
  LogMedicationDoseInput,
  RefillMedicationInput,
  DeleteMedicationInput,
  AddFamilyMemberInput,
  AcknowledgeRecommendationInput,
  AcceptRecommendationInput,
  DismissRecommendationInput,
  ListRecommendationsInput,
  GetRecommendationDetailsInput,
  CreateRecommendationInput,
  CompleteRecommendationInput,
  ConfirmFactInput,
  RejectFactInput,
  PinFactInput,
  CreateProviderInput,
  UpdateProviderInput,
  DeleteProviderInput,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
  DeleteChecklistItemInput,
  LogChecklistCompletionInput,
  SearchDocumentsInput,
  GetDocumentDetailsInput,
  TriggerDocumentParseInput,
  combineDateAndTime,
  recurrenceToRRule,
} from './ai/tools';

// Context for chat session
export interface ChatContext {
  familyId: string;
  userId: string;
  patientId: string;
  patientName: string;
  userName: string;
  timezone?: string;
}

// Attachment for chat messages
export interface ChatAttachment {
  type: 'image' | 'document';
  url: string;
  mimeType: string;
  name: string;
}

class ChatAIService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      if (!config.anthropicApiKey) {
        throw new Error('Anthropic API key not configured');
      }
      this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    return this.client;
  }

  /**
   * Process a chat message with tool support and optional attachments
   */
  async *chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: ChatContext,
    enhancedContext: string,
    attachments?: ChatAttachment[]
  ): AsyncGenerator<{
    type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
    content?: string;
    toolName?: string;
    toolInput?: any;
    toolResult?: any;
  }> {
    const client = this.getClient();
    const userTimezone = context.timezone || 'America/New_York';

    // Format current date/time in user's timezone
    const now = new Date();
    const userDateTime = now.toLocaleString('en-US', {
      timeZone: userTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const today = now.toLocaleDateString('en-CA', { timeZone: userTimezone }); // YYYY-MM-DD format
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrow = tomorrowDate.toLocaleDateString('en-CA', { timeZone: userTimezone });

    // System prompt for CeeCee as the care assistant
    const systemPrompt = `You are CeeCee, a helpful and warm AI care assistant for ${context.patientName}'s care team. You're talking with ${context.userName}.

The current date and time for the user is ${userDateTime}. Today is ${today}. Tomorrow is ${tomorrow}.

YOUR ROLE:
- Help caregivers find information about ${context.patientName}'s care
- Add new medications, journal entries, and tasks when the user shares information
- Provide helpful guidance based on the care data
- Be empathetic but efficient

WHEN TO USE TOOLS:
- When the user shares information about a doctor visit, create a journal entry to document it
- When they want to edit or correct a journal entry, use update_journal_entry
- When they want to delete a journal entry, use delete_journal_entry
- When they mention what the patient ate (e.g., "mom had oatmeal"), use log_meal to track nutrition
- When they want to correct a meal entry, use update_meal
- When they want to delete a meal entry, use delete_meal
- When they mention a NEW prescription or medication, use create_medication
- When they mention something they need to do (like "pick up prescription"), use create_care_task
- When they mention an appointment at a specific time, use create_care_task with BOTH dueDate AND scheduledTime
- When updating an existing medication (dose, schedule, instructions), use update_medication
- When they say they gave a medication or it was missed/refused, use log_medication_dose
- When they picked up a prescription or refilled medication, use refill_medication
- When they want to stop tracking a medication, use delete_medication
- When they say they completed a task, use complete_care_task
- When they want to reschedule, reassign, or modify a task, use update_care_task
- When they want to cancel or remove a task, use delete_care_task
- When they want to add someone to the care team, use add_family_member
- When they say they've reviewed/seen a recommendation, use acknowledge_recommendation
- When they want to follow/accept a recommendation, use accept_recommendation
- When they want to dismiss/skip/ignore a recommendation, use dismiss_recommendation (ask for reason)
- When they confirm an AI-extracted fact is correct, use confirm_fact
- When they say an AI-extracted fact is wrong, use reject_fact
- When they want to highlight/pin an important fact, use pin_fact
- When they mention a new doctor, specialist, or healthcare provider, use create_provider
- When they want to update a provider's contact info, specialty, or details, use update_provider
- When they say they're no longer seeing a provider, use delete_provider
- When they mention a daily routine activity (bathing, exercise, etc), use create_checklist_item
- When they want to change checklist item details or schedule, use update_checklist_item
- When they want to stop tracking a checklist item, use delete_checklist_item
- When they say they completed a checklist item (e.g., "gave mom a bath", "finished morning exercises"), use log_checklist_completion
- When they ask about documents, records, or uploaded files, use search_documents
- When they want details about a specific document, use get_document_details
- When they want to process/parse a pending document, use trigger_document_parse

IMPORTANT - TASKS VS APPOINTMENTS:
- Use taskType: "task" for to-do items (picking up prescriptions, errands, chores)
- Use taskType: "appointment" for fixed-time commitments (doctor visits, therapy sessions, scheduled visits)
- ALWAYS include scheduledTime when the user mentions a specific time (e.g., "at noon" = "12:00", "at 2pm" = "14:00")
- For appointments, set dueDate, scheduledTime, AND taskType: "appointment"
- Example: "doctor appointment tomorrow at noon" → dueDate: "${tomorrow}", scheduledTime: "12:00", taskType: "appointment"
- Example: "pick up prescription tomorrow" → dueDate: "${tomorrow}", taskType: "task"

IMPORTANT GUIDELINES:
- After using a tool, confirm what you did in a friendly way
- If creating multiple items, you can use multiple tools in one response
- Be concise - caregivers are busy
- For medical questions, recommend consulting healthcare providers
- Reference specific data using [journal:ID], [medication:ID], or [task:ID] when helpful

CRITICAL - LISTING AND SEARCH TOOLS:
- After calling list_recommendations, search_documents, or other list/search tools, ALWAYS summarize the results for the user
- Don't just call the tool and stop - the user needs to see what was found
- Format arrays of items as bullet points or numbered lists with key details
- Include relevant details like status, priority, dates, and descriptions
- If no results are found, acknowledge that clearly and offer to help in other ways

CONTEXT ABOUT ${context.patientName.toUpperCase()}'S CARE:
${enhancedContext}`;

    // Build messages for Claude with optional image attachments
    const claudeMessages: Anthropic.MessageParam[] = await Promise.all(
      messages.map(async (m, index) => {
        // Only the last user message can have attachments
        const isLastUserMessage = index === messages.length - 1 && m.role === 'user';

        if (isLastUserMessage && attachments && attachments.length > 0) {
          // Build multimodal content with images
          const contentParts: Anthropic.Messages.ContentBlockParam[] = [];

          // Process attachments (images and documents)
          for (const att of attachments) {
            if (att.type === 'image' && att.mimeType.startsWith('image/')) {
              try {
                // Download image and convert to base64
                const response = await fetch(att.url);
                if (response.ok) {
                  const buffer = await response.arrayBuffer();
                  const base64 = Buffer.from(buffer).toString('base64');
                  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
                  if (att.mimeType === 'image/png') mediaType = 'image/png';
                  else if (att.mimeType === 'image/gif') mediaType = 'image/gif';
                  else if (att.mimeType === 'image/webp') mediaType = 'image/webp';

                  contentParts.push({
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mediaType,
                      data: base64,
                    },
                  });
                }
              } catch (err) {
                logger.error('Failed to fetch image attachment', { url: att.url, error: err });
              }
            } else if (att.type === 'document') {
              // Handle text documents by extracting and including content
              try {
                const response = await fetch(att.url);
                if (response.ok) {
                  if (att.mimeType === 'text/plain' || att.mimeType === 'text/markdown') {
                    // Plain text or markdown - read directly
                    const textContent = await response.text();
                    const truncatedContent = textContent.length > 50000
                      ? textContent.substring(0, 50000) + '\n\n[...content truncated...]'
                      : textContent;
                    contentParts.push({
                      type: 'text',
                      text: `[Document: ${att.name}]\n\n${truncatedContent}`,
                    });
                  } else if (att.mimeType === 'application/pdf') {
                    // PDF - extract text using pdf-parse
                    try {
                      const buffer = Buffer.from(await response.arrayBuffer());
                      const pdfParse = require('pdf-parse');
                      const pdfData = await pdfParse(buffer);
                      const textContent = (pdfData.text || '').trim();
                      if (textContent.length > 0) {
                        const truncatedContent = textContent.length > 50000
                          ? textContent.substring(0, 50000) + '\n\n[...content truncated...]'
                          : textContent;
                        contentParts.push({
                          type: 'text',
                          text: `[PDF Document: ${att.name}]\n\n${truncatedContent}`,
                        });
                      } else {
                        contentParts.push({
                          type: 'text',
                          text: `[PDF Document: ${att.name}] (No extractable text - may be a scanned document)`,
                        });
                      }
                    } catch (pdfErr) {
                      logger.error('Failed to parse PDF attachment', { url: att.url, error: pdfErr });
                      contentParts.push({
                        type: 'text',
                        text: `[PDF Document: ${att.name}] (Could not extract text)`,
                      });
                    }
                  } else {
                    // Unknown document type - just reference it
                    contentParts.push({
                      type: 'text',
                      text: `[Attached document: ${att.name}]`,
                    });
                  }
                }
              } catch (err) {
                logger.error('Failed to fetch document attachment', { url: att.url, error: err });
                contentParts.push({
                  type: 'text',
                  text: `[Attached document: ${att.name}] (Could not load)`,
                });
              }
            }
          }

          // Add the user's text message
          contentParts.push({ type: 'text', text: m.content });

          return {
            role: m.role as 'user' | 'assistant',
            content: contentParts,
          };
        }

        // Regular text message
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      })
    );

    try {
      let continueLoop = true;
      const MAX_LOOPS = 5;
      let loopCount = 0;

      while (continueLoop && loopCount < MAX_LOOPS) {
        loopCount++;
        continueLoop = false;

        logger.info('Starting chat API call', { messageCount: claudeMessages.length, loop: loopCount });

        const stream = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          tools: chatTools,
          messages: claudeMessages,
          stream: true,
        });

        let currentText = '';
        let currentToolUse: { id: string; name: string; input: string } | null = null;
        // Store tool uses with their results to avoid double execution
        const toolUses: { id: string; name: string; input: any; result: { success: boolean; message: string; id?: string } }[] = [];

        for await (const event of stream) {
          // Log all stream events for debugging
          logger.debug('Claude stream event', { type: event.type, details: JSON.stringify(event).substring(0, 200) });

          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'text') {
              currentText = '';
              logger.debug('Text block started');
            } else if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              };
              logger.info('Tool use block started', { toolName: event.content_block.name, toolId: event.content_block.id });
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentText += event.delta.text;
              // Stream all text responses, including confirmations after tool execution
              yield { type: 'text', content: event.delta.text };
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              try {
                // Handle empty input gracefully (default to empty object)
                const input = currentToolUse.input.trim()
                  ? JSON.parse(currentToolUse.input)
                  : {};

                logger.info('Tool called', { toolName: currentToolUse.name, input });
                yield { type: 'tool_use', toolName: currentToolUse.name, toolInput: input };

                // Execute the tool ONCE and store the result
                const result = await this.executeTool(currentToolUse.name, input, context);
                toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input, result });

                logger.info('Tool executed', { toolName: currentToolUse.name, result });
                yield { type: 'tool_result', toolName: currentToolUse.name, toolResult: result };
              } catch (parseError) {
                logger.error('Failed to parse tool input', { error: parseError, input: currentToolUse.input });
              }
              currentToolUse = null;
            }
          }
        }

        // Log stream completion
        logger.info('Claude stream complete', {
          loopCount,
          textGenerated: currentText.length > 0,
          textLength: currentText.length,
          toolsUsed: toolUses.length,
          textPreview: currentText.substring(0, 100),
        });

        // If tools were called, continue conversation with results
        if (toolUses.length > 0) {
          logger.info('Tools were called, continuing conversation', {
            toolCount: toolUses.length,
            toolNames: toolUses.map(t => t.name),
            toolResults: toolUses.map(t => ({ name: t.name, success: t.result.success, message: t.result.message })),
          });

          // Add assistant message with tool_use blocks
          const assistantContent: (Anthropic.TextBlock | Anthropic.ToolUseBlock)[] = [];
          if (currentText) {
            assistantContent.push({ type: 'text', text: currentText } as Anthropic.TextBlock);
          }
          for (const tool of toolUses) {
            assistantContent.push({
              type: 'tool_use',
              id: tool.id,
              name: tool.name,
              input: tool.input,
            } as Anthropic.ToolUseBlock);
          }
          claudeMessages.push({ role: 'assistant', content: assistantContent as Anthropic.ContentBlock[] });

          // Add tool results - reuse stored results, don't re-execute!
          const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((tool) => ({
            type: 'tool_result' as const,
            tool_use_id: tool.id,
            content: JSON.stringify(tool.result),
          }));
          claudeMessages.push({ role: 'user', content: toolResults });

          continueLoop = true;
        }
      }

      yield { type: 'done' };

    } catch (error: any) {
      logger.error('Chat AI error', { error: error.message, stack: error.stack });
      yield { type: 'error', content: error.message || 'Chat failed' };
    }
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(
    toolName: string,
    input: any,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    try {
      switch (toolName) {
        case 'create_journal_entry':
          return await this.createJournalEntry(input, context);
        case 'update_journal_entry':
          return await this.updateJournalEntry(input, context);
        case 'delete_journal_entry':
          return await this.deleteJournalEntry(input, context);
        case 'log_meal':
          return await this.logMeal(input, context);
        case 'update_meal':
          return await this.updateMeal(input, context);
        case 'delete_meal':
          return await this.deleteMeal(input, context);
        case 'create_medication':
          return await this.createMedication(input, context);
        case 'create_care_task':
          return await this.createCareTask(input, context);
        case 'complete_care_task':
          return await this.completeCareTask(input, context);
        case 'update_care_task':
          return await this.updateCareTask(input, context);
        case 'delete_care_task':
          return await this.deleteCareTask(input, context);
        case 'update_medication':
          return await this.updateMedication(input, context);
        case 'log_medication_dose':
          return await this.logMedicationDose(input, context);
        case 'refill_medication':
          return await this.refillMedication(input, context);
        case 'delete_medication':
          return await this.deleteMedication(input, context);
        case 'add_family_member':
          return await this.addFamilyMember(input, context);
        case 'list_recommendations':
          return await this.listRecommendations(input, context);
        case 'get_recommendation_details':
          return await this.getRecommendationDetails(input, context);
        case 'create_recommendation':
          return await this.createRecommendation(input, context);
        case 'acknowledge_recommendation':
          return await this.acknowledgeRecommendation(input, context);
        case 'accept_recommendation':
          return await this.acceptRecommendation(input, context);
        case 'dismiss_recommendation':
          return await this.dismissRecommendation(input, context);
        case 'complete_recommendation':
          return await this.completeRecommendation(input, context);
        case 'confirm_fact':
          return await this.confirmFact(input, context);
        case 'reject_fact':
          return await this.rejectFact(input, context);
        case 'pin_fact':
          return await this.pinFact(input, context);
        case 'create_provider':
          return await this.createProvider(input, context);
        case 'update_provider':
          return await this.updateProvider(input, context);
        case 'delete_provider':
          return await this.deleteProvider(input, context);
        case 'create_checklist_item':
          return await this.createChecklistItem(input, context);
        case 'update_checklist_item':
          return await this.updateChecklistItem(input, context);
        case 'delete_checklist_item':
          return await this.deleteChecklistItem(input, context);
        case 'log_checklist_completion':
          return await this.logChecklistCompletion(input, context);
        case 'search_documents':
          return await this.searchDocuments(input, context);
        case 'get_document_details':
          return await this.getDocumentDetails(input, context);
        case 'trigger_document_parse':
          return await this.triggerDocumentParse(input, context);
        default:
          return { success: false, message: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      logger.error('Tool execution failed', { toolName, error: error.message });
      return { success: false, message: error.message || 'Tool execution failed' };
    }
  }

  private async createJournalEntry(
    input: CreateJournalInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    const entry = await prisma.journalEntry.create({
      data: {
        familyId: context.familyId,
        userId: context.userId,
        content: input.content,
        sentiment: input.sentiment || 'neutral',
        isPrivate: false,
        attachmentUrls: [],
        autoGenerated: true,
      },
    });

    return {
      success: true,
      message: `Created journal entry`,
      id: entry.id,
    };
  }

  private async updateJournalEntry(
    input: UpdateJournalEntryInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const entry = await prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        familyId: context.familyId,
      },
    });

    if (!entry) {
      return { success: false, message: 'Journal entry not found' };
    }

    const updateData: any = {};
    const changes: string[] = [];

    if (input.content) {
      updateData.content = input.content;
      changes.push('content');
    }
    if (input.sentiment) {
      updateData.sentiment = input.sentiment;
      changes.push(`sentiment to ${input.sentiment}`);
    }
    if (input.isPrivate !== undefined) {
      updateData.isPrivate = input.isPrivate;
      changes.push(input.isPrivate ? 'marked private' : 'marked visible');
    }

    await prisma.journalEntry.update({
      where: { id: input.entryId },
      data: updateData,
    });

    return {
      success: true,
      message: `Updated journal entry: ${changes.join(', ')}`,
    };
  }

  private async deleteJournalEntry(
    input: DeleteJournalEntryInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const entry = await prisma.journalEntry.findFirst({
      where: {
        id: input.entryId,
        familyId: context.familyId,
      },
    });

    if (!entry) {
      return { success: false, message: 'Journal entry not found' };
    }

    await prisma.journalEntry.delete({
      where: { id: input.entryId },
    });

    return {
      success: true,
      message: 'Deleted journal entry',
    };
  }

  private async logMeal(
    input: LogMealInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    const consumedAt = input.consumedAt ? new Date(input.consumedAt) : new Date();

    // Analyze the meal description with AI to get nutrition estimates
    let nutritionData: Record<string, any> | null = null;
    let meetsGuidelines: boolean | null = null;
    let concerns: string[] = [];

    if (input.notes) {
      try {
        const analysis = await mealAnalysisService.analyzeMealFromDescription({
          description: input.notes,
          mealType: input.mealType,
        });
        nutritionData = analysis.nutritionData;
        meetsGuidelines = analysis.meetsGuidelines ?? null;
        concerns = analysis.concerns;
        logger.info('Meal nutrition analysis completed', {
          calories: analysis.nutritionData.estimatedCalories,
          protein: analysis.nutritionData.proteinGrams,
          confidence: analysis.confidence,
        });
      } catch (error) {
        logger.error('Failed to analyze meal nutrition', { error });
        // Continue without nutrition data - don't block the meal log
      }
    }

    const meal = await prisma.mealLog.create({
      data: {
        patientId: context.patientId,
        userId: context.userId,
        mealType: input.mealType,
        consumedAt,
        notes: input.notes,
        nutritionData: nutritionData ?? undefined,
        meetsGuidelines,
        concerns,
        photoUrls: [],
      },
    });

    // Build nutrition summary for response
    const nutritionSummary = nutritionData?.estimatedCalories
      ? ` (~${nutritionData.estimatedCalories} cal, ${nutritionData.proteinGrams || 0}g protein)`
      : '';

    // Log to journal with nutrition info
    await this.logActivityToJournal(
      `Logged ${input.mealType.toLowerCase()}: ${input.notes || 'no details'}${nutritionSummary}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Logged ${input.mealType.toLowerCase()}${input.notes ? `: ${input.notes}` : ''}${nutritionSummary}`,
      id: meal.id,
    };
  }

  private async updateMeal(
    input: UpdateMealInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const meal = await prisma.mealLog.findFirst({
      where: {
        id: input.mealLogId,
        patient: { familyId: context.familyId },
      },
    });

    if (!meal) {
      return { success: false, message: 'Meal log not found' };
    }

    const updateData: any = {};
    if (input.mealType) updateData.mealType = input.mealType;
    if (input.notes !== undefined) updateData.notes = input.notes;

    await prisma.mealLog.update({
      where: { id: input.mealLogId },
      data: updateData,
    });

    return {
      success: true,
      message: `Updated meal log`,
    };
  }

  private async deleteMeal(
    input: DeleteMealInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const meal = await prisma.mealLog.findFirst({
      where: {
        id: input.mealLogId,
        patient: { familyId: context.familyId },
      },
    });

    if (!meal) {
      return { success: false, message: 'Meal log not found' };
    }

    await prisma.mealLog.delete({
      where: { id: input.mealLogId },
    });

    return {
      success: true,
      message: 'Deleted meal log',
    };
  }

  /**
   * Helper to log CeeCee's actions to the journal for audit trail
   */
  private async logActivityToJournal(
    content: string,
    context: ChatContext,
    sentiment: 'positive' | 'neutral' | 'concerned' | 'urgent' = 'neutral'
  ): Promise<void> {
    try {
      await prisma.journalEntry.create({
        data: {
          familyId: context.familyId,
          userId: context.userId,
          content,
          sentiment,
          isPrivate: false,
          attachmentUrls: [],
          autoGenerated: true,
        },
      });
    } catch (error) {
      // Don't fail the main action if journal logging fails
      logger.error('Failed to log activity to journal', { content, error });
    }
  }

  private async createMedication(
    input: CreateMedicationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    // Check for existing medication with same name
    const existing = await prisma.medication.findFirst({
      where: {
        patientId: context.patientId,
        name: { equals: input.name, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (existing) {
      return {
        success: false,
        message: `Medication "${input.name}" already exists. Use update_medication to modify it.`,
        id: existing.id,
      };
    }

    const medication = await prisma.medication.create({
      data: {
        patientId: context.patientId,
        name: input.name,
        dosage: input.dosage,
        frequency: input.frequency,
        scheduleTime: input.scheduleTimes,
        instructions: input.instructions,
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        isActive: true,
        createdById: context.userId,
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Added medication: ${input.name} (${input.dosage}, ${input.frequency})`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Added medication: ${input.name} ${input.dosage}`,
      id: medication.id,
    };
  }

  private async createCareTask(
    input: CreateCareTaskInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    // Convert recurrence type to RRULE
    const recurrenceRule = recurrenceToRRule(input.recurrenceType);

    // Calculate the due date with optional time
    let dueDate: Date;
    const today = new Date().toISOString().split('T')[0];
    const dateStr = input.dueDate || today;

    if (input.scheduledTime) {
      // Combine date and time
      dueDate = combineDateAndTime(dateStr, input.scheduledTime);
      logger.info('Creating task with scheduled time', {
        dateStr,
        scheduledTime: input.scheduledTime,
        combinedDate: dueDate.toISOString(),
      });
    } else {
      // Use combineDateAndTime even without time to avoid UTC timezone issues
      dueDate = combineDateAndTime(dateStr);
    }

    const task = await prisma.careTask.create({
      data: {
        familyId: context.familyId,
        title: input.title,
        description: input.description,
        priority: input.priority === 'high' ? 'HIGH' : input.priority === 'low' ? 'LOW' : 'MEDIUM',
        status: 'PENDING',
        taskType: input.taskType === 'appointment' ? 'APPOINTMENT' : 'TASK',
        dueDate,
        recurrenceRule,
        isRecurrenceTemplate: !!recurrenceRule,
        createdById: context.userId,
      },
    });

    // Format time for response if provided
    const timeInfo = input.scheduledTime
      ? ` at ${input.scheduledTime}`
      : '';
    const dateInfo = input.dueDate
      ? ` for ${input.dueDate}`
      : ' for today';

    // Log to journal
    await this.logActivityToJournal(
      `Scheduled: ${input.title}${dateInfo}${timeInfo}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Created task: ${input.title}${dateInfo}${timeInfo}`,
      id: task.id,
    };
  }

  private async completeCareTask(
    input: CompleteCareTaskInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const task = await prisma.careTask.findFirst({
      where: {
        id: input.taskId,
        familyId: context.familyId,
      },
    });

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    await prisma.careTask.update({
      where: { id: input.taskId },
      data: {
        status: 'COMPLETED',
      },
    });

    // Log the completion to CareTaskLog
    await prisma.careTaskLog.create({
      data: {
        taskId: input.taskId,
        userId: context.userId,
        action: 'completed',
        notes: input.notes,
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Completed: ${task.title}`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Marked "${task.title}" as completed`,
    };
  }

  private async updateCareTask(
    input: UpdateCareTaskInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const task = await prisma.careTask.findFirst({
      where: {
        id: input.taskId,
        familyId: context.familyId,
      },
    });

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    const updateData: any = {};
    const changes: string[] = [];

    if (input.title) {
      updateData.title = input.title;
      changes.push(`title to "${input.title}"`);
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
      changes.push('description');
    }
    if (input.dueDate) {
      // Combine with time if provided
      if (input.scheduledTime) {
        updateData.dueDate = combineDateAndTime(input.dueDate, input.scheduledTime);
      } else {
        updateData.dueDate = combineDateAndTime(input.dueDate);
      }
      changes.push(`date to ${input.dueDate}${input.scheduledTime ? ` at ${input.scheduledTime}` : ''}`);
    } else if (input.scheduledTime && task.dueDate) {
      // Update just the time, keeping the same date
      const existingDate = task.dueDate.toISOString().split('T')[0];
      updateData.dueDate = combineDateAndTime(existingDate, input.scheduledTime);
      changes.push(`time to ${input.scheduledTime}`);
    }
    if (input.assignedToId !== undefined) {
      updateData.assignedToId = input.assignedToId;
      changes.push(input.assignedToId ? 'assigned to family member' : 'unassigned');
    }
    if (input.priority) {
      updateData.priority = input.priority.toUpperCase();
      changes.push(`priority to ${input.priority}`);
    }
    if (input.status) {
      updateData.status = input.status.toUpperCase();
      changes.push(`status to ${input.status}`);
    }

    await prisma.careTask.update({
      where: { id: input.taskId },
      data: updateData,
    });

    const changesSummary = changes.length > 0 ? changes.join(', ') : 'no changes';

    // Log to journal
    await this.logActivityToJournal(
      `Updated task "${task.title}": ${changesSummary}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Updated "${task.title}": ${changesSummary}`,
    };
  }

  private async deleteCareTask(
    input: DeleteCareTaskInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const task = await prisma.careTask.findFirst({
      where: {
        id: input.taskId,
        familyId: context.familyId,
      },
    });

    if (!task) {
      return { success: false, message: 'Task not found' };
    }

    // Set status to CANCELLED rather than hard delete
    await prisma.careTask.update({
      where: { id: input.taskId },
      data: { status: 'CANCELLED' },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Cancelled task: ${task.title}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Cancelled "${task.title}"`,
    };
  }

  private async updateMedication(
    input: UpdateMedicationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const medication = await prisma.medication.findFirst({
      where: {
        id: input.medicationId,
        patient: { familyId: context.familyId },
      },
    });

    if (!medication) {
      return { success: false, message: 'Medication not found' };
    }

    const updateData: any = {};
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.dosage) updateData.dosage = input.dosage;
    if (input.frequency) updateData.frequency = input.frequency;
    if (input.scheduleTimes) updateData.scheduleTime = input.scheduleTimes;
    if (input.instructions) updateData.instructions = input.instructions;

    await prisma.medication.update({
      where: { id: input.medicationId },
      data: updateData,
    });

    const action = input.isActive === false ? 'Stopped' : 'Updated';

    // Log to journal
    await this.logActivityToJournal(
      `${action} medication: ${medication.name}`,
      context,
      input.isActive === false ? 'neutral' : 'neutral'
    );

    return {
      success: true,
      message: `${action} medication: ${medication.name}`,
    };
  }

  private async logMedicationDose(
    input: LogMedicationDoseInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const medication = await prisma.medication.findFirst({
      where: {
        id: input.medicationId,
        patient: { familyId: context.familyId },
      },
    });

    if (!medication) {
      return { success: false, message: 'Medication not found' };
    }

    // Parse the scheduled time - could be just "HH:MM" for today or a full ISO datetime
    let scheduledTime: Date;
    if (input.scheduledTime.includes('T')) {
      scheduledTime = new Date(input.scheduledTime);
    } else {
      // Just time provided - use today's date
      const today = new Date().toISOString().split('T')[0];
      scheduledTime = combineDateAndTime(today, input.scheduledTime);
    }

    // Create medication log entry
    await prisma.medicationLog.create({
      data: {
        medicationId: input.medicationId,
        scheduledTime,
        givenTime: input.status === 'given' ? new Date() : null,
        status: input.status.toUpperCase() as 'GIVEN' | 'MISSED' | 'REFUSED',
        notes: input.notes,
        givenById: input.status === 'given' ? context.userId : null,
      },
    });

    const statusMessage = {
      given: 'marked as given',
      missed: 'marked as missed',
      refused: 'marked as refused by patient',
    };

    // Log to journal
    await this.logActivityToJournal(
      `${medication.name} ${statusMessage[input.status]}${input.notes ? ` - ${input.notes}` : ''}`,
      context,
      input.status === 'given' ? 'positive' : 'concerned'
    );

    return {
      success: true,
      message: `${medication.name} ${statusMessage[input.status]}`,
    };
  }

  private async refillMedication(
    input: RefillMedicationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const medication = await prisma.medication.findFirst({
      where: {
        id: input.medicationId,
        patient: { familyId: context.familyId },
      },
    });

    if (!medication) {
      return { success: false, message: 'Medication not found' };
    }

    const refillDate = input.refillDate ? new Date(input.refillDate) : new Date();

    // Update current supply and last refill date on the medication
    await prisma.medication.update({
      where: { id: input.medicationId },
      data: {
        currentSupply: (medication.currentSupply || 0) + input.pillsAdded,
        lastRefillDate: refillDate,
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Refilled ${medication.name}: added ${input.pillsAdded} pills`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Refilled ${medication.name} with ${input.pillsAdded} pills`,
    };
  }

  private async deleteMedication(
    input: DeleteMedicationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const medication = await prisma.medication.findFirst({
      where: {
        id: input.medicationId,
        patient: { familyId: context.familyId },
      },
    });

    if (!medication) {
      return { success: false, message: 'Medication not found' };
    }

    // Soft delete - just mark as inactive
    await prisma.medication.update({
      where: { id: input.medicationId },
      data: { isActive: false },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Stopped tracking medication: ${medication.name}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Stopped tracking ${medication.name}`,
    };
  }

  private async addFamilyMember(
    input: AddFamilyMemberInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    // Check if already a member or has a pending invitation
    const existingMember = await prisma.familyMember.findFirst({
      where: {
        familyId: context.familyId,
        user: { email: input.email.toLowerCase() },
      },
    });

    if (existingMember) {
      return {
        success: false,
        message: `${input.email} is already a member of the care team.`,
      };
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        familyId: context.familyId,
        email: input.email.toLowerCase(),
        status: 'pending',
      },
    });

    if (existingInvitation) {
      return {
        success: false,
        message: `An invitation has already been sent to ${input.email}.`,
        id: existingInvitation.id,
      };
    }

    // Map role to Prisma enum (lowercase values)
    const roleMap: Record<string, 'caregiver' | 'family_member' | 'read_only'> = {
      caregiver: 'caregiver',
      family_member: 'family_member',
      read_only: 'read_only',
    };

    // Generate unique token for invitation
    const token = randomBytes(32).toString('hex');

    // Create invitation using relations
    const invitation = await prisma.invitation.create({
      data: {
        family: { connect: { id: context.familyId } },
        email: input.email.toLowerCase(),
        role: roleMap[input.role] || 'family_member',
        relationship: input.relationship,
        token,
        invitedBy: { connect: { id: context.userId } },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'pending',
      },
    });

    // TODO: Send invitation email (handled by separate service)
    logger.info('Family member invitation created', {
      invitationId: invitation.id,
      email: input.email,
      familyId: context.familyId,
    });

    // Log to journal
    await this.logActivityToJournal(
      `Invited ${input.name || input.email} (${input.relationship}) to the care team`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Invitation sent to ${input.name || input.email} (${input.relationship}) to join the care team.`,
      id: invitation.id,
    };
  }

  // ==================== Recommendation Handlers ====================

  private async acknowledgeRecommendation(
    input: AcknowledgeRecommendationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        familyId: context.familyId,
      },
    });

    if (!recommendation) {
      return { success: false, message: 'Recommendation not found' };
    }

    await prisma.recommendation.update({
      where: { id: input.recommendationId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedBy: context.userId,
        acknowledgedAt: new Date(),
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Acknowledged recommendation: ${recommendation.title}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Acknowledged recommendation: ${recommendation.title}`,
    };
  }

  private async acceptRecommendation(
    input: AcceptRecommendationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        familyId: context.familyId,
      },
    });

    if (!recommendation) {
      return { success: false, message: 'Recommendation not found' };
    }

    await prisma.recommendation.update({
      where: { id: input.recommendationId },
      data: {
        status: 'IN_PROGRESS',
        acknowledgedBy: context.userId,
        acknowledgedAt: new Date(),
        implementedAt: new Date(),
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Accepted recommendation: ${recommendation.title}${input.notes ? ` - ${input.notes}` : ''}`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Accepted recommendation: ${recommendation.title}. You can now implement it.`,
    };
  }

  private async dismissRecommendation(
    input: DismissRecommendationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        familyId: context.familyId,
      },
    });

    if (!recommendation) {
      return { success: false, message: 'Recommendation not found' };
    }

    await prisma.recommendation.update({
      where: { id: input.recommendationId },
      data: {
        status: 'DISMISSED',
        dismissedReason: input.reason,
        acknowledgedBy: context.userId,
        acknowledgedAt: new Date(),
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Dismissed recommendation: ${recommendation.title} (Reason: ${input.reason})`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Dismissed recommendation: ${recommendation.title}`,
    };
  }

  private async listRecommendations(
    input: ListRecommendationsInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; recommendations?: any[] }> {
    // Build where clause
    const where: any = {
      familyId: context.familyId,
    };

    // Default to showing pending and in_progress if no status filter
    if (input.status) {
      where.status = input.status;
    } else {
      where.status = { in: ['PENDING', 'IN_PROGRESS'] };
    }

    if (input.type) {
      where.type = input.type;
    }

    if (input.priority) {
      where.priority = input.priority;
    }

    const recommendations = await prisma.recommendation.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // URGENT first (alphabetically)
        { createdAt: 'desc' },
      ],
      take: input.limit || 10,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        priority: true,
        createdAt: true,
        visitDate: true,
        provider: {
          select: { name: true },
        },
      },
    });

    logger.info('listRecommendations query result', {
      familyId: context.familyId,
      count: recommendations.length,
      where,
    });

    if (recommendations.length === 0) {
      const statusText = input.status || 'pending or in-progress';
      return {
        success: true,
        message: `No ${statusText} recommendations found.`,
        recommendations: [],
      };
    }

    // Format recommendations for response - include all details so Claude can summarize
    const formattedRecs = recommendations.map((rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      type: rec.type,
      status: rec.status,
      priority: rec.priority,
      provider: rec.provider?.name || null,
      visitDate: rec.visitDate?.toISOString().split('T')[0] || null,
    }));

    logger.info('listRecommendations returning', {
      count: formattedRecs.length,
      firstTitle: formattedRecs[0]?.title,
    });

    return {
      success: true,
      message: `Found ${recommendations.length} recommendation(s).`,
      recommendations: formattedRecs,
    };
  }

  private async getRecommendationDetails(
    input: GetRecommendationDetailsInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; recommendation?: any }> {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        familyId: context.familyId,
      },
      include: {
        provider: {
          select: { id: true, name: true, specialty: true, phone: true },
        },
        document: {
          select: { id: true, title: true, type: true },
        },
        linkedMedication: {
          select: { id: true, name: true, dosage: true },
        },
      },
    });

    if (!recommendation) {
      return { success: false, message: 'Recommendation not found' };
    }

    // Look up acknowledgedBy user if set
    let acknowledgedByName: string | null = null;
    if (recommendation.acknowledgedBy) {
      const user = await prisma.user.findUnique({
        where: { id: recommendation.acknowledgedBy },
        select: { firstName: true, lastName: true },
      });
      if (user) {
        acknowledgedByName = `${user.firstName} ${user.lastName}`;
      }
    }

    const details = {
      id: recommendation.id,
      title: recommendation.title,
      description: recommendation.description,
      type: recommendation.type,
      status: recommendation.status,
      priority: recommendation.priority,
      visitDate: recommendation.visitDate?.toISOString().split('T')[0] || null,
      createdAt: recommendation.createdAt.toISOString(),
      provider: recommendation.provider
        ? {
            name: recommendation.provider.name,
            specialty: recommendation.provider.specialty,
            phone: recommendation.provider.phone,
          }
        : null,
      sourceDocument: recommendation.document
        ? {
            id: recommendation.document.id,
            title: recommendation.document.title,
            type: recommendation.document.type,
          }
        : null,
      linkedMedication: recommendation.linkedMedication
        ? {
            name: recommendation.linkedMedication.name,
            dosage: recommendation.linkedMedication.dosage,
          }
        : null,
      acknowledgedBy: acknowledgedByName,
      acknowledgedAt: recommendation.acknowledgedAt?.toISOString() || null,
      implementedAt: recommendation.implementedAt?.toISOString() || null,
      completedAt: recommendation.completedAt?.toISOString() || null,
      dismissedReason: recommendation.dismissedReason || null,
    };

    return {
      success: true,
      message: `Recommendation details for: ${recommendation.title}`,
      recommendation: details,
    };
  }

  private async createRecommendation(
    input: CreateRecommendationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    const recommendation = await prisma.recommendation.create({
      data: {
        familyId: context.familyId,
        patientId: context.patientId,
        title: input.title,
        description: input.description || '',
        type: input.type,
        priority: input.priority,
        status: 'PENDING',
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Created recommendation: ${input.title} (${input.type}, ${input.priority} priority)`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Created recommendation: ${input.title}`,
      id: recommendation.id,
    };
  }

  private async completeRecommendation(
    input: CompleteRecommendationInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: input.recommendationId,
        familyId: context.familyId,
      },
    });

    if (!recommendation) {
      return { success: false, message: 'Recommendation not found' };
    }

    await prisma.recommendation.update({
      where: { id: input.recommendationId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Completed recommendation: ${recommendation.title}${input.notes ? ` - ${input.notes}` : ''}`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Completed recommendation: ${recommendation.title}`,
    };
  }

  // ==================== Fact Handlers ====================

  private async confirmFact(
    input: ConfirmFactInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const fact = await prisma.fact.findFirst({
      where: {
        id: input.factId,
        familyId: context.familyId,
      },
    });

    if (!fact) {
      return { success: false, message: 'Fact not found' };
    }

    if (fact.status !== 'PROPOSED') {
      return { success: false, message: `Fact is already ${fact.status.toLowerCase()}` };
    }

    await prisma.fact.update({
      where: { id: input.factId },
      data: {
        status: 'ACTIVE',
        assertedBy: 'USER', // User confirmed it
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Confirmed fact: ${fact.key}`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Confirmed fact: ${fact.key} is now active`,
    };
  }

  private async rejectFact(
    input: RejectFactInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const fact = await prisma.fact.findFirst({
      where: {
        id: input.factId,
        familyId: context.familyId,
      },
    });

    if (!fact) {
      return { success: false, message: 'Fact not found' };
    }

    await prisma.fact.update({
      where: { id: input.factId },
      data: {
        status: 'REJECTED',
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Rejected fact: ${fact.key}${input.reason ? ` (Reason: ${input.reason})` : ''}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Rejected fact: ${fact.key}`,
    };
  }

  private async pinFact(
    input: PinFactInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const fact = await prisma.fact.findFirst({
      where: {
        id: input.factId,
        familyId: context.familyId,
      },
    });

    if (!fact) {
      return { success: false, message: 'Fact not found' };
    }

    await prisma.fact.update({
      where: { id: input.factId },
      data: {
        pinned: input.pinned,
      },
    });

    const action = input.pinned ? 'Pinned' : 'Unpinned';

    // Log to journal
    await this.logActivityToJournal(
      `${action} fact: ${fact.key}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `${action} fact: ${fact.key}`,
    };
  }

  // ==================== Provider Handlers ====================

  private async createProvider(
    input: CreateProviderInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    // Map type to enum
    const typeMap: Record<string, 'PHYSICIAN' | 'SPECIALIST' | 'THERAPIST' | 'PHARMACIST' | 'FACILITY' | 'OTHER'> = {
      physician: 'PHYSICIAN',
      specialist: 'SPECIALIST',
      therapist: 'THERAPIST',
      pharmacist: 'PHARMACIST',
      facility: 'FACILITY',
      other: 'OTHER',
    };

    const provider = await prisma.provider.create({
      data: {
        familyId: context.familyId,
        name: input.name,
        type: input.type ? typeMap[input.type] : 'PHYSICIAN',
        specialty: input.specialty,
        phone: input.phone,
        email: input.email,
        fax: input.fax,
        addressLine1: input.address,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        facility: input.facility,
        department: input.department,
        notes: input.notes,
        isPrimary: input.isPrimary || false,
        isActive: true,
      },
    });

    // If marking as primary, unset other primary providers
    if (input.isPrimary) {
      await prisma.provider.updateMany({
        where: {
          familyId: context.familyId,
          id: { not: provider.id },
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    // Log to journal
    await this.logActivityToJournal(
      `Added provider: ${input.name}${input.specialty ? ` (${input.specialty})` : ''}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Added provider: ${input.name}${input.specialty ? ` (${input.specialty})` : ''}`,
      id: provider.id,
    };
  }

  private async updateProvider(
    input: UpdateProviderInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const provider = await prisma.provider.findFirst({
      where: {
        id: input.providerId,
        familyId: context.familyId,
      },
    });

    if (!provider) {
      return { success: false, message: 'Provider not found' };
    }

    const typeMap: Record<string, 'PHYSICIAN' | 'SPECIALIST' | 'THERAPIST' | 'PHARMACIST' | 'FACILITY' | 'OTHER'> = {
      physician: 'PHYSICIAN',
      specialist: 'SPECIALIST',
      therapist: 'THERAPIST',
      pharmacist: 'PHARMACIST',
      facility: 'FACILITY',
      other: 'OTHER',
    };

    const updateData: any = {};
    const changes: string[] = [];

    if (input.name) {
      updateData.name = input.name;
      changes.push(`name to "${input.name}"`);
    }
    if (input.type) {
      updateData.type = typeMap[input.type];
      changes.push(`type to ${input.type}`);
    }
    if (input.specialty !== undefined) {
      updateData.specialty = input.specialty;
      changes.push('specialty');
    }
    if (input.phone !== undefined) {
      updateData.phone = input.phone;
      changes.push('phone');
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
      changes.push('email');
    }
    if (input.fax !== undefined) {
      updateData.fax = input.fax;
      changes.push('fax');
    }
    if (input.address !== undefined) {
      updateData.addressLine1 = input.address;
      changes.push('address');
    }
    if (input.city !== undefined) {
      updateData.city = input.city;
      changes.push('city');
    }
    if (input.state !== undefined) {
      updateData.state = input.state;
      changes.push('state');
    }
    if (input.zipCode !== undefined) {
      updateData.zipCode = input.zipCode;
      changes.push('zip code');
    }
    if (input.facility !== undefined) {
      updateData.facility = input.facility;
      changes.push('facility');
    }
    if (input.department !== undefined) {
      updateData.department = input.department;
      changes.push('department');
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
      changes.push('notes');
    }
    if (input.isPrimary !== undefined) {
      updateData.isPrimary = input.isPrimary;
      changes.push(input.isPrimary ? 'set as primary' : 'unset as primary');
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
      changes.push(input.isActive ? 'activated' : 'deactivated');
    }

    await prisma.provider.update({
      where: { id: input.providerId },
      data: updateData,
    });

    // If marking as primary, unset other primary providers
    if (input.isPrimary) {
      await prisma.provider.updateMany({
        where: {
          familyId: context.familyId,
          id: { not: input.providerId },
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const changesSummary = changes.length > 0 ? changes.join(', ') : 'no changes';

    // Log to journal
    await this.logActivityToJournal(
      `Updated provider "${provider.name}": ${changesSummary}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Updated "${provider.name}": ${changesSummary}`,
    };
  }

  private async deleteProvider(
    input: DeleteProviderInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const provider = await prisma.provider.findFirst({
      where: {
        id: input.providerId,
        familyId: context.familyId,
      },
    });

    if (!provider) {
      return { success: false, message: 'Provider not found' };
    }

    // Soft delete - mark as inactive
    await prisma.provider.update({
      where: { id: input.providerId },
      data: { isActive: false },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Removed provider: ${provider.name}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Removed provider: ${provider.name}`,
    };
  }

  // ==================== Checklist Handlers ====================

  private async createChecklistItem(
    input: CreateChecklistItemInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; id?: string }> {
    // Map category to enum
    const categoryMap: Record<string, 'MEALS' | 'MEDICATION' | 'EXERCISE' | 'HYGIENE' | 'SOCIAL' | 'THERAPY' | 'OTHER'> = {
      meals: 'MEALS',
      medication: 'MEDICATION',
      exercise: 'EXERCISE',
      hygiene: 'HYGIENE',
      social: 'SOCIAL',
      therapy: 'THERAPY',
      other: 'OTHER',
    };

    const item = await prisma.patientChecklistItem.create({
      data: {
        patientId: context.patientId,
        title: input.title,
        description: input.description,
        category: categoryMap[input.category],
        scheduledTime: input.scheduledTime,
        createdById: context.userId,
        isActive: true,
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Added checklist item: ${input.title} (${input.category})`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Added checklist item: ${input.title}${input.scheduledTime ? ` at ${input.scheduledTime}` : ''}`,
      id: item.id,
    };
  }

  private async updateChecklistItem(
    input: UpdateChecklistItemInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const item = await prisma.patientChecklistItem.findFirst({
      where: {
        id: input.itemId,
        patient: { familyId: context.familyId },
      },
    });

    if (!item) {
      return { success: false, message: 'Checklist item not found' };
    }

    const categoryMap: Record<string, 'MEALS' | 'MEDICATION' | 'EXERCISE' | 'HYGIENE' | 'SOCIAL' | 'THERAPY' | 'OTHER'> = {
      meals: 'MEALS',
      medication: 'MEDICATION',
      exercise: 'EXERCISE',
      hygiene: 'HYGIENE',
      social: 'SOCIAL',
      therapy: 'THERAPY',
      other: 'OTHER',
    };

    const updateData: any = {};
    const changes: string[] = [];

    if (input.title) {
      updateData.title = input.title;
      changes.push(`title to "${input.title}"`);
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
      changes.push('description');
    }
    if (input.category) {
      updateData.category = categoryMap[input.category];
      changes.push(`category to ${input.category}`);
    }
    if (input.scheduledTime !== undefined) {
      updateData.scheduledTime = input.scheduledTime;
      changes.push(`time to ${input.scheduledTime || 'unscheduled'}`);
    }
    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
      changes.push(input.isActive ? 'activated' : 'deactivated');
    }

    await prisma.patientChecklistItem.update({
      where: { id: input.itemId },
      data: updateData,
    });

    const changesSummary = changes.length > 0 ? changes.join(', ') : 'no changes';

    // Log to journal
    await this.logActivityToJournal(
      `Updated checklist item "${item.title}": ${changesSummary}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Updated "${item.title}": ${changesSummary}`,
    };
  }

  private async deleteChecklistItem(
    input: DeleteChecklistItemInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const item = await prisma.patientChecklistItem.findFirst({
      where: {
        id: input.itemId,
        patient: { familyId: context.familyId },
      },
    });

    if (!item) {
      return { success: false, message: 'Checklist item not found' };
    }

    // Soft delete - mark as inactive
    await prisma.patientChecklistItem.update({
      where: { id: input.itemId },
      data: { isActive: false },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Removed checklist item: ${item.title}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Removed checklist item: ${item.title}`,
    };
  }

  private async logChecklistCompletion(
    input: LogChecklistCompletionInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const item = await prisma.patientChecklistItem.findFirst({
      where: {
        id: input.itemId,
        patient: { familyId: context.familyId },
      },
    });

    if (!item) {
      return { success: false, message: 'Checklist item not found' };
    }

    // Create completion log
    await prisma.patientChecklistLog.create({
      data: {
        itemId: input.itemId,
        completedById: context.userId,
        completedAt: new Date(),
        notes: input.notes,
      },
    });

    // Log to journal
    await this.logActivityToJournal(
      `Completed checklist: ${item.title}${input.notes ? ` - ${input.notes}` : ''}`,
      context,
      'positive'
    );

    return {
      success: true,
      message: `Marked "${item.title}" as completed`,
    };
  }

  // ==================== Document Handlers ====================

  private async searchDocuments(
    input: SearchDocumentsInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; documents?: any[] }> {
    const typeMap: Record<string, 'MEDICAL_RECORD' | 'FINANCIAL' | 'LEGAL' | 'INSURANCE' | 'OTHER'> = {
      medical_record: 'MEDICAL_RECORD',
      financial: 'FINANCIAL',
      legal: 'LEGAL',
      insurance: 'INSURANCE',
      other: 'OTHER',
    };

    const whereClause: any = {
      familyId: context.familyId,
      OR: [
        { title: { contains: input.query, mode: 'insensitive' } },
        { description: { contains: input.query, mode: 'insensitive' } },
        { tags: { has: input.query.toLowerCase() } },
      ],
    };

    if (input.documentType) {
      whereClause.type = typeMap[input.documentType];
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        parsingStatus: true,
        tags: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (documents.length === 0) {
      return {
        success: true,
        message: `No documents found matching "${input.query}"`,
        documents: [],
      };
    }

    const documentList = documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type.toLowerCase().replace('_', ' '),
      status: doc.parsingStatus,
      tags: doc.tags,
      date: doc.createdAt.toLocaleDateString(),
    }));

    return {
      success: true,
      message: `Found ${documents.length} document(s) matching "${input.query}"`,
      documents: documentList,
    };
  }

  private async getDocumentDetails(
    input: GetDocumentDetailsInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string; document?: any }> {
    const document = await prisma.document.findFirst({
      where: {
        id: input.documentId,
        familyId: context.familyId,
      },
      include: {
        uploadedBy: true,
        recommendations: true,
      },
    });

    if (!document) {
      return { success: false, message: 'Document not found' };
    }

    return {
      success: true,
      message: `Document: ${document.title}`,
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        type: document.type.toLowerCase().replace('_', ' '),
        url: document.url,
        uploadedBy: `${document.uploadedBy.firstName} ${document.uploadedBy.lastName}`.trim(),
        parsingStatus: document.parsingStatus,
        parsedData: document.parsedData,
        tags: document.tags,
        createdAt: document.createdAt.toISOString(),
        recommendations: document.recommendations.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
        })),
      },
    };
  }

  private async triggerDocumentParse(
    input: TriggerDocumentParseInput,
    context: ChatContext
  ): Promise<{ success: boolean; message: string }> {
    const document = await prisma.document.findFirst({
      where: {
        id: input.documentId,
        familyId: context.familyId,
      },
    });

    if (!document) {
      return { success: false, message: 'Document not found' };
    }

    if (document.parsingStatus === 'COMPLETED') {
      return { success: false, message: 'Document has already been parsed' };
    }

    if (document.parsingStatus === 'PROCESSING') {
      return { success: false, message: 'Document is currently being parsed' };
    }

    // Update status to PROCESSING
    await prisma.document.update({
      where: { id: input.documentId },
      data: { parsingStatus: 'PROCESSING' },
    });

    // TODO: In a real implementation, this would trigger an async job to parse the document
    // For now, we just mark it as processing
    logger.info('Document parsing triggered', { documentId: input.documentId, familyId: context.familyId });

    // Log to journal
    await this.logActivityToJournal(
      `Triggered parsing for document: ${document.title}`,
      context,
      'neutral'
    );

    return {
      success: true,
      message: `Started parsing document: ${document.title}. This may take a few minutes.`,
    };
  }
}

export const chatAIService = new ChatAIService();
