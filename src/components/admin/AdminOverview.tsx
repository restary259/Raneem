import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, DollarSign, Mail, FileText, TrendingUp, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminOverviewProps {
  totalStudents: number;
  newThisMonth: number;
  totalPayments: number;
  newContacts: number;
  totalDocuments: number;
  activeServices: number;
  totalInfluencers: number;
}

const StatCard = ({ icon: Icon, label, value, color, subtext }: { icon: any; label: string; value: string | number; color: string; subtext?: string }) => (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
    <CardContent className="p-0">
      <div className="flex items-center gap-4 p-5">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminOverview: React.FC<AdminOverviewProps> = ({
  totalStudents, newThisMonth, totalPayments, newContacts, totalDocuments, activeServices, totalInfluencers
}) => {
  const { t } = useTranslation('dashboard');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t('admin.overview.totalStudents')} value={totalStudents} color="bg-blue-600" subtext={`+${newThisMonth} ${t('admin.overview.newThisMonth')}`} />
        <StatCard icon={DollarSign} label={t('admin.overview.totalPayments')} value={`${totalPayments.toLocaleString()} ₪`} color="bg-emerald-600" />
        <StatCard icon={Mail} label={t('admin.overview.newMessages')} value={newContacts} color="bg-amber-500" />
        <StatCard icon={UserCheck} label={t('admin.overview.agents')} value={totalInfluencers} color="bg-violet-600" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={FileText} label={t('admin.overview.uploadedDocs')} value={totalDocuments} color="bg-sky-500" />
        <StatCard icon={TrendingUp} label={t('admin.overview.activeServices')} value={activeServices} color="bg-orange-500" />
        <StatCard icon={TrendingUp} label={t('admin.overview.newStudentsThisMonth')} value={newThisMonth} color="bg-teal-600" />
      </div>
    </div>
  );
};

export default AdminOverview;
