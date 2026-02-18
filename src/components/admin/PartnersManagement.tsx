import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InfluencerManagement from './InfluencerManagement';
import ReferralManagement from './ReferralManagement';

interface PartnersManagementProps {
  influencers: any[];
  invites: any[];
  students: any[];
  lawyers: any[];
  profiles: { id: string; full_name: string }[];
  onRefresh: () => void;
}

const PartnersManagement: React.FC<PartnersManagementProps> = ({
  influencers, invites, students, lawyers, profiles, onRefresh,
}) => {
  const { t } = useTranslation('dashboard');
  const [pendingCredentials, setPendingCredentials] = React.useState<{ email: string; password: string } | null>(null);

  return (
    <Tabs defaultValue="agents" className="space-y-4">
      <TabsList>
        <TabsTrigger value="agents">{t('admin.tabs.influencers')}</TabsTrigger>
        <TabsTrigger value="referrals">{t('admin.tabs.referrals')}</TabsTrigger>
      </TabsList>
      <TabsContent value="agents">
        <InfluencerManagement
          influencers={influencers}
          invites={invites}
          students={students}
          lawyers={lawyers}
          onRefresh={onRefresh}
          pendingCredentials={pendingCredentials}
          onCredentialsCreated={(email, password) => setPendingCredentials({ email, password })}
          onCredentialsDismissed={() => { setPendingCredentials(null); onRefresh(); }}
        />
      </TabsContent>
      <TabsContent value="referrals">
        <ReferralManagement onRefresh={onRefresh} profiles={profiles} />
      </TabsContent>
    </Tabs>
  );
};

export default PartnersManagement;
