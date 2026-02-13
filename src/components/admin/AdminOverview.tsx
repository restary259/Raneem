import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, DollarSign, Mail, FileText, TrendingUp, UserCheck, Percent, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminOverviewProps {
  totalStudents: number;
  newThisMonth: number;
  totalPayments: number;
  newContacts: number;
  totalDocuments: number;
  activeServices: number;
  totalInfluencers: number;
  leads?: any[];
  cases?: any[];
  rewards?: any[];
  lawyers?: { id: string; full_name: string }[];
  influencers?: any[];
}

const ZERO_TIPS: Record<string, string> = {
  totalStudents: 'أضف أول طالب للبدء',
  totalPayments: 'لم يتم تسجيل مدفوعات بعد',
  newContacts: 'لا توجد رسائل جديدة',
  agents: 'أضف أول وكيل للبدء',
  uploadedDocs: 'لم يتم رفع مستندات بعد',
  activeServices: 'لا خدمات نشطة حالياً',
  newStudentsThisMonth: 'لا طلاب جدد هذا الشهر',
  eligiblePct: 'لا يوجد بيانات',
  closedPct: 'لا يوجد ملفات بعد',
  revenue: 'لا إيرادات بعد',
  pendingPayouts: 'لا مدفوعات معلقة',
  topLawyer: 'لا بيانات بعد',
  topInfluencer: 'لا بيانات بعد',
};

const StatCard = ({ icon: Icon, label, value, color, subtext, tipKey }: { icon: any; label: string; value: string | number; color: string; subtext?: string; tipKey?: string }) => {
  const isZero = value === 0 || value === '0' || value === '0 ₪' || value === '—' || value === '0%';
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            {isZero && tipKey ? (
              <p className="text-xs text-muted-foreground/70 mt-1">{ZERO_TIPS[tipKey] || '—'}</p>
            ) : (
              <p className="text-xl font-bold text-foreground">{value}</p>
            )}
            {subtext && !isZero && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminOverview: React.FC<AdminOverviewProps> = ({
  totalStudents, newThisMonth, totalPayments, newContacts, totalDocuments, activeServices, totalInfluencers,
  leads = [], cases = [], rewards = [], lawyers = [], influencers = [],
}) => {
  const { t } = useTranslation('dashboard');

  // Computed KPIs
  const eligibleCount = leads.filter(l => l.status !== 'not_eligible').length;
  const eligiblePct = leads.length > 0 ? Math.round((eligibleCount / leads.length) * 100) : 0;

  const closedCount = cases.filter(c => ['paid', 'completed', 'registration_submitted', 'visa_stage'].includes(c.case_status)).length;
  const closedPct = cases.length > 0 ? Math.round((closedCount / cases.length) * 100) : 0;

  const revenue = cases
    .filter(c => c.case_status === 'paid' || c.case_status === 'completed')
    .reduce((sum: number, c: any) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);

  const pendingPayouts = rewards.filter((r: any) => r.status === 'pending' || r.status === 'approved').length;

  // Top lawyer by closed cases
  const lawyerCaseCounts: Record<string, number> = {};
  cases.filter(c => ['paid', 'completed'].includes(c.case_status) && c.assigned_lawyer_id)
    .forEach(c => { lawyerCaseCounts[c.assigned_lawyer_id] = (lawyerCaseCounts[c.assigned_lawyer_id] || 0) + 1; });
  const topLawyerId = Object.entries(lawyerCaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topLawyerName = topLawyerId ? lawyers.find(l => l.id === topLawyerId)?.full_name || '—' : '—';

  // Top influencer by referred leads
  const infLeadCounts: Record<string, number> = {};
  leads.filter(l => l.source_type === 'influencer' && l.source_id)
    .forEach(l => { infLeadCounts[l.source_id] = (infLeadCounts[l.source_id] || 0) + 1; });
  const topInfId = Object.entries(infLeadCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topInfName = topInfId ? influencers.find((i: any) => i.id === topInfId)?.full_name || '—' : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t('admin.overview.totalStudents')} value={totalStudents} color="bg-blue-600" subtext={`+${newThisMonth} ${t('admin.overview.newThisMonth')}`} tipKey="totalStudents" />
        <StatCard icon={Percent} label="نسبة المؤهلين" value={`${eligiblePct}%`} color="bg-cyan-600" subtext={`${eligibleCount} من ${leads.length}`} tipKey="eligiblePct" />
        <StatCard icon={Percent} label="نسبة الإغلاق" value={`${closedPct}%`} color="bg-indigo-600" subtext={`${closedCount} من ${cases.length}`} tipKey="closedPct" />
        <StatCard icon={DollarSign} label="الإيرادات" value={revenue > 0 ? `${revenue.toLocaleString()} €` : 0} color="bg-emerald-600" tipKey="revenue" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label={t('admin.overview.totalPayments')} value={`${totalPayments.toLocaleString()} ₪`} color="bg-emerald-600" tipKey="totalPayments" />
        <StatCard icon={Mail} label={t('admin.overview.newMessages')} value={newContacts} color="bg-amber-500" tipKey="newContacts" />
        <StatCard icon={UserCheck} label={t('admin.overview.agents')} value={totalInfluencers} color="bg-violet-600" tipKey="agents" />
        <StatCard icon={TrendingUp} label="مدفوعات معلقة" value={pendingPayouts} color="bg-rose-500" tipKey="pendingPayouts" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={FileText} label={t('admin.overview.uploadedDocs')} value={totalDocuments} color="bg-sky-500" tipKey="uploadedDocs" />
        <StatCard icon={Crown} label="أفضل محامي" value={topLawyerName} color="bg-yellow-600" tipKey="topLawyer" />
        <StatCard icon={Crown} label="أفضل وكيل" value={topInfName} color="bg-pink-600" tipKey="topInfluencer" />
      </div>
    </div>
  );
};

export default AdminOverview;
