import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfileFeatureToggle from './ProfileFeatureToggle';

interface Props {
  userId: string;
  userName: string;
  value: boolean;
  onChanged: (next: boolean) => void;
}

/** Grants / revokes the member's built-in apply form (sidebar item + page). */
const ApplyFormToggle: React.FC<Props> = ({ userId, userName, value, onChanged }) => {
  const { t } = useTranslation('dashboard');
  return (
    <ProfileFeatureToggle
      userId={userId}
      column="apply_form_enabled"
      value={value}
      onChanged={onChanged}
      enableTitle={t('admin.features.applyEnableTitle', 'Enable apply form?')}
      enableBody={t('admin.features.applyEnableBody', {
        name: userName,
        defaultValue: '{{name}} will get the built-in Apply form in their dashboard. Applications through it are attributed to them.',
      })}
      disableTitle={t('admin.features.applyDisableTitle', 'Disable apply form?')}
      disableBody={t('admin.features.applyDisableBody', {
        name: userName,
        defaultValue: 'The Apply form will disappear from the sidebar for {{name}} and the page will be blocked. Their existing cases and earnings are not affected.',
      })}
      enabledToast={t('admin.features.applyEnabled', 'Apply form enabled')}
      disabledToast={t('admin.features.applyDisabled', 'Apply form disabled')}
    />
  );
};

export default ApplyFormToggle;
