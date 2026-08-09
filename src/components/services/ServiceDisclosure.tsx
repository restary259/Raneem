import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Building2, Info, Wallet, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ListBlock {
  title: string;
  items?: string[];
  body?: string;
}

const useBlock = (key: string): ListBlock => {
  const { t } = useTranslation('services');
  const value = t(`serviceDisclosure.${key}`, { returnObjects: true });
  return (value && typeof value === 'object' ? value : { title: '' }) as ListBlock;
};

const BulletCard = ({
  block,
  icon,
  tone,
}: {
  block: ListBlock;
  icon: React.ReactNode;
  tone: 'positive' | 'negative' | 'neutral';
}) => (
  <Card className="h-full">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base md:text-lg">
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        {block.title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {block.body && <p className="text-sm leading-relaxed text-muted-foreground">{block.body}</p>}
      {!!block.items?.length && (
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="mt-1 shrink-0">
                {tone === 'positive' ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : tone === 'negative' ? (
                  <X className="h-4 w-4 text-destructive" />
                ) : (
                  <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                )}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

/**
 * Pre-engagement service disclosure. Payment happens in person at the office,
 * so this is a service/terms disclosure — not a distance-sale checkout notice.
 */
const ServiceDisclosure: React.FC = () => {
  const { t } = useTranslation('services');
  const included = useBlock('included');
  const excluded = useBlock('excluded');
  const providers = useBlock('providers');
  const noGuarantee = useBlock('noGuarantee');
  const payment = useBlock('payment');
  const cancellation = useBlock('cancellation');

  return (
    <section id="service-disclosure" className="py-12 md:py-16 bg-secondary/40">
      <div className="container mx-auto px-4 max-w-5xl">
        <header className="mb-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">{t('serviceDisclosure.title')}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t('serviceDisclosure.subtitle')}</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <BulletCard block={included} tone="positive" icon={<Check className="h-5 w-5 text-primary" />} />
          <BulletCard block={excluded} tone="negative" icon={<X className="h-5 w-5 text-destructive" />} />
          <BulletCard block={providers} tone="neutral" icon={<Building2 className="h-5 w-5 text-primary" />} />
          <BulletCard block={cancellation} tone="neutral" icon={<RotateCcw className="h-5 w-5 text-primary" />} />
          <BulletCard block={payment} tone="neutral" icon={<Wallet className="h-5 w-5 text-primary" />} />
          <BulletCard block={noGuarantee} tone="neutral" icon={<Info className="h-5 w-5 text-primary" />} />
        </div>
      </div>
    </section>
  );
};

export default ServiceDisclosure;
