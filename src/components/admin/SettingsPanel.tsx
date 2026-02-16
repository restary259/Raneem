import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EligibilityConfig from './EligibilityConfig';
import CustomNotifications from './CustomNotifications';

const SettingsPanel: React.FC = () => {
  const { t } = useTranslation('dashboard');

  return (
    <Tabs defaultValue="eligibility" className="space-y-4">
      <TabsList>
        <TabsTrigger value="eligibility">{t('admin.tabs.eligibility')}</TabsTrigger>
        <TabsTrigger value="notifications">{t('admin.tabs.notifications')}</TabsTrigger>
      </TabsList>
      <TabsContent value="eligibility">
        <EligibilityConfig />
      </TabsContent>
      <TabsContent value="notifications">
        <CustomNotifications />
      </TabsContent>
    </Tabs>
  );
};

export default SettingsPanel;
