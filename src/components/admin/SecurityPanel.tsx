import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldCheck, Search, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SecurityPanelProps {
  loginAttempts: any[];
}

const SecurityPanel: React.FC<SecurityPanelProps> = ({ loginAttempts }) => {
  const { t, i18n } = useTranslation('dashboard');
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'failed'>('all');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentFailed = loginAttempts.filter(a => !a.success && a.created_at >= oneHourAgo);
  const emailCounts: Record<string, number> = {};
  recentFailed.forEach(a => { emailCounts[a.email] = (emailCounts[a.email] || 0) + 1; });
  const suspiciousEmails = Object.entries(emailCounts).filter(([, c]) => c >= 5);

  // Stats
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

  return (
    <div className="space-y-6">
      {/* Alerts */}
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

      {/* 24h Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('admin.security.successfulLogins', { defaultValue: 'Successful (24h)' })}</p>
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('admin.security.failedLogins', { defaultValue: 'Failed (24h)' })}</p>
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('admin.security.uniqueUsers', { defaultValue: 'Unique Users' })}</p>
            <p className="text-2xl font-bold">{uniqueEmails}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtered Login Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('admin.security.recentLogins')}</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.security.searchEmail', { defaultValue: 'Search by email...' })}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={resultFilter} onValueChange={(v: any) => setResultFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 me-2" />
                <SelectValue />
              </SelectTrigger>
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
    </div>
  );
};

export default SecurityPanel;
