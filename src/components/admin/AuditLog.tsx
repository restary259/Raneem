import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface AuditLogProps {
  logs: any[];
}

const AuditLog: React.FC<AuditLogProps> = ({ logs }) => {
  const { t, i18n } = useTranslation('dashboard');

  return (
    <div className="bg-background rounded-xl border shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.action')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.details')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.table')}</th>
            <th className="px-4 py-3 text-start font-semibold">{t('admin.audit.date')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3"><Badge variant="secondary">{log.action}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{log.details || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{log.target_table || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString(i18n.language === 'ar' ? 'ar' : 'en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.audit.noLogs')}</p>}
    </div>
  );
};

export default AuditLog;
