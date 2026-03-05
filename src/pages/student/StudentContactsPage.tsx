import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, Link as LinkIcon, Users, HelpCircle } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';

interface Contact {
  id: string;
  name_en: string;
  name_ar: string;
  role_en?: string;
  role_ar?: string;
  phone?: string;
  email?: string;
  link?: string;
  category: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  support:     <HelpCircle className="h-5 w-5 text-primary" />,
  team:        <Users className="h-5 w-5 text-primary" />,
  embassy:     <LinkIcon className="h-5 w-5 text-primary" />,
  other:       <Phone className="h-5 w-5 text-muted-foreground" />,
};

export default function StudentContactsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('important_contacts')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    setContacts(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load();
    });
  }, [navigate, load]);

  if (!userId || isLoading) return <DashboardLoading />;

  // Group by category
  const grouped = contacts.reduce<Record<string, Contact[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t('contacts.title', 'Important Contacts')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('contacts.subtitle', 'Key contacts for your study journey')}</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('contacts.noContacts', 'No contacts available yet.')}
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            {CATEGORY_ICONS[category] || CATEGORY_ICONS.other}
            {t(`contacts.categories.${category}`, category)}
          </h2>
          <div className="grid gap-3">
            {items.map((contact) => (
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
                    <div className="flex flex-wrap gap-3 mt-2">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
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
                          <LinkIcon className="h-3.5 w-3.5" />{t('contacts.visitLink', 'Visit')}
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
