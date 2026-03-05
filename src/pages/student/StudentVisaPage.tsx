import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Calendar, FileText, Phone, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

const VISA_STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  not_applied: { color: 'bg-muted text-muted-foreground', icon: <AlertCircle className="h-4 w-4" /> },
  applied:     { color: 'bg-blue-100 text-blue-800',     icon: <Globe className="h-4 w-4" /> },
  approved:    { color: 'bg-green-100 text-green-800',   icon: <CheckCircle2 className="h-4 w-4" /> },
  rejected:    { color: 'bg-red-100 text-red-800',       icon: <AlertCircle className="h-4 w-4" /> },
  received:    { color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="h-4 w-4" /> },
};

export default function StudentVisaPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [visaApp, setVisaApp] = useState<any>(null);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const [profRes, visaRes] = await Promise.all([
      (supabase as any).from('profiles').select('full_name,email,visa_status,arrival_date,passport_number,nationality').eq('id', uid).maybeSingle(),
      (supabase as any).from('visa_applications').select('*').eq('student_user_id', uid).maybeSingle(),
    ]);
    if (profRes.data) setProfile(profRes.data);
    if (visaRes.data) setVisaApp(visaRes.data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId) return <DashboardLoading />;

  const statusKey = profile?.visa_status || 'not_applied';
  const statusCfg = VISA_STATUS_CONFIG[statusKey] || VISA_STATUS_CONFIG.not_applied;

  const visaStatusLabels: Record<string, string> = {
    not_applied: t('profile.visaStatuses.not_applied', 'Not Applied'),
    applied:     t('profile.visaStatuses.applied', 'Applied'),
    approved:    t('profile.visaStatuses.approved', 'Approved'),
    rejected:    t('profile.visaStatuses.rejected', 'Rejected'),
    received:    t('profile.visaStatuses.received', 'Received'),
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {t('visa.title', 'Visa Status')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusCfg.color}`}>
              {statusCfg.icon}
              {visaStatusLabels[statusKey]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t('visa.readOnly', 'Visa status is updated by your assigned team member.')}</p>
        </CardContent>
      </Card>

      {/* Personal Info (read-only) */}
      {profile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('visa.personalInfo', 'Visa-Relevant Info')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoRow icon={<FileText className="h-4 w-4" />} label={t('visa.passport', 'Passport Number')} value={profile.passport_number} />
            <InfoRow icon={<Globe className="h-4 w-4" />} label={t('visa.nationality', 'Nationality')} value={profile.nationality} />
            {profile.arrival_date && (
              <InfoRow icon={<Calendar className="h-4 w-4" />} label={t('visa.arrivalDate', 'Arrival Date')} value={new Date(profile.arrival_date).toLocaleDateString(isAr ? 'ar' : 'en-GB')} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Visa Application Details */}
      {visaApp && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('visa.applicationDetails', 'Application Details')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <InfoRow icon={<MapPin className="h-4 w-4" />} label={t('visa.addressAbroad', 'Address Abroad')} value={visaApp.address_abroad} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label={t('visa.contactAbroad', 'Contact Abroad')} value={visaApp.contact_abroad} />
            {visaApp.visa_outcome && (
              <InfoRow icon={<CheckCircle2 className="h-4 w-4" />} label={t('visa.outcome', 'Outcome')} value={visaApp.visa_outcome} />
            )}
            {visaApp.additional_notes && (
              <div className="col-span-full">
                <p className="text-muted-foreground font-medium mb-1">{t('visa.notes', 'Notes')}</p>
                <p className="text-foreground">{visaApp.additional_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!visaApp && (
        <Card>
          <CardContent className="py-8 text-center">
            <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t('visa.noApplication', 'No visa application on file yet. Your team will update this when the visa process begins.')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
