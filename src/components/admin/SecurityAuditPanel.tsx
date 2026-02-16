import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SecurityPanel from './SecurityPanel';
import AuditLog from './AuditLog';

interface SecurityAuditPanelProps {
  loginAttempts: any[];
  auditLogs: any[];
}

const SecurityAuditPanel: React.FC<SecurityAuditPanelProps> = ({ loginAttempts, auditLogs }) => {
  const { t } = useTranslation('dashboard');

  return (
    <Tabs defaultValue="security" className="space-y-4">
      <TabsList>
        <TabsTrigger value="security">{t('admin.tabs.security')}</TabsTrigger>
        <TabsTrigger value="audit">{t('admin.tabs.audit')}</TabsTrigger>
      </TabsList>
      <TabsContent value="security">
        <SecurityPanel loginAttempts={loginAttempts} />
      </TabsContent>
      <TabsContent value="audit">
        <AuditLog logs={auditLogs} />
      </TabsContent>
    </Tabs>
  );
};

export default SecurityAuditPanel;
