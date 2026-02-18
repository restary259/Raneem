import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldCheck, Search, Filter, Flag, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

interface SecurityPanelProps {
  loginAttempts: any[];
}

interface FraudAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  details: string;
}

const SecurityPanel: React.FC<SecurityPanelProps> = ({ loginAttempts }) => {
  const { t, i18n } = useTranslation('dashboard');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [flaggedCases, setFlaggedCases] = useState<any[]>([]);
  const isAr = i18n.language === 'ar';

  // Fraud detection: scan for duplicate IBANs, rapid referrals, etc.
  useEffect(() => {
    const detectFraud = async () => {
      const alerts: FraudAlert[] = [];

      // 1. Duplicate IBAN detection
      const { data: profiles } = await (supabase as any).from('profiles').select('id, full_name, iban, bank_account_number, bank_branch, bank_name');
      if (profiles) {
        const ibanMap: Record<string, string[]> = {};
        const accountMap: Record<string, string[]> = {};
        profiles.forEach((p: any) => {
          if (p.iban) {
            ibanMap[p.iban] = ibanMap[p.iban] || [];
            ibanMap[p.iban].push(p.full_name);
          }
          if (p.bank_account_number && p.bank_branch) {
            const key = `${p.bank_branch}-${p.bank_account_number}`;
            accountMap[key] = accountMap[key] || [];
            accountMap[key].push(p.full_name);
          }
        });
        Object.entries(ibanMap).filter(([, names]) => names.length > 1).forEach(([iban, names]) => {
          const masked = `****${iban.slice(-4)}`;
          alerts.push({ type: 'duplicate_iban', severity: 'high', message: isAr ? 'IBAN مكرر' : 'Duplicate IBAN detected', details: `${masked}: ${names.join(', ')}` });
        });
        Object.entries(accountMap).filter(([, names]) => names.length > 1).forEach(([acc, names]) => {
          const parts = acc.split('-');
          const maskedAcc = parts.length === 2 ? `${parts[0]}-****${parts[1].slice(-4)}` : `****${acc.slice(-4)}`;
          alerts.push({ type: 'duplicate_account', severity: 'high', message: isAr ? 'حساب بنكي مكرر' : 'Duplicate bank account', details: `${maskedAcc}: ${names.join(', ')}` });
        });
      }

      // 2. Rapid referral chains — only flag organic source leads (influencer traffic is normal)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReferrals } = await (supabase as any).from('referrals').select('referrer_id, created_at').gte('created_at', yesterday);
      if (recentReferrals) {
        const countByReferrer: Record<string, number> = {};
        recentReferrals.forEach((r: any) => { countByReferrer[r.referrer_id] = (countByReferrer[r.referrer_id] || 0) + 1; });
        // Threshold raised to 15 for influencers (who legitimately send many leads)
        Object.entries(countByReferrer).filter(([, c]) => c >= 10).forEach(([id, count]) => {
          alerts.push({ type: 'rapid_referrals', severity: 'medium', message: isAr ? 'إحالات سريعة مشبوهة' : 'Suspicious rapid referrals', details: `User ${id.slice(0, 8)}...: ${count} referrals in 24h (check if influencer — normal for them)` });
        });
      }

      // 2b. Organic leads from same source — flag duplicate organic source_id (NOT influencer)
      const { data: organicLeads } = await (supabase as any)
        .from('leads')
        .select('source_id, source_type, phone')
        .eq('source_type', 'organic')
        .gte('created_at', yesterday)
        .not('source_id', 'is', null);
      if (organicLeads) {
        const organicBySource: Record<string, number> = {};
        organicLeads.forEach((l: any) => {
          if (l.source_id) organicBySource[l.source_id] = (organicBySource[l.source_id] || 0) + 1;
        });
        Object.entries(organicBySource).filter(([, c]) => c >= 3).forEach(([id, count]) => {
          alerts.push({ type: 'duplicate_organic_source', severity: 'high', message: isAr ? 'مصدر عضوي مكرر' : 'Duplicate organic source detected', details: `Source ID ${id.slice(0, 8)}...: ${count} leads in 24h from organic source` });
        });
      }

      // 3. Unusual commission spikes
      const { data: recentRewards } = await (supabase as any).from('rewards').select('user_id, amount, created_at').gte('created_at', yesterday);
      if (recentRewards) {
        const sumByUser: Record<string, number> = {};
        recentRewards.forEach((r: any) => { sumByUser[r.user_id] = (sumByUser[r.user_id] || 0) + Number(r.amount); });
        Object.entries(sumByUser).filter(([, sum]) => sum >= 2000).forEach(([id, sum]) => {
          alerts.push({ type: 'commission_spike', severity: 'medium', message: isAr ? 'ارتفاع مفاجئ في العمولات' : 'Commission spike detected', details: `User ${id.slice(0, 8)}...: ₪${sum.toLocaleString()} in 24h` });
        });
      }

      setFraudAlerts(alerts);

      // Load flagged cases
      const { data: flagged } = await (supabase as any).from('student_cases').select('id, student_full_name, fraud_flagged, fraud_notes').eq('fraud_flagged', true);
      if (flagged) setFlaggedCases(flagged);
    };
    detectFraud();
  }, [isAr]);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentFailed = loginAttempts.filter(a => !a.success && a.created_at >= oneHourAgo);
  const emailCounts: Record<string, number> = {};
  recentFailed.forEach(a => { emailCounts[a.email] = (emailCounts[a.email] || 0) + 1; });
  const suspiciousEmails = Object.entries(emailCounts).filter(([, c]) => c >= 5);

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last24hAttempts = loginAttempts.filter(a => a.created_at >= last24h);
  const successCount = last24hAttempts.filter(a => a.success).length;
  const failedCount = last24hAttempts.filter(a => !a.success).length;
  const uniqueEmails = new Set(last24hAttempts.map(a => a.email)).size;

  const filtered = useMemo(() => {
    return loginAttempts
      .filter(a => {
        if (resultFilter === 'success') return a.success;
        if (resultFilter === 'failed') return !a.success;
        return true;
      })
      .filter(a => !search || a.email?.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 100);
  }, [loginAttempts, search, resultFilter]);

  const severityColor = (s: string) => s === 'high' ? 'destructive' : s === 'medium' ? 'secondary' : 'outline';

  return (
    <div className="space-y-6">
      <Tabs defaultValue="logins" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="logins">{isAr ? 'تسجيلات الدخول' : 'Login Activity'}</TabsTrigger>
          <TabsTrigger value="fraud" className="relative">
            {isAr ? 'كشف الاحتيال' : 'Fraud Detection'}
            {fraudAlerts.length > 0 && (
              <Badge variant="destructive" className="ms-2 text-[10px] px-1.5 py-0">{fraudAlerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logins" className="space-y-6">
          {/* Login Alerts */}
          {suspiciousEmails.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-red-800">{t('admin.security.alerts')}</h3>
                {suspiciousEmails.map(([email, count]) => (
                  <p key={email} className="text-sm text-red-700">{email}: {t('admin.security.failedAttempts', { count })}</p>
                ))}
              </div>
            </div>
          )}

          {suspiciousEmails.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">{t('admin.security.noAlerts')}</p>
            </div>
          )}

          {/* 24h Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{t('admin.security.successfulLogins', { defaultValue: 'Successful (24h)' })}</p>
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{t('admin.security.failedLogins', { defaultValue: 'Failed (24h)' })}</p>
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{t('admin.security.uniqueUsers', { defaultValue: 'Unique Users' })}</p>
              <p className="text-2xl font-bold">{uniqueEmails}</p>
            </CardContent></Card>
          </div>

          {/* Login Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('admin.security.recentLogins')}</CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t('admin.security.searchEmail', { defaultValue: 'Search by email...' })} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
                </div>
                <Select value={resultFilter} onValueChange={(v: any) => setResultFilter(v)}>
                  <SelectTrigger className="w-[140px]"><Filter className="h-4 w-4 me-2" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.security.allResults', { defaultValue: 'All' })}</SelectItem>
                    <SelectItem value="success">{t('admin.security.success')}</SelectItem>
                    <SelectItem value="failed">{t('admin.security.failed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-start">{t('admin.security.email')}</th>
                    <th className="px-3 py-2 text-start">{t('admin.security.result')}</th>
                    <th className="px-3 py-2 text-start">{t('admin.security.date')}</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.id} className="border-b">
                        <td className="px-3 py-2">{a.email}</td>
                        <td className="px-3 py-2"><Badge variant={a.success ? 'default' : 'destructive'}>{a.success ? t('admin.security.success') : t('admin.security.failed')}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="p-6 text-center text-muted-foreground">{t('common.noData')}</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud" className="space-y-6">
          {/* Fraud Alerts */}
          {fraudAlerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">{isAr ? 'لا توجد تنبيهات احتيال' : 'No fraud alerts detected'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fraudAlerts.map((alert, i) => (
                <div key={i} className="border rounded-xl p-4 flex items-start gap-3 bg-red-50 border-red-200">
                  <Flag className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-red-800">{alert.message}</span>
                      <Badge variant={severityColor(alert.severity) as any}>{alert.severity}</Badge>
                    </div>
                    <p className="text-sm text-red-700">{alert.details}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Flagged Cases */}
          {flaggedCases.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4" />{isAr ? 'حالات مُعلّمة' : 'Flagged Cases'}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-start">{isAr ? 'الطالب' : 'Student'}</th>
                      <th className="px-3 py-2 text-start">{isAr ? 'ملاحظات' : 'Notes'}</th>
                    </tr></thead>
                    <tbody>
                      {flaggedCases.map(c => (
                        <tr key={c.id} className="border-b">
                          <td className="px-3 py-2 font-medium">{c.student_full_name || c.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.fraud_notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityPanel;
