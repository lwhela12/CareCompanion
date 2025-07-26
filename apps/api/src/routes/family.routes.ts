import { Router } from 'express';
import { familyController } from '../controllers/family.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Family management
router.post('/families', familyController.createFamily);
router.get('/families', familyController.getUserFamilies);

// Invitation management
router.post('/families/:familyId/invitations', familyController.inviteMember);
router.get('/families/:familyId/invitations', familyController.getFamilyInvitations);
router.delete('/families/:familyId/invitations/:invitationId', familyController.cancelInvitation);

// Accept invitation (special route that uses token)
router.post('/invitations/:token/accept', familyController.acceptInvitation);

export default router;