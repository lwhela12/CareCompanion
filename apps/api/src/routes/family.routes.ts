import { Router } from 'express';
import { familyController } from '../controllers/family.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Family management
router.post('/families', async (req, res, next) => {
  try {
    await familyController.createFamily(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/families', async (req, res, next) => {
  try {
    await familyController.getUserFamilies(req, res);
  } catch (error) {
    next(error);
  }
});

// Get specific family details with members
router.get('/families/:familyId', async (req, res, next) => {
  try {
    await familyController.getFamilyDetails(req, res);
  } catch (error) {
    next(error);
  }
});

// Invitation management
router.post('/families/:familyId/invitations', async (req, res, next) => {
  try {
    await familyController.inviteMember(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/families/:familyId/invitations', async (req, res, next) => {
  try {
    await familyController.getFamilyInvitations(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/families/:familyId/invitations/:invitationId', async (req, res, next) => {
  try {
    await familyController.cancelInvitation(req, res);
  } catch (error) {
    next(error);
  }
});

// Invite patient to portal
router.post('/families/:familyId/invite-patient', async (req, res, next) => {
  try {
    await familyController.invitePatient(req, res);
  } catch (error) {
    next(error);
  }
});

// Accept invitation (special route that uses token)
router.post('/invitations/:token/accept', async (req, res, next) => {
  try {
    await familyController.acceptInvitation(req, res);
  } catch (error) {
    next(error);
  }
});

// DEV ONLY: Get all invitations (for testing with test emails)
router.get('/invitations/all', async (req, res, next) => {
  try {
    await familyController.getAllInvitations(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;