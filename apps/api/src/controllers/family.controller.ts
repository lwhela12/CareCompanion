import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@carecompanion/database';
import { FamilyRole, InvitationStatus } from '@prisma/client';
import { sendEmail } from '../services/email.service';
import { generateInviteToken } from '../utils/tokens';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { clerkClient } from '@clerk/express';

// Validation schemas
const createFamilySchema = z.object({
  familyName: z.string().min(1).max(100),
  patientFirstName: z.string().min(1).max(50),
  patientLastName: z.string().min(1).max(50),
  patientDateOfBirth: z.string().datetime(),
  patientGender: z.enum(['male', 'female', 'other']),
  relationship: z.string().min(1).max(50),
  userFirstName: z.string().min(1).max(50).optional(),
  userLastName: z.string().min(1).max(50).optional(),
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

    const { familyName, patientFirstName, patientLastName, patientDateOfBirth, patientGender, relationship, userFirstName, userLastName } = validation.data;
    const userId = req.auth!.userId;

    // Get user data from Clerk first
    const clerkUser = await clerkClient.users.getUser(userId);
    const userEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
    
    if (!userEmail) {
      throw new ApiError(ErrorCodes.INVALID_REQUEST, 'User email not found', 400);
    }

    // Check if user already has a family (by Clerk ID or email)
    const existingUserByClerkId = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { familyMembers: true },
    });

    if (existingUserByClerkId?.familyMembers.length) {
      throw new ApiError(ErrorCodes.CONFLICT, 'User already belongs to a family', 409);
    }

    // Also check by email in case they're claiming an existing account
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: userEmail },
      include: { familyMembers: true },
    });

    if (existingUserByEmail?.familyMembers.length) {
      // Update their Clerk ID and redirect them
      await prisma.user.update({
        where: { id: existingUserByEmail.id },
        data: { clerkId: userId }
      });
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
          email: userEmail,
          firstName: userFirstName || clerkUser.firstName || '',
          lastName: userLastName || clerkUser.lastName || '',
        },
        create: {
          clerkId: userId,
          email: userEmail,
          firstName: userFirstName || clerkUser.firstName || '',
          lastName: userLastName || clerkUser.lastName || '',
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
    try {
      console.log('getUserFamilies - auth:', req.auth);
      const userId = req.auth!.userId;
      console.log('getUserFamilies - userId:', userId);

      // First try to find user by Clerk ID
      let user = await prisma.user.findUnique({
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

      // If not found by Clerk ID, try to find by email and update
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(userId);
        const userEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
        
        if (userEmail) {
          // Check if user exists with this email
          const existingUser = await prisma.user.findUnique({
            where: { email: userEmail },
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

          if (existingUser) {
            // Update the Clerk ID to claim this account
            console.log(`Claiming existing account for ${userEmail} with Clerk ID ${userId}`);
            user = await prisma.user.update({
              where: { id: existingUser.id },
              data: { 
                clerkId: userId,
                // Update name if available from Clerk
                firstName: clerkUser.firstName || existingUser.firstName,
                lastName: clerkUser.lastName || existingUser.lastName,
              },
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
          }
        }
      }

      // If user exists and has families, return them
      if (user && user.familyMembers.length > 0) {
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

        return res.json({ 
          families,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
        });
      }

      // If no user or no families, check for pending invitations
      const clerkUser = await clerkClient.users.getUser(userId);
      const userEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
      
      if (userEmail) {
        const pendingInvitation = await prisma.invitation.findFirst({
          where: {
            email: userEmail,
            status: InvitationStatus.pending,
            expiresAt: { gt: new Date() },
          },
        });

        if (pendingInvitation) {
          // User has a pending invitation, return it so frontend can redirect
          return res.json({ 
            families: [],
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            } : null,
            pendingInvitation: {
              token: pendingInvitation.token,
              familyId: pendingInvitation.familyId,
            },
          });
        }
      }

      // No user, no families, no invitations
      return res.json({ 
        families: [],
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        } : null,
      });
    } catch (error) {
      console.error('Error getting user families:', error);
      throw error;
    }
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

  // Get family details with members
  async getFamilyDetails(req: AuthRequest, res: Response) {
    const { familyId } = req.params;
    const userId = req.auth!.userId;

    // Verify user has access to this family
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

    const family = await prisma.family.findUnique({
      where: { id: familyId },
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
    });

    if (!family) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Family not found', 404);
    }

    const members = family.members.map((fm) => ({
      id: fm.user.id,
      firstName: fm.user.firstName,
      lastName: fm.user.lastName,
      email: fm.user.email,
      role: fm.role,
      relationship: fm.relationship,
      joinedAt: fm.joinedAt,
    }));

    res.json({
      family: {
        id: family.id,
        name: family.name,
        patient: {
          id: family.patient!.id,
          firstName: family.patient!.firstName,
          lastName: family.patient!.lastName,
          dateOfBirth: family.patient!.dateOfBirth,
          gender: family.patient!.gender,
        },
        members,
        currentUserRole: member.role,
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

    // Get user data from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    const userEmail = clerkUser.emailAddresses.find(email => email.id === clerkUser.primaryEmailAddressId)?.emailAddress;
    
    if (!userEmail) {
      throw new ApiError(ErrorCodes.INVALID_REQUEST, 'User email not found', 400);
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
          email: userEmail,
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
        },
        create: {
          clerkId: userId,
          email: userEmail,
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
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