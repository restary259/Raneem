import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfileFeatureToggle from './ProfileFeatureToggle';

interface Props {
  userId: string;
  userName: string;
  value: boolean;
  onChanged: (next: boolean) => void;
}

/** Grants / revokes the member's shareable referral link. */
const ReferralLinkToggle: React.FC<Props> = ({ userId, userName, value, onChanged }) => {
  const { t } = useTranslation('dashboard');
  return (
    <ProfileFeatureToggle
      userId={userId}
      column="referral_code_enabled"
      value={value}
      onChanged={onChanged}
      enableTitle={t('admin.features.referralEnableTitle', 'Enable referral link?')}
      enableBody={t('admin.features.referralEnableBody', {
        name: userName,
        defaultValue: '{{name}} will see a shareable referral link on their dashboard. Applications through it are attributed to them.',
      })}
      disableTitle={t('admin.features.referralDisableTitle', 'Disable referral link?')}
      disableBody={t('admin.features.referralDisableBody', {
        name: userName,
        defaultValue: '{{name}} will no longer see a referral link. Existing referrals, earnings and payout history are not affected.',
      })}
      enabledToast={t('admin.features.referralEnabled', 'Referral link enabled')}
      disabledToast={t('admin.features.referralDisabled', 'Referral link disabled')}
    />
  );
};

export default ReferralLinkToggle;
