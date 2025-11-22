import { Worker, Job } from 'bullmq';
import { prisma } from '@carecompanion/database';
import { logger } from '../../utils/logger';
import { emailService } from '../../services/email.service';
import { userSettingsService } from '../../services/userSettings.service';
import { addMinutes, format, parseISO, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';

/**
 * Job data for medication reminder processing
 */
interface MedicationReminderJobData {
  type: 'check-upcoming' | 'send-reminder';
  medicationId?: string;
  scheduledTime?: string;
  familyId?: string;
}

/**
 * Checks for upcoming medication doses and creates reminders
 */
async function checkUpcomingMedications() {
  const now = new Date();
  const reminderWindow = addMinutes(now, 30); // Look ahead 30 minutes
  const reminderWindowEnd = addMinutes(now, 45); // Up to 45 minutes ahead

  logger.info('Checking for upcoming medications', {
    now: now.toISOString(),
    reminderWindow: reminderWindow.toISOString(),
  });

  // Find all active medications
  const activeMedications = await prisma.medication.findMany({
    where: {
      isActive: true,
      startDate: {
        lte: now,
      },
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
    include: {
      patient: {
        include: {
          family: {
            include: {
              members: {
                where: {
                  isActive: true,
                  role: {
                    in: ['primary_caregiver', 'caregiver'],
                  },
                },
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
    },
  });

  logger.info(`Found ${activeMedications.length} active medications`);

  let remindersCreated = 0;
  let remindersSkipped = 0;

  // For each medication, check if any scheduled times fall within the reminder window
  for (const medication of activeMedications) {
    for (const scheduleTime of medication.scheduleTime) {
      try {
        // Parse the schedule time (format: "HH:MM" like "08:00")
        const [hours, minutes] = scheduleTime.split(':').map(Number);

        const scheduledDateTime = new Date(now);
        scheduledDateTime.setHours(hours, minutes, 0, 0);

        // Check if this time is in our reminder window (30-45 minutes from now)
        if (
          isAfter(scheduledDateTime, reminderWindow) &&
          isBefore(scheduledDateTime, reminderWindowEnd)
        ) {
          // Check if a medication log already exists for this time today
          const existingLog = await prisma.medicationLog.findUnique({
            where: {
              medicationId_scheduledTime: {
                medicationId: medication.id,
                scheduledTime: scheduledDateTime,
              },
            },
          });

          // If log exists and reminder has already been sent, skip
          if (existingLog && existingLog.status !== 'SCHEDULED') {
            remindersSkipped++;
            continue;
          }

          // Create or update the medication log
          const log = await prisma.medicationLog.upsert({
            where: {
              medicationId_scheduledTime: {
                medicationId: medication.id,
                scheduledTime: scheduledDateTime,
              },
            },
            create: {
              medicationId: medication.id,
              scheduledTime: scheduledDateTime,
              status: 'SCHEDULED',
            },
            update: {
              // No update needed if it already exists
            },
          });

          // Send reminders to family caregivers (respecting notification preferences)
          const allCaregivers = medication.patient.family.members.map((member) => ({
            userId: member.user.id,
            email: member.user.email,
            firstName: member.user.firstName,
            role: member.role,
          }));

          // Filter caregivers based on notification preferences
          const eligibleCaregivers = [];
          for (const caregiver of allCaregivers) {
            const shouldSend = await userSettingsService.shouldSendNotification(
              caregiver.userId,
              'medication',
              scheduledDateTime
            );

            if (shouldSend) {
              eligibleCaregivers.push(caregiver);
            }
          }

          // Safety check: if ALL caregivers have disabled reminders, send to primary caregiver anyway
          if (eligibleCaregivers.length === 0 && allCaregivers.length > 0) {
            const primaryCaregiver = allCaregivers.find((c) => c.role === 'primary_caregiver');

            if (primaryCaregiver) {
              logger.warn('All caregivers disabled medication reminders, sending to primary anyway', {
                medicationId: medication.id,
                familyId: medication.patient.familyId,
                scheduledTime: scheduledDateTime.toISOString(),
              });

              eligibleCaregivers.push(primaryCaregiver);
            } else {
              logger.error('No caregivers available for medication reminder', {
                medicationId: medication.id,
                medicationName: medication.name,
                familyId: medication.patient.familyId,
                scheduledTime: scheduledDateTime.toISOString(),
              });
            }
          }

          if (eligibleCaregivers.length > 0) {
            await sendMedicationReminder({
              medication,
              scheduledTime: scheduledDateTime,
              caregivers: eligibleCaregivers,
              patient: medication.patient,
            });

            remindersCreated++;

            logger.info('Medication reminder sent', {
              medicationId: medication.id,
              medicationName: medication.name,
              scheduledTime: scheduledDateTime.toISOString(),
              recipientCount: eligibleCaregivers.length,
              filteredCount: allCaregivers.length - eligibleCaregivers.length,
            });
          }
        }
      } catch (error) {
        logger.error('Error processing medication schedule time', {
          medicationId: medication.id,
          scheduleTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  logger.info('Medication reminder check completed', {
    remindersCreated,
    remindersSkipped,
  });

  return { remindersCreated, remindersSkipped };
}

/**
 * Sends a medication reminder email to caregivers
 */
async function sendMedicationReminder({
  medication,
  scheduledTime,
  caregivers,
  patient,
}: {
  medication: any;
  scheduledTime: Date;
  caregivers: Array<{ email: string; firstName: string }>;
  patient: any;
}) {
  const formattedTime = format(scheduledTime, 'h:mm a');
  const minutesUntil = Math.round((scheduledTime.getTime() - Date.now()) / 60000);

  for (const caregiver of caregivers) {
    try {
      await emailService.sendEmail({
        to: caregiver.email,
        subject: `Medication Reminder: ${medication.name} in ${minutesUntil} minutes`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Medication Reminder</h2>
            <p>Hi ${caregiver.firstName},</p>
            <p>This is a reminder that <strong>${patient.firstName} ${patient.lastName}</strong> has a medication due soon:</p>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">${medication.name}</h3>
              <p style="margin: 8px 0;"><strong>Dosage:</strong> ${medication.dosage}</p>
              <p style="margin: 8px 0;"><strong>Scheduled Time:</strong> ${formattedTime}</p>
              <p style="margin: 8px 0;"><strong>Time Until:</strong> ${minutesUntil} minutes</p>
              ${medication.instructions ? `<p style="margin: 8px 0;"><strong>Instructions:</strong> ${medication.instructions}</p>` : ''}
            </div>

            <p>Please ensure this medication is given on time and log it in CareCompanion.</p>

            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/medications"
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Log Medication
            </a>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated reminder from CareCompanion. If you have any questions, please contact support.
            </p>
          </div>
        `,
        text: `
Medication Reminder

Hi ${caregiver.firstName},

This is a reminder that ${patient.firstName} ${patient.lastName} has a medication due soon:

Medication: ${medication.name}
Dosage: ${medication.dosage}
Scheduled Time: ${formattedTime}
Time Until: ${minutesUntil} minutes
${medication.instructions ? `Instructions: ${medication.instructions}` : ''}

Please ensure this medication is given on time and log it in CareCompanion.

Log it here: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/medications
        `.trim(),
      });
    } catch (error) {
      logger.error('Failed to send medication reminder email', {
        email: caregiver.email,
        medicationId: medication.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Process medication reminder jobs
 */
async function processMedicationReminder(job: Job<MedicationReminderJobData>) {
  const { type } = job.data;

  logger.info('Processing medication reminder job', {
    jobId: job.id,
    type,
    data: job.data,
  });

  if (type === 'check-upcoming') {
    return await checkUpcomingMedications();
  }

  // Additional job types can be added here
  throw new Error(`Unknown medication reminder job type: ${type}`);
}

/**
 * Create and export the medication reminder worker
 */
export function createMedicationReminderWorker(connection: any) {
  const worker = new Worker('medication-reminders', processMedicationReminder, {
    connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second
    },
  });

  worker.on('completed', (job) => {
    logger.info('Medication reminder job completed', {
      jobId: job.id,
      returnValue: job.returnvalue,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Medication reminder job failed', {
      jobId: job?.id,
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.error('Medication reminder worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  return worker;
}
