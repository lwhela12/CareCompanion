import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  onboardingTools,
  CollectUserNameInput,
  CollectPatientInfoInput,
  CreateMedicationInput,
  CreateCareTaskInput,
  AddFamilyMemberInput,
  ReadyForDashboardInput,
} from './ai/tools';

// Types for collected data
export interface CollectedPatientInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gender: 'male' | 'female' | 'other';
  relationship: string; // User's relationship to patient
}

export interface CollectedMedication {
  name: string;
  dosage: string;
  frequency: string;
  scheduleTimes: string[];
  instructions?: string;
}

export interface CollectedCareTask {
  title: string;
  description?: string;
  taskType?: 'task' | 'appointment';
  dueDate?: string;
  scheduledTime?: string;
  dayOfWeek?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  recurrenceType?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'once';
  priority?: 'high' | 'medium' | 'low';
}

export interface CollectedFamilyMember {
  email: string;
  name?: string;
  role: 'caregiver' | 'family_member' | 'read_only';
  relationship: string;
}

export interface CollectedDietaryInfo {
  allergies: string[];
  dietaryRestrictions: string[];
}

export interface OnboardingCollectedData {
  userName?: string; // The caregiver's name
  patient?: CollectedPatientInfo;
  dietaryInfo?: CollectedDietaryInfo;
  medications: CollectedMedication[];
  careTasks: CollectedCareTask[];
  familyMembers: CollectedFamilyMember[];
  familyName?: string;
  conversationSummary?: string; // For journal entry
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// System prompt for CeeCee - the friendly care companion
const SYSTEM_PROMPT = `You are CeeCee, a warm, empathetic AI care companion helping with onboarding. Think of yourself as a compassionate intake specialist - efficient but genuinely caring.

CRITICAL RULE: ASK ONLY ONE QUESTION PER MESSAGE. Never ask multiple questions. Keep responses concise.

YOUR STYLE:
- Warm and empathetic, but focused and efficient
- Brief acknowledgment of what they share (1-2 sentences max)
- Then ask ONE clear question to move forward
- Use their name naturally once you know it
- Like a really good consultant intake - compassionate but purposeful

QUESTION FLOW (one at a time, in this order):
1. Their name → use collect_user_name tool
2. "What brings you to CareCompanion?" (open-ended - let them explain their situation)
3. Based on what they share, ask follow-up questions to fill in gaps:
   - If you don't know who they're caring for, ask
   - If you don't know the person's FULL name (first AND last), ask "What's their full name?" → use collect_patient_info tool (MUST have both firstName and lastName)
   - If you don't know their age, ask
4. DIETARY INFO: Ask "Does [patient name] have any food allergies or special dietary needs I should know about?"
   → If they mention allergies or restrictions, use collect_dietary_info tool
   → If they say "no" or "none", still call collect_dietary_info with empty arrays to record that you asked
   → Common allergies: peanuts, tree nuts, shellfish, dairy, eggs, wheat, soy
   → Common restrictions: low-sodium, diabetic-friendly, gluten-free, vegetarian, soft foods, heart-healthy
5. MEDICATIONS: Ask "Does [patient name] take any medications you'd like me to help track?"
   → When they mention a medication:
     a) If they provided timing info (e.g., "in the morning", "twice a day", "at 8am"),
        use collect_medication immediately with converted times
     b) If they did NOT provide timing info, ask: "When does [patient] take [medication name]?"
        - Wait for their answer before calling collect_medication
        - Only after getting timing, call collect_medication with the schedule
   → After adding, ask "Any other medications?"
   → Keep asking until they say no/none/that's it
5. TASKS & APPOINTMENTS: Ask "Are there any regular appointments or care routines? Things like doctor visits, therapy, or daily activities?"
   → After they mention one, use collect_care_task tool, then ask "Any other appointments or routines?"
   → Keep asking until they say no/none/that's it
6. FAMILY MEMBERS: Ask "Is there anyone else helping care for [patient name] that you'd like to invite?"
   → After they mention one, use collect_family_member tool, then ask "Anyone else to invite?"
   → Keep asking until they say no/none/that's it
7. ONLY after completing ALL three categories (medications, tasks, family), offer to set up their dashboard

FOLLOW-UP PATTERN:
- After adding each item, ALWAYS ask "Any others?" or "Any other [category]?"
- Only move to the next category when they explicitly say no, none, that's all, etc.
- Example flow:
  User: "She takes Aricept"
  You: [collect_medication] "Got it, Aricept added. Any other medications?"
  User: "Metformin too"
  You: [collect_medication] "Added Metformin. Any others?"
  User: "No, that's it"
  You: "Great. Now, are there any regular appointments or care routines..."

MEDICATION TIMING EXAMPLES:
  User: "She takes Aricept"
  You: "When does she take Aricept? Morning, evening, or another time?"
  User: "In the morning with breakfast"
  You: [collect_medication with scheduleTimes: ["08:00"]] "Got it, Aricept added for morning. Any other medications?"

  User: "She takes Metformin twice a day"
  You: [collect_medication with scheduleTimes: ["08:00", "20:00"]] "Added Metformin for morning and evening. Any others?"

  User: "Aricept at 7am"
  You: [collect_medication with scheduleTimes: ["07:00"]] "Got it, Aricept at 7am. Any other medications?"

RESPONSE FORMAT:
- 1-2 sentences acknowledging what they said (with empathy if appropriate)
- 1 clear question

EXAMPLE GOOD RESPONSES:
"Nice to meet you, Sarah! What brings you to CareCompanion?"
"I'm sorry to hear about your mom's diagnosis. That's a lot to take on. What's her full name?"
"Sue Johnson - that's a lovely name. How old is she?"
"67 is young for early onset. What's been the hardest part so far?"
"Keeping track of everything is exhausting. Does Sue take any medications you'd like me to help track?"

EXAMPLE BAD RESPONSE (too many questions):
"I'm so sorry to hear that. Can you tell me more about your mom? What's her name, and how old is she? What medications is she on?"

DATA TIPS:
- Estimate DOB from age: if someone is 67 in 2025, their birth year is 2025-67=1958, so use "1958-01-01"
- Infer gender from "mom/dad", "she/he"
- Time conversions (only use when user HAS provided timing):
  "morning" / "with breakfast" → "08:00"
  "noon" / "midday" / "with lunch" → "12:00"
  "evening" / "with dinner" → "18:00"
  "night" / "bedtime" → "21:00"
  "twice a day" → ["08:00", "20:00"]
  "three times a day" → ["08:00", "14:00", "20:00"]

TASK vs APPOINTMENT DISTINCTION (IMPORTANT):
- APPOINTMENT: Doctor visits, therapy sessions, scheduled meetings - anything with a specific time and place you need to attend
  → Use taskType="appointment" and ALWAYS include scheduledTime
  → Example: "Doctor at 2pm tomorrow" → taskType="appointment", scheduledTime="14:00", dueDate="YYYY-MM-DD"

- TASK: To-do items like "pick up prescription", "daily walk", routines - things to complete but not at a fixed scheduled time
  → Use taskType="task"
  → Example: "Daily walk" → taskType="task", recurrenceType="daily"
  → Example: "Take prescription daily" is a MEDICATION, not a task!

RECURRING APPOINTMENT DUPLICATE PREVENTION (CRITICAL):
After calling collect_care_task for a recurring appointment, DO NOT call it again for the same appointment in a different way.

Common mistake to avoid:
- User says "weekly PT appointment on Wednesdays"
- You call collect_care_task with "PT appointment"
- Then you call it AGAIN with "Physical therapy" or "Weekly physical therapy"
- This creates duplicates!

RULE: For each recurring appointment the user mentions, call collect_care_task EXACTLY ONCE.
- Check the tool result feedback before calling again
- If you see a similar appointment type already collected, DO NOT add another one
- Use consistent naming - if you called it "PT appointment", don't also add "Physical therapy"

EXAMPLES:
User: "She has PT every Wednesday at 10am"
You: [collect_care_task with title="PT appointment", dayOfWeek="wednesday", scheduledTime="10:00", recurrenceType="weekly"]
DONE - do not call collect_care_task again for this appointment

DUPLICATE PREVENTION (READ CAREFULLY):
After each tool call, you receive feedback showing what's already collected:
- medications: list of medication names
- careTasks: list of task titles with dates/times (e.g., "Doctor appointment - Thu at 14:00")
- familyMembers: list of emails

BEFORE calling collect_care_task or collect_medication:
1. Check the collectedSoFar feedback from your most recent tool call
2. Look for semantic matches, not just exact matches:
   - "Doctor visit" = "Doctor appointment" = "Dr. appt"
   - "Thursday" could be the same as "12/5" depending on current date
   - "2pm" = "14:00" = "afternoon appointment"
3. If you see a potential match: ASK THE USER before adding
4. If the user re-mentions something already added, acknowledge it: "I already have that one noted!"

WHEN READY:
Only offer to set up the dashboard AFTER you have:
- Asked about dietary info (even if they say none)
- Asked about medications (even if they say none)
- Asked about care tasks/appointments (even if they say none)
- Asked about family members (even if they say none)

Then say: "[Name], I have everything I need to get you started. Ready for me to set up your dashboard?"

If they say yes, call ready_for_dashboard with a brief summary. The dashboard will automatically open after your final message.`;

class OnboardingAIService {
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
   * Process a chat message and stream the response
   * Handles tool use loops - when Claude calls a tool, we continue the conversation
   */
  async *chat(
    messages: ConversationMessage[],
    collectedData: OnboardingCollectedData
  ): AsyncGenerator<{
    type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error';
    content?: string;
    toolName?: string;
    toolInput?: any;
    collectedData?: OnboardingCollectedData;
  }> {
    const client = this.getClient();
    const updatedData = { ...collectedData };

    // Build messages for Claude - we'll continue adding to this as we loop
    // Filter out any messages with empty content to prevent API errors
    const claudeMessages: Anthropic.MessageParam[] = messages
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      let continueLoop = true;
      const MAX_LOOPS = 5; // Prevent infinite loops
      let loopCount = 0;

      while (continueLoop && loopCount < MAX_LOOPS) {
        loopCount++;
        continueLoop = false; // Will be set to true if we need to continue

        logger.info('Starting Anthropic API call', { messageCount: claudeMessages.length, loop: loopCount });

        // Create streaming message
        const stream = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: onboardingTools,
          messages: claudeMessages,
          stream: true,
        });

