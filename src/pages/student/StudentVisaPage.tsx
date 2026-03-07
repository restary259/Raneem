import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

interface VisaField {
  id: string;
  field_key: string;
  label_en: string;
  label_ar: string;
  field_type: string;
  options_json: any[] | null;
  display_order: number;
}

interface VisaValue {
  field_id: string;
  value: string | null;
}

const VISA_STATUS_COLORS: Record<string, string> = {
  not_applied: 'bg-muted text-muted-foreground',
  applied:     'bg-blue-100 text-blue-800',
  approved:    'bg-green-100 text-green-800',
  rejected:    'bg-red-100 text-red-800',
  received:    'bg-emerald-100 text-emerald-800',
};

export default function StudentVisaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [fields, setFields] = useState<VisaField[]>([]);
  const [values, setValues] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    try {
      const [fieldsRes, valuesRes] = await Promise.all([
        (supabase as any)
          .from('visa_fields')
          .select('id, field_key, label_en, label_ar, field_type, options_json, display_order')
          .eq('is_active', true)
          .order('display_order'),
        (supabase as any)
          .from('visa_field_values')
          .select('field_id, value')
          .eq('student_user_id', uid),
      ]);

      if (fieldsRes.data) setFields(fieldsRes.data);

      // Build value map
      const map: Record<string, string | null> = {};
      (valuesRes.data ?? []).forEach((v: VisaValue) => {
        map[v.field_id] = v.value;
      });
      setValues(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId || loading) return <DashboardLoading />;

  const renderValue = (field: VisaField, rawValue: string | null): string | null => {
    if (!rawValue) return null;
    if (field.field_type === 'boolean') {
      return rawValue === 'true'
        ? (isAr ? 'نعم' : 'Yes')
        : (isAr ? 'لا' : 'No');
    }
    if (field.field_type === 'select' && field.options_json) {
      const opt = field.options_json.find((o: any) => o.value === rawValue);
      if (opt) return isAr ? opt.ar : opt.en;
    }
    if (field.field_type === 'date' && rawValue) {
      try {
        return new Date(rawValue).toLocaleDateString(isAr ? 'ar' : 'en-GB');
      } catch { return rawValue; }
    }
    return rawValue;
  };

  // Find visa_status field for badge display
  const visaStatusField = fields.find(f => f.field_key === 'visa_status');
  const visaStatusValue = visaStatusField ? values[visaStatusField.id] ?? null : null;
  const visaStatusColorClass = VISA_STATUS_COLORS[visaStatusValue ?? 'not_applied'] || VISA_STATUS_COLORS.not_applied;

  const hasAnyValue = fields.some(f => values[f.id]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Status header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {t('visa.title', 'Visa Application')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visaStatusValue && (
            <Badge className={`${visaStatusColorClass} border-0 text-sm px-3 py-1`}>
              {renderValue(visaStatusField!, visaStatusValue)}
            </Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {t('visa.readOnly', 'Visa status is managed by your team member.')}
          </p>
        </CardContent>
      </Card>

      {/* Dynamic fields */}
      {hasAnyValue ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('visa.personalInfo', 'Visa Information')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {fields
              .filter(f => f.field_key !== 'visa_status' && values[f.id])
              .map(field => {
                const label = isAr ? field.label_ar : field.label_en;
                const display = renderValue(field, values[field.id] ?? null);
                if (!display) return null;
                return (
                  <div key={field.id} className="flex items-start gap-2">
                    <div>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{display}</p>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              {t('visa.noData', 'No visa information on file yet. Your team will update this when the process begins.')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
