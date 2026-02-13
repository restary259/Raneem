
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react';

interface KPIAnalyticsProps {
  cases: any[];
  leads: any[];
  lawyers: { id: string; full_name: string }[];
  influencers: { id: string; full_name: string }[];
  commissions: any[];
}

const KPIAnalytics: React.FC<KPIAnalyticsProps> = ({ cases, leads, lawyers, influencers, commissions }) => {
  const paidCases = cases.filter(c => c.case_status === 'paid' || c.case_status === 'completed');
  const totalRevenue = paidCases.reduce((sum, c) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);
  const totalCosts = paidCases.reduce((sum, c) => sum + (Number(c.influencer_commission) || 0) + (Number(c.lawyer_commission) || 0) + (Number(c.referral_discount) || 0) + (Number(c.translation_fee) || 0), 0);
  const totalProfit = totalRevenue - totalCosts;
  const avgProfitPerStudent = paidCases.length > 0 ? Math.round(totalProfit / paidCases.length) : 0;

  const lawyerMetrics = lawyers.map(lawyer => {
    const lawyerCases = cases.filter(c => c.assigned_lawyer_id === lawyer.id);
    const closedCases = lawyerCases.filter(c => ['paid', 'completed', 'closed'].includes(c.case_status));
    const closeRate = lawyerCases.length > 0 ? Math.round((closedCases.length / lawyerCases.length) * 100) : 0;
    const revenue = closedCases.reduce((s, c) => s + (Number(c.service_fee) || 0), 0);
    return { ...lawyer, total: lawyerCases.length, closed: closedCases.length, closeRate, revenue };
  });

  const influencerMetrics = influencers.map(inf => {
    const infLeads = leads.filter(l => l.source_id === inf.id);
    const eligible = infLeads.filter(l => l.status !== 'not_eligible').length;
    const qualityRate = infLeads.length > 0 ? Math.round((eligible / infLeads.length) * 100) : 0;
    const infCases = cases.filter(c => { const lead = leads.find(l => l.id === c.lead_id); return lead?.source_id === inf.id; });
    const paid = infCases.filter(c => c.case_status === 'paid' || c.case_status === 'completed').length;
    const convRate = infLeads.length > 0 ? Math.round((paid / infLeads.length) * 100) : 0;
    const totalComm = commissions.filter(cm => infCases.some(ic => ic.id === cm.case_id)).reduce((s, cm) => s + (Number(cm.influencer_amount) || 0), 0);
    const costPerPaid = paid > 0 ? Math.round(totalComm / paid) : 0;
    return { ...inf, totalLeads: infLeads.length, qualityRate, convRate, paid, costPerPaid };
  });

  return (
    <div className="space-y-6">
      {/* Hero Net Profit Card */}
      <Card className={`overflow-hidden ${totalProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700' : 'bg-gradient-to-br from-red-500 to-red-700'} text-white border-0`}>
        <CardContent className="p-6 text-center">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-80" />
          <p className="text-sm opacity-80">صافي الربح الإجمالي</p>
          <p className="text-4xl font-bold mt-1">{totalProfit} €</p>
          <p className="text-xs opacity-70 mt-2">{paidCases.length} طالب مدفوع</p>
        </CardContent>
      </Card>

      {/* Revenue / Expenses / Profit blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-emerald-700 font-medium">الإيرادات</p>
            <p className="text-2xl font-bold text-emerald-700">{totalRevenue} €</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-red-700 font-medium">المصروفات</p>
            <p className="text-2xl font-bold text-red-700">{totalCosts} €</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">ربح/طالب</p>
            <p className="text-2xl font-bold">{avgProfitPerStudent} €</p>
          </CardContent>
        </Card>
      </div>

      {/* Lawyer KPIs */}
      {lawyerMetrics.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Users className="h-5 w-5" />أداء المحامين</h2>
          <div className="grid gap-3">
            {lawyerMetrics.map(l => (
              <Card key={l.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{l.full_name}</h3>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">نسبة الإغلاق</p><p className="font-bold">{l.closeRate}%</p></div>
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">ملفات مغلقة</p><p className="font-bold">{l.closed}/{l.total}</p></div>
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">الإيرادات</p><p className="font-bold">{l.revenue} €</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Influencer KPIs */}
      {influencerMetrics.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5" />أداء الوكلاء</h2>
          <div className="grid gap-3">
            {influencerMetrics.map(i => (
              <Card key={i.id}>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">{i.full_name}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">عملاء</p><p className="font-bold">{i.totalLeads}</p></div>
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">جودة</p><p className="font-bold">{i.qualityRate}%</p></div>
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">تحويل</p><p className="font-bold">{i.convRate}%</p></div>
                    <div className="text-center p-2 bg-muted/40 rounded"><p className="text-xs text-muted-foreground">تكلفة/طالب</p><p className="font-bold">{i.costPerPaid} €</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIAnalytics;
