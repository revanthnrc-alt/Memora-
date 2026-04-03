export type DashboardView = 'PATIENT' | 'CAREGIVER' | 'FAMILY' | undefined;

export const shouldApplyRemoteAction = (view: DashboardView, action: any): boolean => {
  const type = action?.type;

  switch (type) {
    case 'SET_VIEW_MODE':
    case 'LOGIN_SUCCESS':
    case 'SET_DEV_MODE':
      return false;

    case 'TRIGGER_SOS':
      return view === 'CAREGIVER' || view === 'FAMILY';

    case 'ADD_REMINDER':
    case 'DELETE_REMINDER':
    case 'MARK_REMINDER_NOTIFIED':
    case 'COMPLETE_REMINDER':
      return true;

    case 'ADD_VOICE_MESSAGE': {
      const senderRole = action?.payload?.senderRole;
      if (senderRole === 'FAMILY' || senderRole === 'CAREGIVER') {
        return view === 'PATIENT';
      }
      if (senderRole === 'PATIENT') {
        return view === 'CAREGIVER' || view === 'FAMILY';
      }
      return false;
    }

    case 'ADD_MEMORY':
    case 'ADD_QUOTE':
      return view === 'PATIENT';

    default:
      return true;
  }
};
