import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

interface ServiceLine {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  currency: string;
}

interface PaymentLine {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string | null;
  created_at: string;
}

interface SchoolCost {
  kind: string;
  name_ar: string | null;
  name_en: string | null;
  total: number;
  currency: string;
}

interface Financials {
  case_reference: string | null;
  services: ServiceLine[];
  service_total: number;
  school_costs: SchoolCost[];
  payments: PaymentLine[];
  total_confirmed: number;
  total_pending_review: number;
  remaining: number;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount ?? 0);

const StudentFeesPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';
  const [loading, setLoading] = useState(true);
  const [fin, setFin] = useState<Financials | null>(null);
  const [invoiceToken, setInvoiceToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: cases } = await supabase.rpc('get_my_case');
      const myCase = Array.isArray(cases) ? cases[0] : null;
      if (!myCase?.id) {
        setLoading(false);
        return;
      }
      const [{ data: financials }, { data: invoice }] = await Promise.all([
        supabase.rpc('get_case_financials', { p_case_id: myCase.id }),
        supabase
          .from('case_invoices')
          .select('public_token, issued_at')
          .eq('case_id', myCase.id)
          .order('issued_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (financials) setFin(financials as unknown as Financials);
      if (invoice?.public_token) setInvoiceToken(invoice.public_token);
      setLoading(false);
    })();
  }, []);

  if (loading) return <DashboardLoading />;

  if (!fin) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('studentFees.noCase', 'No case is linked to your account yet.')}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stat = (label: string, fallback: string, value: number) => (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{t(label, fallback)}</p>
      <p className="text-lg font-semibold">{money(value, 'ILS')}</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-xl font-bold">{t('studentFees.title', 'Fees & invoice')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('studentFees.subtitle', 'A summary of your agency fees and payments.')}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {t('studentFees.agencyFees', 'Agency fees')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {stat('studentFees.agencyFees', 'Agency fees', fin.service_total)}
            {stat('studentFees.paid', 'Paid', fin.total_confirmed)}
            {stat('studentFees.pendingReview', 'Pending review', fin.total_pending_review)}
            {stat('studentFees.remaining', 'Remaining', fin.remaining)}
          </div>

          {fin.services?.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fin.services.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>{s.description}</span>
                  <span className="font-medium">{money(s.line_total, s.currency || 'ILS')}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {fin.school_costs?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('studentFees.schoolCosts', 'School costs (estimate)')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fin.school_costs.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>{(isRtl ? c.name_ar : c.name_en) || c.name_en || c.name_ar}</span>
                  <span className="font-medium">{money(c.total, c.currency || 'EUR')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('studentFees.payments', 'Payments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {fin.payments?.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fin.payments.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString('en-US')}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{p.status}</Badge>
                    <span className="font-medium">{money(p.amount, p.currency || 'ILS')}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('studentFees.noPayments', 'No payments yet.')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {t('studentFees.invoice', 'Invoice')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoiceToken ? (
            <Button asChild variant="outline">
              <a href={`/invoice/${invoiceToken}`} target="_blank" rel="noreferrer">
                {t('studentFees.viewInvoice', 'View invoice')}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('studentFees.noInvoice', 'No invoice has been issued yet.')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentFeesPage;
