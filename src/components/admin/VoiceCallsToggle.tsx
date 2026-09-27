import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfileFeatureToggle from './ProfileFeatureToggle';

interface Props {
  userId: string;
  userName: string;
  value: boolean;
  onChanged: (next: boolean) => void;
}

/**
 * Grants / revokes the member's WebRTC voice calls. Unlike the other feature
 * flags this one is not role-scoped: a call needs BOTH parties enabled, and
 * the pair must already share a direct message thread, so the toggle only
 * decides whether this person may be put on a call at all.
 */
const VoiceCallsToggle: React.FC<Props> = ({ userId, userName, value, onChanged }) => {
  const { t } = useTranslation('dashboard');
  return (
    <ProfileFeatureToggle
      userId={userId}
      column="voice_calls_enabled"
      label={t('admin.members.voiceCallsSwitch', 'Voice calls')}
      value={value}
      onChanged={onChanged}
      enableTitle={t('admin.members.voiceCallsEnableTitle', 'Enable voice calls?')}
      enableBody={t('admin.members.voiceCallsEnableBody', {
        name: userName,
        defaultValue: '{{name}} will be able to start and receive voice calls with anyone they already have a direct conversation with. Both people must have this enabled.',
      })}
      disableTitle={t('admin.members.voiceCallsDisableTitle', 'Disable voice calls?')}
      disableBody={t('admin.members.voiceCallsDisableBody', {
        name: userName,
        defaultValue: '{{name}} will no longer be able to start or receive calls. A call already in progress can still be ended.',
      })}
      enabledToast={t('admin.members.voiceCallsEnabled', 'Voice calls enabled')}
      disabledToast={t('admin.members.voiceCallsDisabled', 'Voice calls disabled')}
    />
  );
};

export default VoiceCallsToggle;