        logger.info('Anthropic stream created');

        let currentText = '';
        let currentToolUse: { id: string; name: string; input: string } | null = null;
        const toolUses: { id: string; name: string; input: any }[] = [];

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
              yield { type: 'text', content: event.delta.text };
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolUse) {
              try {
                const input = JSON.parse(currentToolUse.input);
                toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input });

                logger.info('Tool called', { toolName: currentToolUse.name, input });
                yield { type: 'tool_use', toolName: currentToolUse.name, toolInput: input };

                // Process the tool and update collected data
                this.processToolCall(currentToolUse.name, input, updatedData);

                logger.info('Tool processed', { toolName: currentToolUse.name, updatedData });
                yield { type: 'tool_result', toolName: currentToolUse.name, collectedData: updatedData };
              } catch (parseError) {
                logger.error('Failed to parse tool input', { error: parseError, input: currentToolUse.input });
              }
              currentToolUse = null;
            }
          }
        }

        // If we got tool uses, we need to continue the conversation with tool results
        if (toolUses.length > 0) {
          logger.info('Tools were called, continuing conversation', { toolCount: toolUses.length });

          // Add Claude's response (assistant message with tool_use blocks)
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

          // Add tool results (user message with tool_result blocks)
          // Include collected data so Claude knows what has already been collected
          const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((tool) => ({
            type: 'tool_result' as const,
            tool_use_id: tool.id,
            content: JSON.stringify({
              success: true,
              collectedSoFar: {
                patient: updatedData.patient ? `${updatedData.patient.firstName} ${updatedData.patient.lastName}` : null,
                dietaryInfo: updatedData.dietaryInfo
                  ? {
                      allergies: updatedData.dietaryInfo.allergies,
                      restrictions: updatedData.dietaryInfo.dietaryRestrictions,
                    }
                  : null,
                medications: updatedData.medications.map(m => m.name),
                careTasks: updatedData.careTasks.map(t => {
                  let desc = t.title;
                  if (t.dueDate) desc += ` - ${t.dueDate}`;
                  if (t.scheduledTime) desc += ` at ${t.scheduledTime}`;
                  if (t.dayOfWeek) desc += ` (${t.dayOfWeek})`;
                  if (t.recurrenceType) desc += ` [${t.recurrenceType}]`;
                  return desc;
                }),
                familyMembers: updatedData.familyMembers.map(f => f.email),
              }
            }),
          }));
          claudeMessages.push({ role: 'user', content: toolResults });

          // Continue the loop to get Claude's text response
          continueLoop = true;
        }
      }

      logger.info('Conversation complete', { updatedData });
      yield { type: 'done', collectedData: updatedData };

    } catch (error: any) {
      logger.error('Onboarding AI chat error', { error: error.message, stack: error.stack });
      yield { type: 'error', content: error.message || 'Chat failed' };
    }
  }

  /**
   * Process a tool call and update collected data
   */
  private processToolCall(
    toolName: string,
    input: any,
    data: OnboardingCollectedData
  ): void {
    switch (toolName) {
      case 'collect_user_name':
        this.handleCollectUserName(input as CollectUserNameInput, data);
        break;

      case 'collect_patient_info':
        this.handleCollectPatientInfo(input as CollectPatientInfoInput, data);
        break;

      case 'collect_dietary_info':
        this.handleCollectDietaryInfo(input, data);
        break;

      case 'collect_medication':
        this.handleCollectMedication(input as CreateMedicationInput, data);
        break;

      case 'collect_care_task':
        this.handleCollectCareTask(input as CreateCareTaskInput, data);
        break;

      case 'collect_family_member':
        this.handleCollectFamilyMember(input as AddFamilyMemberInput, data);
        break;

      case 'ready_for_dashboard':
        this.handleReadyForDashboard(input as ReadyForDashboardInput, data);
        break;

      default:
        logger.warn('Unknown tool called', { toolName });
    }
  }

  private handleCollectUserName(input: CollectUserNameInput, data: OnboardingCollectedData): void {
    data.userName = input.name;
  }

  private handleCollectPatientInfo(input: CollectPatientInfoInput, data: OnboardingCollectedData): void {
    // Calculate estimated DOB if age-based
    let dateOfBirth = input.dateOfBirth;
    if (!dateOfBirth && input.age) {
      const year = new Date().getFullYear() - input.age;
      dateOfBirth = `${year}-01-01`;
    }

    data.patient = {
      firstName: input.firstName,
      lastName: input.lastName || '',
      dateOfBirth: dateOfBirth || '',
      gender: input.gender || 'other',
      relationship: input.relationship,
    };

    // Auto-generate family name from patient or user
    if (input.lastName) {
      data.familyName = `${input.lastName} Family`;
    } else if (data.userName) {
      data.familyName = `${data.userName}'s Family`;
    }
  }

  private handleCollectDietaryInfo(
    input: { allergies?: string[]; dietaryRestrictions?: string[] },
    data: OnboardingCollectedData
  ): void {
    data.dietaryInfo = {
      allergies: input.allergies || [],
      dietaryRestrictions: input.dietaryRestrictions || [],
    };
  }

  private handleCollectMedication(input: CreateMedicationInput, data: OnboardingCollectedData): void {
    // Check for duplicate by name (case-insensitive)
    if (!data.medications.some(m => m.name.toLowerCase() === input.name.toLowerCase())) {
      data.medications.push({
        name: input.name,
        dosage: input.dosage || '',
        frequency: input.frequency || 'as directed',
        scheduleTimes: input.scheduleTimes || ['08:00'],
        instructions: input.instructions,
      });
    }
  }

  private handleCollectCareTask(input: CreateCareTaskInput, data: OnboardingCollectedData): void {
    // Check for duplicate - for recurring appointments, also check dayOfWeek + recurrenceType
    const isDuplicate = data.careTasks.some(t => {
      // Exact title match
      if (t.title.toLowerCase() === input.title.toLowerCase()) {
        return true;
      }

      // For recurring appointments, check if same day + recurrence pattern
      if (input.recurrenceType && input.recurrenceType !== 'once' &&
          t.recurrenceType && t.recurrenceType !== 'once') {
        // Same day of week and same recurrence type = likely duplicate
        if (t.dayOfWeek === input.dayOfWeek && t.recurrenceType === input.recurrenceType) {
          // Additional check: same time slot (if both have times)
          if (t.scheduledTime && input.scheduledTime && t.scheduledTime === input.scheduledTime) {
            logger.info('Duplicate recurring appointment detected by schedule', {
              existing: t.title,
              new: input.title,
              dayOfWeek: input.dayOfWeek,
              scheduledTime: input.scheduledTime
            });
            return true;
          }
        }
      }

      return false;
    });

    if (isDuplicate) {
      logger.info('Duplicate care task ignored', { title: input.title });
      return;
    }

    data.careTasks.push({
      title: input.title,
      description: input.description,
      taskType: input.taskType,
      dueDate: input.dueDate,
      scheduledTime: input.scheduledTime,
      dayOfWeek: input.dayOfWeek,
      recurrenceType: input.recurrenceType,
      priority: input.priority || 'medium',
    });
  }

  private handleCollectFamilyMember(input: AddFamilyMemberInput, data: OnboardingCollectedData): void {
    // Check for duplicate by email (case-insensitive)
    if (!data.familyMembers.some(f => f.email.toLowerCase() === input.email.toLowerCase())) {
      data.familyMembers.push({
        email: input.email,
        name: input.name,
        role: input.role,
        relationship: input.relationship,
      });
    }
  }

  private handleReadyForDashboard(input: ReadyForDashboardInput, data: OnboardingCollectedData): void {
    // Store the conversation summary for the frontend
    data.conversationSummary = input.conversationSummary;
    // dashboardWelcome is returned to frontend separately
  }

  /**
   * Create an empty collected data object
   */
  createEmptyCollectedData(): OnboardingCollectedData {
    return {
      userName: undefined,
      patient: undefined,
      dietaryInfo: undefined,
      medications: [],
      careTasks: [],
      familyMembers: [],
      familyName: undefined,
      conversationSummary: undefined,
    };
  }
}

export const onboardingAIService = new OnboardingAIService();
