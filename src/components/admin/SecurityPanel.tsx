import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface SecurityPanelProps {
  loginAttempts: any[];
}

const SecurityPanel: React.FC<SecurityPanelProps> = ({ loginAttempts }) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentFailed = loginAttempts.filter(a => !a.success && a.created_at >= oneHourAgo);
  const emailCounts: Record<string, number> = {};
  recentFailed.forEach(a => { emailCounts[a.email] = (emailCounts[a.email] || 0) + 1; });
  const suspiciousEmails = Object.entries(emailCounts).filter(([, c]) => c >= 5);

  return (
    <div className="space-y-6">
      {suspiciousEmails.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-red-800">تنبيهات أمنية</h3>
            {suspiciousEmails.map(([email, count]) => (
              <p key={email} className="text-sm text-red-700">{email}: {count} محاولة فاشلة في الساعة الأخيرة</p>
            ))}
          </div>
        </div>
      )}

      {suspiciousEmails.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <p className="text-green-800 font-medium">لا توجد تنبيهات أمنية حالياً</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">آخر محاولات تسجيل الدخول</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="px-3 py-2 text-start">البريد</th><th className="px-3 py-2 text-start">النتيجة</th><th className="px-3 py-2 text-start">التاريخ</th></tr></thead>
              <tbody>
                {loginAttempts.slice(0, 50).map(a => (
                  <tr key={a.id} className="border-b">
                    <td className="px-3 py-2">{a.email}</td>
                    <td className="px-3 py-2"><Badge variant={a.success ? 'default' : 'destructive'}>{a.success ? 'ناجح' : 'فاشل'}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(a.created_at).toLocaleString('ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityPanel;
