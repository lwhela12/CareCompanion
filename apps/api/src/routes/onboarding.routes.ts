import { Router, Request, Response } from 'express';
import { prisma } from '@carecompanion/database';
import { onboardingAIService, OnboardingCollectedData, ConversationMessage } from '../services/onboardingAI.service';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';
import { sendEmail } from '../services/email.service';

const router = Router();

// Schema for chat request
// Type for Clerk API response
interface ClerkUser {
  email_addresses?: Array<{ email_address: string }>;
  first_name?: string;
  last_name?: string;
}

const chatSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
  collectedData: z.object({
    patient: z.object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string(),
      gender: z.enum(['male', 'female', 'other']),
      relationship: z.string(),
    }).optional(),
    medications: z.array(z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      scheduleTimes: z.array(z.string()),
      instructions: z.string().optional(),
    })).optional().default([]),
    careTasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
      recurrenceType: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'once']).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    })).optional().default([]),
    familyMembers: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(['caregiver', 'family_member', 'read_only']),
      relationship: z.string(),
    })).optional().default([]),
    familyName: z.string().optional(),
  }).optional(),
});

// Schema for confirm request
const confirmSchema = z.object({
  collectedData: z.object({
    userName: z.string().optional(),
    patient: z.object({
      firstName: z.string().min(1),
      lastName: z.string().optional().default(''),
      dateOfBirth: z.string().optional().default(''),
      gender: z.enum(['male', 'female', 'other']).optional().default('other'),
      relationship: z.string().min(1),
    }),
    medications: z.array(z.object({
      name: z.string(),
      dosage: z.string().optional().default(''),
      frequency: z.string().optional().default('as directed'),
      scheduleTimes: z.array(z.string()).optional().default(['08:00']),
      instructions: z.string().optional(),
    })).optional().default([]),
    careTasks: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      dayOfWeek: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']).optional(),
      recurrenceType: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'once']).optional(),
      priority: z.enum(['high', 'medium', 'low']).optional(),
    })).optional().default([]),
    familyMembers: z.array(z.object({
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(['caregiver', 'family_member', 'read_only']),
      relationship: z.string(),
    })).optional().default([]),
    familyName: z.string().optional(),
    conversationSummary: z.string().optional(),
  }),
});

/**
 * Check if user needs onboarding
 * GET /api/v1/onboarding/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const auth: any = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user exists and has a family
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: { family: { include: { patient: true } } },
        },
      },
    });

    if (!user) {
      res.json({ needsOnboarding: true, reason: 'no_user' });
      return;
    }

    if (user.familyMembers.length === 0) {
      res.json({ needsOnboarding: true, reason: 'no_family' });
      return;
    }

    const hasPatient = user.familyMembers.some(fm => fm.family.patient);
    if (!hasPatient) {
      res.json({ needsOnboarding: true, reason: 'no_patient' });
      return;
    }

    res.json({ needsOnboarding: false });
  } catch (error: any) {
    logger.error('Onboarding status check failed', { error: error.message });
    res.status(500).json({ error: 'Failed to check onboarding status' });
  }
});

/**
 * Chat with onboarding AI
 * POST /api/v1/onboarding/chat
 * Streams responses via SSE
 */
