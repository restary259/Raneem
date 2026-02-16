import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EligibilityConfig from './EligibilityConfig';
import CustomNotifications from './CustomNotifications';
import SecurityPanel from './SecurityPanel';
import AuditLog from './AuditLog';

interface SettingsPanelProps {
  loginAttempts?: any[];
  auditLogs?: any[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ loginAttempts = [], auditLogs = [] }) => {
  const { t } = useTranslation('dashboard');

  return (
    <Tabs defaultValue="eligibility" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="eligibility">{t('admin.tabs.eligibility')}</TabsTrigger>
        <TabsTrigger value="notifications">{t('admin.tabs.notifications')}</TabsTrigger>
        <TabsTrigger value="security">{t('admin.tabs.security')}</TabsTrigger>
        <TabsTrigger value="audit">{t('admin.tabs.audit')}</TabsTrigger>
      </TabsList>
      <TabsContent value="eligibility">
        <EligibilityConfig />
      </TabsContent>
      <TabsContent value="notifications">
        <CustomNotifications />
      </TabsContent>
      <TabsContent value="security">
        <SecurityPanel loginAttempts={loginAttempts} />
      </TabsContent>
      <TabsContent value="audit">
        <AuditLog logs={auditLogs} />
      </TabsContent>
    </Tabs>
  );
};

export default SettingsPanel;
