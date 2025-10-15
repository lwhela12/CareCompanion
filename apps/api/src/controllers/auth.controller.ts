import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import crypto from 'crypto';

const impersonateSchema = z.object({
  patientId: z.string().uuid(),
});

const resetPasswordSchema = z.object({
  patientId: z.string().uuid(),
  newPassword: z.string().min(8).max(100),
});

export class AuthController {
  // Impersonate a patient (caregiver logs in as patient)
  async impersonatePatient(req: AuthRequest, res: Response) {
    const validation = impersonateSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { patientId } = validation.data;

    // Get caregiver user
    const caregiver = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  where: { id: patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!caregiver) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Check if caregiver has access to this patient
    const hasAccess = caregiver.familyMembers.some(
      fm => fm.family.patient?.id === patientId &&
           ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to impersonate this patient', 403);
    }

    // Get patient's user account
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: true,
        family: true,
      },
    });

    if (!patient) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Patient not found', 404);
    }

    if (!patient.user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Patient does not have a user account', 404);
    }

    // Create audit log for impersonation
    await prisma.auditLog.create({
      data: {
        familyId: patient.familyId,
        userId: patient.user.id,
        impersonatedBy: caregiver.id,
        action: 'IMPERSONATE_START',
        resourceType: 'user',
        resourceId: patient.user.id,
        metadata: {
          caregiverName: `${caregiver.firstName} ${caregiver.lastName}`,
          patientName: `${patient.firstName} ${patient.lastName}`,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Return patient user info with impersonation flag
    res.json({
      impersonatedUser: {
        id: patient.user.id,
        clerkId: patient.user.clerkId,
        email: patient.user.email,
        firstName: patient.user.firstName,
        lastName: patient.user.lastName,
        userType: patient.user.userType,
        linkedPatientId: patient.user.linkedPatientId,
      },
      impersonatedBy: {
        id: caregiver.id,
        firstName: caregiver.firstName,
        lastName: caregiver.lastName,
      },
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
      },
      familyId: patient.familyId,
    });
  }

  // Exit impersonation (return to caregiver session)
  async exitImpersonation(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    // Get current user (should be patient if impersonating)
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        linkedPatient: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Log impersonation end
    if (user.linkedPatient) {
      await prisma.auditLog.create({
        data: {
          familyId: user.linkedPatient.familyId,
          userId: user.id,
          action: 'IMPERSONATE_END',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
    }

    res.json({
      message: 'Impersonation ended',
      redirectTo: '/dashboard',
    });
  }

  // Reset patient password (caregiver only)
  async resetPatientPassword(req: AuthRequest, res: Response) {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { patientId, newPassword } = validation.data;

    // Get caregiver user
    const caregiver = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: {
                  where: { id: patientId },
                },
              },
            },
          },
        },
      },
    });

    if (!caregiver) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Check if caregiver has access to this patient
    const hasAccess = caregiver.familyMembers.some(
      fm => fm.family.patient?.id === patientId &&
           ['primary_caregiver', 'caregiver'].includes(fm.role)
    );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to reset this patient\'s password', 403);
    }

    // Get patient's user account
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: true,
        family: true,
      },
    });

    if (!patient || !patient.user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Patient user account not found', 404);
    }

    // Update password in Clerk
    try {
      const { clerkClient } = await import('@clerk/express');
      await clerkClient.users.updateUser(patient.user.clerkId, {
        password: newPassword,
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          familyId: patient.familyId,
          userId: patient.user.id,
          impersonatedBy: caregiver.id,
          action: 'PASSWORD_RESET',
          resourceType: 'user',
          resourceId: patient.user.id,
          metadata: {
            resetBy: `${caregiver.firstName} ${caregiver.lastName}`,
            patientName: `${patient.firstName} ${patient.lastName}`,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });

      res.json({
        message: 'Password reset successfully',
        email: patient.user.email,
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      throw new ApiError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to reset password', 500);
    }
  }

  // Generate simple PIN for patient (alternative to complex password)
  generateSimplePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // Create patient user account
  async createPatientUser(patientId: string, email: string, firstName: string, lastName: string) {
    const { clerkClient } = await import('@clerk/express');

    // Generate temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');

    try {
      // Create user in Clerk
      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [email],
        password: tempPassword,
        firstName,
        lastName,
        skipPasswordChecks: false,
      });

      // Create user in database
      const user = await prisma.user.create({
        data: {
          clerkId: clerkUser.id,
          email,
          firstName,
          lastName,
          userType: 'PATIENT',
          linkedPatientId: patientId,
        },
      });

      return {
        user,
        tempPassword,
      };
    } catch (error: any) {
      console.error('Error creating patient user:', error);
      throw new ApiError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to create patient user account', 500);
    }
  }
}

export const authController = new AuthController();
