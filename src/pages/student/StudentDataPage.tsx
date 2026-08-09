import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Shield, Send, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RequestType = 'access' | 'correction' | 'export' | 'deletion' | 'objection';

interface DataRequestRow {
  id: string;
  request_type: string;
  status: string;
  message: string | null;
  admin_note: string | null;
  created_at: string;
}

const REQUEST_TYPES: RequestType[] = ['access', 'correction', 'export', 'deletion', 'objection'];

const CATEGORIES = ['identity', 'academic', 'case', 'documents', 'usage'] as const;

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'outline',
  rejected: 'destructive',
};

const StudentDataPage = () => {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const { toast } = useToast();

  const [requestType, setRequestType] = useState<RequestType>('access');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [requests, setRequests] = useState<DataRequestRow[]>([]);

  const loadRequests = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('data_requests')
      .select('id, request_type, status, message, admin_note, created_at')
      .order('created_at', { ascending: false });
    if (error) return;
    setRequests((data ?? []) as DataRequestRow[]);
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleExport = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      const [profileRes, caseRes, docsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.rpc('get_my_case'),
        supabase
          .from('documents')
          .select('id, file_name, category, file_size, file_type, created_at')
          .eq('student_id', user.id),
      ]);

      if (profileRes.error) throw profileRes.error;

      const payload = {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email },
        profile: profileRes.data ?? null,
        case: caseRes.error ? null : caseRes.data,
        documents: docsRes.error ? [] : docsRes.data,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `darb-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ description: t('myData.exportDone') });
    } catch (error: any) {
      toast({ variant: 'destructive', description: error.message ?? t('myData.error') });
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('data_requests').insert({
        user_id: user.id,
        request_type: requestType,
        message: message.trim() || null,
      });
      if (error) throw error;
      setMessage('');
      toast({ description: t('myData.submitted') });
      await loadRequests();
    } catch (error: any) {
      toast({ variant: 'destructive', description: error.message ?? t('myData.error') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
          {t('myData.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('myData.subtitle')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('myData.summaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="rounded-lg border border-border p-3">
              <p className="font-medium text-sm">{t(`myData.cat.${cat}`)}</p>
              <p className="text-sm text-muted-foreground mt-1">{t(`myData.cat.${cat}Desc`)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('myData.exportTitle')}
          </CardTitle>
          <CardDescription>{t('myData.exportDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t('myData.exportBtn')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('myData.requestTitle')}</CardTitle>
          <CardDescription>{t('myData.requestDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="data-request-type">{t('myData.requestTitle')}</Label>
            <Select value={requestType} onValueChange={(v) => setRequestType(v as RequestType)}>
              <SelectTrigger id="data-request-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`myData.type.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data-request-message">{t('myData.messageLabel')}</Label>
            <Textarea
              id="data-request-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('myData.messagePlaceholder')}
              rows={4}
            />
          </div>

          {requestType === 'deletion' && (
            <p className="text-sm text-muted-foreground">{t('myData.deletionNote')}</p>
          )}

          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            <Send className="h-4 w-4" aria-hidden="true" />
            {t('myData.submit')}
          </Button>

          <p className="text-sm text-muted-foreground">{t('myData.contact')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('myData.historyTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('myData.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{t(`myData.type.${req.request_type}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('en-US')}
                    </p>
                    {req.admin_note && (
                      <p className="text-sm text-muted-foreground mt-1">{req.admin_note}</p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[req.status] ?? 'secondary'}>
                    {t(`myData.status.${req.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDataPage;
