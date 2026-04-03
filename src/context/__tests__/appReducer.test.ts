import { appReducer, initialState } from '../AppContext';
import { SenderRole, ViewMode } from '../../types';

describe('appReducer', () => {
  it('adds and completes reminders', () => {
    const added = appReducer(initialState, {
      type: 'ADD_REMINDER',
      payload: {
        id: 'r-1',
        title: 'Hydrate',
        time: '09:30',
        completed: false,
        notified: false,
        icon: 'hydration',
      },
    });

    expect(added.reminders.some((r) => r.id === 'r-1')).toBe(true);

    const completed = appReducer(added, { type: 'COMPLETE_REMINDER', payload: 'r-1' });
    const reminder = completed.reminders.find((r) => r.id === 'r-1');
    expect(reminder?.completed).toBe(true);
    expect(completed.eventLog[0].text).toContain('Patient marked');
  });

  it('acknowledges SOS/FALL alerts only', () => {
    const state = {
      ...initialState,
      alerts: [
        { id: 'a1', message: 'sos', timestamp: 't', type: 'SOS' as const, requiresAcknowledgement: true },
        { id: 'a2', message: 'emotion', timestamp: 't', type: 'EMOTION' as const },
      ],
    };

    const next = appReducer(state, { type: 'ACKNOWLEDGE_ALERTS' });
    expect(next.alerts.find((a) => a.id === 'a1')?.requiresAcknowledgement).toBe(false);
    expect(next.alerts.find((a) => a.id === 'a2')?.requiresAcknowledgement).toBeUndefined();
  });

  it('sets user and view state', () => {
    const withUser = appReducer(initialState, { type: 'LOGIN_SUCCESS', payload: { username: 'caregiver', role: 'CAREGIVER' } });
    expect(withUser.currentUser?.role).toBe('CAREGIVER');

    const withView = appReducer(withUser, { type: 'SET_VIEW_MODE', payload: ViewMode.FAMILY });
    expect(withView.currentView).toBe(ViewMode.FAMILY);
  });

  it('updates voice message duration', () => {
    const withMessage = appReducer(initialState, {
      type: 'ADD_VOICE_MESSAGE',
      payload: {
        id: 'vm-new',
        audioUrl: 'data:audio/mock',
        duration: 1,
        senderRole: SenderRole.FAMILY,
        senderName: 'Jane',
        timestamp: '10:20',
      },
    });

    const updated = appReducer(withMessage, {
      type: 'UPDATE_VOICE_MESSAGE_DURATION',
      payload: { id: 'vm-new', duration: 5.25 },
    });

    expect(updated.voiceMessages.find((m) => m.id === 'vm-new')?.duration).toBe(5.25);
  });
});