router.post('/chat', async (req: Request, res: Response) => {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sse = (payload: any) => {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  };

  try {
    const auth: any = (req as any).auth;
    if (!auth?.userId) {
      sse({ type: 'error', message: 'Unauthorized' });
      res.end();
      return;
    }

    // Validate input
    const parseResult = chatSchema.safeParse(req.body);
    if (!parseResult.success) {
      sse({ type: 'error', message: 'Invalid request', details: parseResult.error.errors });
      res.end();
      return;
    }

    const { message, conversationHistory, collectedData } = parseResult.data;

    // Build conversation with new message
    const messages: ConversationMessage[] = [
      ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    // Initialize collected data if not provided
    const currentData: OnboardingCollectedData = collectedData
      ? {
          patient: collectedData.patient as OnboardingCollectedData['patient'],
          medications: (collectedData.medications || []) as OnboardingCollectedData['medications'],
          careTasks: (collectedData.careTasks || []) as OnboardingCollectedData['careTasks'],
          familyMembers: (collectedData.familyMembers || []) as OnboardingCollectedData['familyMembers'],
          familyName: collectedData.familyName,
        }
      : onboardingAIService.createEmptyCollectedData();

    // Stream response from Claude
    let fullResponse = '';
    let finalCollectedData = currentData;

    for await (const event of onboardingAIService.chat(messages, currentData)) {
      switch (event.type) {
        case 'text':
          fullResponse += event.content;
          sse({ type: 'delta', text: event.content });
          break;

        case 'tool_use':
          sse({ type: 'tool_use', toolName: event.toolName, input: event.toolInput });
          break;

        case 'tool_result':
          finalCollectedData = event.collectedData || currentData;
          sse({ type: 'tool_result', toolName: event.toolName, collectedData: finalCollectedData });
          break;

        case 'done':
          finalCollectedData = event.collectedData || currentData;
          sse({ type: 'done', collectedData: finalCollectedData, fullResponse });
          break;

        case 'error':
          sse({ type: 'error', message: event.content });
          break;
      }
    }

    res.end();
  } catch (error: any) {
    logger.error('Onboarding chat error', { error: error.message, stack: error.stack });
    sse({ type: 'error', message: error.message || 'Chat failed' });
    res.end();
  }
});

/**
 * Confirm and create all collected data
 * POST /api/v1/onboarding/confirm
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const auth: any = (req as any).auth;
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate input
    const parseResult = confirmSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid request', details: parseResult.error.errors });
      return;
    }

    const { collectedData } = parseResult.data;

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });

    if (!user) {
      // Create user from Clerk data
      const clerkUser: ClerkUser = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      }).then(r => r.json());

      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email: clerkUser.email_addresses?.[0]?.email_address || '',
          firstName: collectedData.userName || clerkUser.first_name || 'User',
          lastName: clerkUser.last_name || '',
        },
      });
    } else if (collectedData.userName && user.firstName !== collectedData.userName) {
      // Update user's first name if they provided one during onboarding
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firstName: collectedData.userName },
      });
    }

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Family
      const family = await tx.family.create({
        data: {
          name: collectedData.familyName || `${collectedData.patient.lastName} Family`,
        },
      });

      // 2. Create Patient
      const patient = await tx.patient.create({
        data: {
          familyId: family.id,
          firstName: collectedData.patient.firstName,
          lastName: collectedData.patient.lastName,
          dateOfBirth: new Date(collectedData.patient.dateOfBirth),
          gender: collectedData.patient.gender,
        },
      });

      // 3. Create FamilyMember record for current user
      await tx.familyMember.create({
        data: {
          userId: user!.id,
          familyId: family.id,
          role: 'primary_caregiver',
          relationship: collectedData.patient.relationship,
        },
      });

      // 4. Create Medications (dedupe by name, case-insensitive)
      const uniqueMedications = collectedData.medications.filter(
        (med, index, self) =>
          index === self.findIndex((m) => m.name.toLowerCase() === med.name.toLowerCase())
      );
      const medications = await Promise.all(
        uniqueMedications.map((med) =>
          tx.medication.create({
            data: {
              patientId: patient.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              scheduleTime: med.scheduleTimes,
              instructions: med.instructions,
              startDate: new Date(),
              isActive: true,
              createdById: user!.id,
            },
          })
        )
      );

      // 5. Create Care Tasks (dedupe by title, case-insensitive)
      const uniqueCareTasks = collectedData.careTasks.filter(
        (task, index, self) =>
          index === self.findIndex((t) => t.title.toLowerCase() === task.title.toLowerCase())
      );

      const careTasks = await Promise.all(
        uniqueCareTasks.map((task) => {
          // Convert recurrence type to rule, including BYDAY for weekly tasks
          let recurrenceRule: string | undefined;
          if (task.recurrenceType && task.recurrenceType !== 'once') {
            const ruleMap: Record<string, string> = {
              daily: 'FREQ=DAILY',
              weekly: 'FREQ=WEEKLY',
              biweekly: 'FREQ=WEEKLY;INTERVAL=2',
              monthly: 'FREQ=MONTHLY',
            };
            recurrenceRule = ruleMap[task.recurrenceType];

            // Add BYDAY for weekly tasks if dayOfWeek is specified
            if (task.dayOfWeek && (task.recurrenceType === 'weekly' || task.recurrenceType === 'biweekly')) {
              const dayMap: Record<string, string> = {
                sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE',
                thursday: 'TH', friday: 'FR', saturday: 'SA',
              };
              recurrenceRule += `;BYDAY=${dayMap[task.dayOfWeek]}`;
            }
          }

          // Calculate due date with optional time
          let dueDate: Date;
          if (task.dueDate) {
            dueDate = new Date(task.dueDate);
            if (task.scheduledTime) {
              const [hours, minutes] = task.scheduledTime.split(':').map(Number);
              dueDate.setHours(hours, minutes, 0, 0);
            }
          } else if (task.dayOfWeek) {
            // Calculate next occurrence of the specified day of week
            const dayMap: Record<string, number> = {
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
              thursday: 4, friday: 5, saturday: 6,
            };
            const targetDay = dayMap[task.dayOfWeek];
            dueDate = new Date();
            const currentDay = dueDate.getDay();
            const daysUntilTarget = (targetDay - currentDay + 7) % 7;
            // If today is the target day, use today (daysUntilTarget = 0)
            dueDate.setDate(dueDate.getDate() + daysUntilTarget);

            if (task.scheduledTime) {
              const [hours, minutes] = task.scheduledTime.split(':').map(Number);
              dueDate.setHours(hours, minutes, 0, 0);
            } else {
              dueDate.setHours(9, 0, 0, 0); // Default to 9 AM
            }
          } else if (task.scheduledTime) {
            dueDate = new Date();
            const [hours, minutes] = task.scheduledTime.split(':').map(Number);
            dueDate.setHours(hours, minutes, 0, 0);
          } else {
            dueDate = new Date();
          }

          return tx.careTask.create({
            data: {
              familyId: family.id,
              title: task.title,
              description: task.description,
              priority: task.priority === 'high' ? 'HIGH' : task.priority === 'low' ? 'LOW' : 'MEDIUM',
              status: 'PENDING',
              dueDate,
              recurrenceRule,
              isRecurrenceTemplate: !!recurrenceRule,
              createdById: user!.id,
            },
          });
        })
      );

      // 6. Create Invitations for family members
      const invitations = await Promise.all(
        collectedData.familyMembers.map(async (member) => {
          const token = randomBytes(32).toString('hex');
          const invitation = await tx.invitation.create({
            data: {
              familyId: family.id,
              email: member.email,
              role: member.role === 'caregiver' ? 'caregiver' : member.role === 'family_member' ? 'family_member' : 'read_only',
              relationship: member.relationship,
              token,
              invitedById: user!.id,
              expiresAt: addDays(new Date(), 7),
            },
          });

          // Send invitation email (don't await to avoid blocking)
          sendEmail({
            to: member.email,
            subject: `You're invited to join ${family.name} on CareCompanion`,
            html: `
              <h2>You've been invited to CareCompanion</h2>
              <p>${user!.firstName} ${user!.lastName} has invited you to help care for ${patient.firstName} ${patient.lastName}.</p>
              <p>Click the link below to accept the invitation:</p>
              <p><a href="${process.env.FRONTEND_URL}/invitation/${token}">Accept Invitation</a></p>
              <p>This invitation expires in 7 days.</p>
            `,
          }).catch((err) => logger.error('Failed to send invitation email', { error: err.message, email: member.email }));

          return invitation;
        })
      );

      // 7. Create initial journal entry from conversation summary
      let journalEntry = null;
      if (collectedData.conversationSummary) {
        journalEntry = await tx.journalEntry.create({
          data: {
            familyId: family.id,
            userId: user!.id,
            content: collectedData.conversationSummary,
            sentiment: 'neutral',
            isPrivate: false,
            attachmentUrls: [],
            autoGenerated: true,
          },
        });
      }

      return {
        familyId: family.id,
        patientId: patient.id,
        medicationCount: medications.length,
        careTaskCount: careTasks.length,
        invitationCount: invitations.length,
        journalEntryId: journalEntry?.id,
      };
    });

    logger.info('Onboarding completed successfully', { userId: user.id, ...result });

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('Onboarding confirm error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to complete onboarding', details: error.message });
  }
});

export default router;
