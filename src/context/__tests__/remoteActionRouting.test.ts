import { shouldApplyRemoteAction } from '../remoteActionRouting';

describe('shouldApplyRemoteAction', () => {
  it('blocks UI-only actions', () => {
    expect(shouldApplyRemoteAction('PATIENT', { type: 'SET_VIEW_MODE' })).toBe(false);
    expect(shouldApplyRemoteAction('PATIENT', { type: 'LOGIN_SUCCESS' })).toBe(false);
  });

  it('routes SOS alerts to caregiver/family only', () => {
    expect(shouldApplyRemoteAction('PATIENT', { type: 'TRIGGER_SOS' })).toBe(false);
    expect(shouldApplyRemoteAction('CAREGIVER', { type: 'TRIGGER_SOS' })).toBe(true);
    expect(shouldApplyRemoteAction('FAMILY', { type: 'TRIGGER_SOS' })).toBe(true);
  });

  it('routes family voice messages to patient only', () => {
    const action = { type: 'ADD_VOICE_MESSAGE', payload: { senderRole: 'FAMILY' } };
    expect(shouldApplyRemoteAction('PATIENT', action)).toBe(true);
    expect(shouldApplyRemoteAction('CAREGIVER', action)).toBe(false);
  });

  it('routes patient voice messages to caregiver/family', () => {
    const action = { type: 'ADD_VOICE_MESSAGE', payload: { senderRole: 'PATIENT' } };
    expect(shouldApplyRemoteAction('PATIENT', action)).toBe(false);
    expect(shouldApplyRemoteAction('CAREGIVER', action)).toBe(true);
    expect(shouldApplyRemoteAction('FAMILY', action)).toBe(true);
  });
});
