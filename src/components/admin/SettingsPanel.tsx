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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TabsContent value="eligibility" className="mt-0 lg:col-span-2">
          <EligibilityConfig />
        </TabsContent>
        <TabsContent value="notifications" className="mt-0 lg:col-span-2">
          <CustomNotifications />
        </TabsContent>
        <TabsContent value="security" className="mt-0 lg:col-span-1">
          <SecurityPanel loginAttempts={loginAttempts} />
        </TabsContent>
        <TabsContent value="audit" className="mt-0 lg:col-span-1">
          <AuditLog logs={auditLogs} />
        </TabsContent>
      </div>
    </Tabs>
  );
};

export default SettingsPanel;
