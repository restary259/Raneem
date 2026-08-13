import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, Mail, Link as LinkIcon, Users, HelpCircle, MapPin, Siren, GraduationCap, Building2, Stamp } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

/**
 * Student-facing Important Contacts.
 *
 * Filtering is NOT done here. The list comes from the SECURITY DEFINER RPC
 * `get_student_important_contacts()`, which resolves the student's active
 * language school + city server-side and returns only the contacts they may
 * see (universal / school / city / school+city). Each row carries a
 * `match_scope` tag so this component only has to group and render it.
 */
interface StudentContact {
  id: string;
  name_en: string;
  name_ar: string;
  role_en: string | null;
  role_ar: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  category: string;
  city: string | null;
  address_ar: string | null;
  address_en: string | null;
  source_url: string | null;
  last_verified_at: string | null;
  match_scope: string;
}

type MatchScope = 'universal' | 'school' | 'city' | 'school_city';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  support:     <HelpCircle className="h-5 w-5 text-primary" />,
  team:        <Users className="h-5 w-5 text-primary" />,
  embassy:     <LinkIcon className="h-5 w-5 text-primary" />,
  emergency:   <Siren className="h-5 w-5 text-destructive" />,
  language_school: <GraduationCap className="h-5 w-5 text-primary" />,
  city_office: <Building2 className="h-5 w-5 text-primary" />,
  immigration: <Stamp className="h-5 w-5 text-primary" />,
  other:       <Phone className="h-5 w-5 text-muted-foreground" />,
};

const GROUP_ORDER: MatchScope[] = ['universal', 'school_city', 'school', 'city'];

export default function StudentContactsPage() {
  const [contacts, setContacts] = useState<StudentContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await (supabase as any).rpc('get_student_important_contacts');
    if (!error) setContacts((data as StudentContact[]) ?? []);
    else setContacts([]);
    setIsLoading(false);
  }, []);

  const userId = useAuthedUserId(() => load());

  // Reload when returning to the tab so a school/city change is reflected.
  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  if (!userId || isLoading) return <DashboardLoading />;

  const groups = GROUP_ORDER
    .map((scope) => ({
      scope,
      items: contacts.filter((c) => c.match_scope === scope),
    }))
    .filter((g) => g.items.length > 0);

  const groupTitle = (scope: MatchScope): string => {
    if (scope === 'universal') return t('contacts.groupUniversal', 'Emergency & Essential');
    if (scope === 'city') return t('contacts.groupCity', 'Your City');
    return t('contacts.groupSchool', 'Your Language School'); // school + school_city
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t('contacts.title', 'Important Contacts')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('contacts.subtitle', 'Key contacts for your study journey')}</p>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('contacts.noContacts', 'No contacts available yet.')}
          </CardContent>
        </Card>
      )}

      {groups.map((group) => (
        <div key={group.scope}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            {group.scope === 'universal' && CATEGORY_ICONS.emergency}
            {(group.scope === 'school' || group.scope === 'school_city') && <GraduationCap className="h-5 w-5 text-primary" />}
            {group.scope === 'city' && <Building2 className="h-5 w-5 text-primary" />}
            {groupTitle(group.scope)}
          </h2>
          <div className="grid gap-3">
            {group.items.map((contact) => (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">
                      {isAr ? contact.name_ar : contact.name_en}
                    </p>
                    {(isAr ? contact.role_ar : contact.role_en) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAr ? contact.role_ar : contact.role_en}
                      </p>
                    )}
                    {(contact.city || (isAr ? contact.address_ar : contact.address_en)) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[contact.city, isAr ? contact.address_ar : contact.address_en].filter(Boolean).join(' — ')}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {contact.phone && (
                        <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <Phone className="h-3.5 w-3.5" />{contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <Mail className="h-3.5 w-3.5" />{contact.email}
                        </a>
                      )}
                      {contact.link && (
                        <a href={contact.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                          <LinkIcon className="h-3.5 w-3.5" />{t('contacts.officialSite', 'Official website')}
                        </a>
                      )}
                      {contact.address_en && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address_en)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" />{t('contacts.directions', 'Directions')}
                        </a>
                      )}
                    </div>
                    {contact.last_verified_at && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {t('contacts.verifiedOn', 'Verified')}: {new Date(contact.last_verified_at).toLocaleDateString('en-US')}
                        {contact.source_url && (
                          <> · <a href={contact.source_url} target="_blank" rel="noopener noreferrer" className="underline">{t('contacts.source', 'source')}</a></>
                        )}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 1 && groups[0].scope === 'universal' && (
        <p className="text-sm text-muted-foreground text-center pt-2">
          {t('contacts.noMatchingContacts', 'No specific contacts for your school or city yet — emergency contacts are shown below.')}
        </p>
      )}
    </div>
  );
}

