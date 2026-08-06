import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Link2, Plus, MousePointerClick } from 'lucide-react';
import { SITE_URL } from '@/lib/referral';

interface PartnerLink {
  id: string;
  code: string;
  label: string | null;
  target_path: string;
  active: boolean;
  created_at: string;
}

interface Props {
  partnerId: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

/**
 * Named campaign links for a partner/ambassador. Each link has its own code so
 * traffic and signups can be compared per channel — attribution is frozen on
 * the case the moment it is created.
 */
const PartnerLinksCard: React.FC<Props> = ({ partnerId }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [links, setLinks] = useState<PartnerLink[]>([]);
  const [clicks, setClicks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('partner_links')
      .select('id, code, label, target_path, active, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: true });

    const rows: PartnerLink[] = data ?? [];
    setLinks(rows);

    if (rows.length) {
      const { data: clickRows } = await (supabase as any)
        .from('partner_clicks')
        .select('partner_link_id')
        .in('partner_link_id', rows.map((r) => r.id));
      const tally: Record<string, number> = {};
      (clickRows ?? []).forEach((c: any) => {
        tally[c.partner_link_id] = (tally[c.partner_link_id] ?? 0) + 1;
      });
      setClicks(tally);
    }
    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const urlFor = (link: PartnerLink) =>
    `${SITE_URL}${link.target_path}?ref=${encodeURIComponent(link.code)}`;

  const handleCopy = async (link: PartnerLink) => {
    try {
      await navigator.clipboard.writeText(urlFor(link));
      setCopiedId(link.id);
      toast({ description: t('referralLink.copied', 'Link copied') });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ variant: 'destructive', description: t('referralLink.copyFailed', 'Could not copy the link') });
    }
  };

  const handleCreate = async () => {
    const clean = label.trim();
    if (clean.length < 2) return;
    setSaving(true);
    const base = slugify(clean) || 'link';
    const code = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await (supabase as any).from('partner_links').insert({
      partner_id: partnerId,
      code,
      label: clean,
      target_path: '/apply',
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
      return;
    }
    setLabel('');
    toast({ description: t('partnerLinks.created', 'Link created') });
    load();
  };

  const toggleActive = async (link: PartnerLink) => {
    const { error } = await (supabase as any)
      .from('partner_links')
      .update({ active: !link.active })
      .eq('id', link.id);
    if (error) {
      toast({ variant: 'destructive', description: error.message });
      return;
    }
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          {t('partnerLinks.title', 'Campaign links')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('partnerLinks.hint', 'Create a separate link per channel to see which one brings the most students.')}
        </p>

        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('partnerLinks.labelPlaceholder', 'Link name (e.g. Instagram)')}
            maxLength={40}
          />
          <Button type="button" size="sm" className="gap-2 shrink-0" disabled={saving || label.trim().length < 2} onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            {t('partnerLinks.create', 'Create')}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('partnerLinks.empty', 'No campaign links yet.')}</p>
        ) : (
          <ul className="space-y-3">
            {links.map((link) => (
              <li key={link.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium">{link.label || link.code}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="gap-1">
                      <MousePointerClick className="h-3 w-3" />
                      {(clicks[link.id] ?? 0).toLocaleString('en-US')}
                    </Badge>
                    <Switch
                      checked={link.active}
                      onCheckedChange={() => toggleActive(link)}
                      aria-label={t('partnerLinks.toggle', 'Enable link')}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly dir="ltr" value={urlFor(link)} className="text-xs font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => handleCopy(link)}
                    aria-label={t('referralLink.copy', 'Copy link')}
                  >
                    {copiedId === link.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerLinksCard;
