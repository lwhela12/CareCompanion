import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { FamilyRole, InvitationStatus } from '@prisma/client';
import { sendEmail } from '../services/email.service';
import { generateInviteToken } from '../utils/tokens';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';

// Validation schemas
const createFamilySchema = z.object({
  familyName: z.string().min(1).max(100),
  patientFirstName: z.string().min(1).max(50),
  patientLastName: z.string().min(1).max(50),
  patientDateOfBirth: z.string().datetime(),
  patientGender: z.enum(['male', 'female', 'other']),
  relationship: z.string().min(1).max(50),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['caregiver', 'family_member', 'read_only']),
  relationship: z.string().min(1).max(50),
});

export class FamilyController {
  // Create a new family with initial patient info
  async createFamily(req: AuthRequest, res: Response) {
    const validation = createFamilySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const { familyName, patientFirstName, patientLastName, patientDateOfBirth, patientGender, relationship } = validation.data;
    const userId = req.auth!.userId;

    // Check if user already has a family
    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { familyMembers: true },
    });

    if (existingUser?.familyMembers.length) {
      throw new ApiError(ErrorCodes.CONFLICT, 'User already belongs to a family', 409);
    }

    // Create family, patient, and link user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the family
      const family = await tx.family.create({
        data: {
          name: familyName,
        },
      });

      // Create the patient
      const patient = await tx.patient.create({
        data: {
          familyId: family.id,
          firstName: patientFirstName,
          lastName: patientLastName,
          dateOfBirth: new Date(patientDateOfBirth),
          gender: patientGender,
        },
      });

      // Create or update the user
      const user = await tx.user.upsert({
        where: { clerkId: userId },
        update: {
          email: req.auth!.sessionClaims?.email as string,
          firstName: req.auth!.sessionClaims?.firstName as string,
          lastName: req.auth!.sessionClaims?.lastName as string,
        },
        create: {
          clerkId: userId,
          email: req.auth!.sessionClaims?.email as string,
          firstName: req.auth!.sessionClaims?.firstName as string,
          lastName: req.auth!.sessionClaims?.lastName as string,
        },
      });

      // Link user to family as primary caregiver
      const familyMember = await tx.familyMember.create({
        data: {
          userId: user.id,
          familyId: family.id,
          role: FamilyRole.primary_caregiver,
          relationship,
          isActive: true,
        },
      });

      return { family, patient, user, familyMember };
    });

    res.status(201).json({
      family: {
        id: result.family.id,
        name: result.family.name,
        patient: {
          id: result.patient.id,
          firstName: result.patient.firstName,
          lastName: result.patient.lastName,
        },
        role: result.familyMember.role,
      },
    });
  }

  // Get user's families
  async getUserFamilies(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: {
              include: {
                patient: true,
                members: {
                  where: { isActive: true },
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.json({ families: [] });
    }

    const families = user.familyMembers.map((fm) => ({
      id: fm.family.id,
      name: fm.family.name,
      role: fm.role,
      patient: {
        id: fm.family.patient!.id,
        firstName: fm.family.patient!.firstName,
        lastName: fm.family.patient!.lastName,
      },
      memberCount: fm.family.members.length,
    }));

    res.json({ families });
  }

  // Send invitation to join family
  async inviteMember(req: AuthRequest, res: Response) {
    const validation = inviteMemberSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const { familyId } = req.params;
    const { email, role, relationship } = validation.data;
    const userId = req.auth!.userId;

    // Verify user has permission to invite
    const member = await prisma.familyMember.findFirst({
      where: {
        familyId,
        user: { clerkId: userId },
        isActive: true,
        role: { in: [FamilyRole.primary_caregiver, FamilyRole.caregiver] },
      },
      include: {
        family: {
          include: { patient: true },
        },
      },
    });

    if (!member) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'You do not have permission to invite members', 403);
    }

    // Check if user is already a member
    const existingMember = await prisma.familyMember.findFirst({
      where: {
        familyId,
        user: { email },
        isActive: true,
      },
    });

    if (existingMember) {
      throw new ApiError(ErrorCodes.CONFLICT, 'User is already a family member', 409);
    }

    // Check for pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        familyId,
        email,
        status: InvitationStatus.pending,
      },
    });

    if (existingInvite) {
      throw new ApiError(ErrorCodes.CONFLICT, 'An invitation is already pending for this email', 409);
    }

    // Create invitation
    const token = generateInviteToken();
    const invitation = await prisma.invitation.create({
      data: {
        familyId,
        email,
        role: role as FamilyRole,
        relationship,
        invitedById: member.userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send invitation email
    await sendEmail({
      to: email,
      subject: `You're invited to join ${member.family.name} on CareCompanion`,
      html: `
        <h2>You've been invited to CareCompanion</h2>
        <p>${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName} has invited you to join the care team for ${member.family.patient!.firstName} ${member.family.patient!.lastName}.</p>
        <p>As a ${role.replace('_', ' ')}, you'll be able to help coordinate care and stay updated on ${member.family.patient!.firstName}'s wellbeing.</p>
        <a href="${process.env.FRONTEND_URL}/invitation/${token}" style="display: inline-block; padding: 12px 24px; background: #6B7FD7; color: white; text-decoration: none; border-radius: 8px;">Accept Invitation</a>
        <p>This invitation will expire in 7 days.</p>
      `,
    });

    res.status(201).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
      },
    });
  }

  // Get pending invitations for a family
  async getFamilyInvitations(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const userId = req.auth!.userId;

    // Verify user has permission
    const member = await prisma.familyMember.findFirst({
      where: {
        familyId,
        user: { clerkId: userId },
        isActive: true,
      },
    });

    if (!member) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        familyId,
        status: InvitationStatus.pending,
      },
      include: {
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        relationship: inv.relationship,
        invitedBy: `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`,
        invitedAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
    });
  }

  // Accept invitation
  async acceptInvitation(req: AuthRequest, res: Response) {
    const { token } = req.params;
    const userId = req.auth!.userId;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        family: {
          include: { patient: true },
        },
      },
    });

    if (!invitation) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Invalid invitation', 404);
    }

    if (invitation.status !== InvitationStatus.pending) {
      throw new ApiError(ErrorCodes.INVALID_REQUEST, 'Invitation has already been used', 400);
    }

    if (invitation.expiresAt < new Date()) {
      throw new ApiError(ErrorCodes.INVALID_REQUEST, 'Invitation has expired', 400);
    }

    // Create or update user and add to family
    const result = await prisma.$transaction(async (tx) => {
      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { 
          status: InvitationStatus.accepted,
          acceptedAt: new Date(),
        },
      });

      // Create or update user
      const user = await tx.user.upsert({
        where: { clerkId: userId },
        update: {
          email: req.auth!.sessionClaims?.email as string,
          firstName: req.auth!.sessionClaims?.firstName as string,
          lastName: req.auth!.sessionClaims?.lastName as string,
        },
        create: {
          clerkId: userId,
          email: req.auth!.sessionClaims?.email as string,
          firstName: req.auth!.sessionClaims?.firstName as string,
          lastName: req.auth!.sessionClaims?.lastName as string,
        },
      });

      // Add user to family
      const familyMember = await tx.familyMember.create({
        data: {
          userId: user.id,
          familyId: invitation.familyId,
          role: invitation.role,
          relationship: invitation.relationship,
          isActive: true,
        },
      });

      return { user, familyMember };
    });

    res.json({
      family: {
        id: invitation.family.id,
        name: invitation.family.name,
        patient: {
          firstName: invitation.family.patient!.firstName,
          lastName: invitation.family.patient!.lastName,
        },
        role: result.familyMember.role,
      },
    });
  }

  // Cancel invitation
  async cancelInvitation(req: AuthRequest, res: Response) {
    const { familyId, invitationId } = req.params;
    const userId = req.auth!.userId;

    // Verify user has permission
    const member = await prisma.familyMember.findFirst({
      where: {
        familyId,
        user: { clerkId: userId },
        isActive: true,
        role: { in: [FamilyRole.primary_caregiver, FamilyRole.caregiver] },
      },
    });

    if (!member) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'You do not have permission to cancel invitations', 403);
    }

    const invitation = await prisma.invitation.update({
      where: {
        id: invitationId,
        familyId,
      },
      data: {
        status: InvitationStatus.cancelled,
      },
    });

    res.json({ message: 'Invitation cancelled successfully' });
  }
}

export const familyController = new FamilyController();