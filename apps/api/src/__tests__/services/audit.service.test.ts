import { AuditActions, ResourceTypes } from '../../services/audit.service';

describe('Audit Service', () => {
  describe('AuditActions', () => {
    it('should have authentication actions', () => {
      expect(AuditActions.LOGIN).toBe('LOGIN');
      expect(AuditActions.LOGOUT).toBe('LOGOUT');
      expect(AuditActions.IMPERSONATE_START).toBe('IMPERSONATE_START');
      expect(AuditActions.IMPERSONATE_END).toBe('IMPERSONATE_END');
      expect(AuditActions.PASSWORD_RESET).toBe('PASSWORD_RESET');
    });

    it('should have data access actions', () => {
      expect(AuditActions.VIEW_PATIENT).toBe('VIEW_PATIENT');
      expect(AuditActions.VIEW_MEDICATION).toBe('VIEW_MEDICATION');
      expect(AuditActions.VIEW_DOCUMENT).toBe('VIEW_DOCUMENT');
      expect(AuditActions.VIEW_JOURNAL).toBe('VIEW_JOURNAL');
      expect(AuditActions.VIEW_CARE_TASK).toBe('VIEW_CARE_TASK');
      expect(AuditActions.VIEW_FAMILY).toBe('VIEW_FAMILY');
      expect(AuditActions.DOWNLOAD_DOCUMENT).toBe('DOWNLOAD_DOCUMENT');
      expect(AuditActions.EXPORT_DATA).toBe('EXPORT_DATA');
    });

    it('should have modification actions', () => {
      // Patient
      expect(AuditActions.CREATE_PATIENT).toBe('CREATE_PATIENT');
      expect(AuditActions.UPDATE_PATIENT).toBe('UPDATE_PATIENT');
      expect(AuditActions.DELETE_PATIENT).toBe('DELETE_PATIENT');

      // Medication
      expect(AuditActions.CREATE_MEDICATION).toBe('CREATE_MEDICATION');
      expect(AuditActions.UPDATE_MEDICATION).toBe('UPDATE_MEDICATION');
      expect(AuditActions.DELETE_MEDICATION).toBe('DELETE_MEDICATION');
      expect(AuditActions.LOG_MEDICATION).toBe('LOG_MEDICATION');

      // Document
      expect(AuditActions.CREATE_DOCUMENT).toBe('CREATE_DOCUMENT');
      expect(AuditActions.UPDATE_DOCUMENT).toBe('UPDATE_DOCUMENT');
      expect(AuditActions.DELETE_DOCUMENT).toBe('DELETE_DOCUMENT');

      // Journal
      expect(AuditActions.CREATE_JOURNAL).toBe('CREATE_JOURNAL');
      expect(AuditActions.UPDATE_JOURNAL).toBe('UPDATE_JOURNAL');
      expect(AuditActions.DELETE_JOURNAL).toBe('DELETE_JOURNAL');

      // Care Tasks
      expect(AuditActions.CREATE_CARE_TASK).toBe('CREATE_CARE_TASK');
      expect(AuditActions.UPDATE_CARE_TASK).toBe('UPDATE_CARE_TASK');
      expect(AuditActions.DELETE_CARE_TASK).toBe('DELETE_CARE_TASK');
      expect(AuditActions.COMPLETE_CARE_TASK).toBe('COMPLETE_CARE_TASK');
    });

    it('should have family management actions', () => {
      expect(AuditActions.CREATE_FAMILY).toBe('CREATE_FAMILY');
      expect(AuditActions.UPDATE_FAMILY).toBe('UPDATE_FAMILY');
      expect(AuditActions.INVITE_MEMBER).toBe('INVITE_MEMBER');
      expect(AuditActions.ACCEPT_INVITATION).toBe('ACCEPT_INVITATION');
      expect(AuditActions.REMOVE_MEMBER).toBe('REMOVE_MEMBER');
      expect(AuditActions.UPDATE_MEMBER_ROLE).toBe('UPDATE_MEMBER_ROLE');
    });
  });

  describe('ResourceTypes', () => {
    it('should have all resource types', () => {
      expect(ResourceTypes.USER).toBe('user');
      expect(ResourceTypes.PATIENT).toBe('patient');
      expect(ResourceTypes.FAMILY).toBe('family');
      expect(ResourceTypes.FAMILY_MEMBER).toBe('family_member');
      expect(ResourceTypes.MEDICATION).toBe('medication');
      expect(ResourceTypes.MEDICATION_LOG).toBe('medication_log');
      expect(ResourceTypes.DOCUMENT).toBe('document');
      expect(ResourceTypes.JOURNAL).toBe('journal');
      expect(ResourceTypes.CARE_TASK).toBe('care_task');
      expect(ResourceTypes.INVITATION).toBe('invitation');
      expect(ResourceTypes.SETTINGS).toBe('settings');
    });
  });
});
