import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@carecompanion/database';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  chatTools,
  CreateJournalInput,
  CreateMedicationInput,
  CreateCareTaskInput,
  CompleteCareTaskInput,
  UpdateMedicationInput,
  AddFamilyMemberInput,
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
   * Process a chat message with tool support
   */
  async *chat(
    messages: { role: 'user' | 'assistant'; content: string }[],
    context: ChatContext,
    enhancedContext: string
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
- When they mention a NEW prescription or medication, use create_medication
- When they mention something they need to do (like "pick up prescription"), use create_care_task
- When they mention an appointment at a specific time, use create_care_task with BOTH dueDate AND scheduledTime
- When updating an existing medication, use update_medication
- When they say they completed a task, use complete_care_task
- When they want to add someone to the care team, use add_family_member

IMPORTANT - APPOINTMENTS AND TIMED TASKS:
- ALWAYS include scheduledTime when the user mentions a specific time (e.g., "at noon" = "12:00", "at 2pm" = "14:00", "at 3:30" = "15:30")
- For appointments, ALWAYS set both dueDate (the date) and scheduledTime (the time)
- Example: "doctor appointment tomorrow at noon" → dueDate: "${tomorrow}", scheduledTime: "12:00"

IMPORTANT GUIDELINES:
- After using a tool, confirm what you did in a friendly way
- If creating multiple items, you can use multiple tools in one response
- Be concise - caregivers are busy
- For medical questions, recommend consulting healthcare providers
- Reference specific data using [journal:ID], [medication:ID], or [task:ID] when helpful

CONTEXT ABOUT ${context.patientName.toUpperCase()}'S CARE:
${enhancedContext}`;

    // Build messages for Claude
    const claudeMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

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
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'text') {
              currentText = '';
            } else if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              };
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentText += event.delta.text;
              // Only stream text on first loop to avoid duplication when tools are used
              // On subsequent loops, Claude may repeat text when responding after tool execution
              if (loopCount === 1) {
                yield { type: 'text', content: event.delta.text };
              }
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              try {
                const input = JSON.parse(currentToolUse.input);

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

        // If tools were called, continue conversation with results
        if (toolUses.length > 0) {
          logger.info('Tools were called, continuing conversation', { toolCount: toolUses.length });

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
        case 'create_medication':
          return await this.createMedication(input, context);
        case 'create_care_task':
          return await this.createCareTask(input, context);
        case 'complete_care_task':
          return await this.completeCareTask(input, context);
        case 'update_medication':
          return await this.updateMedication(input, context);
        case 'add_family_member':
          return await this.addFamilyMember(input, context);
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
}

export const chatAIService = new ChatAIService();
