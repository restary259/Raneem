
import { University } from '@/lib/types';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface UniversityCardProps {
  partner: University;
}

const UniversityCard = ({ partner }: UniversityCardProps) => {
  const { t } = useTranslation('partners');

  return (
    <Card className="group flex flex-col bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer overflow-hidden rounded-lg border-transparent hover:ring-2 hover:ring-accent h-full">
      <div className="bg-white p-4 flex items-center justify-center aspect-video">
        <img 
          src={partner.logoUrl} 
          alt={`${partner.name} logo`}
          className="h-20 w-auto object-contain filter grayscale group-hover:filter-none transition-all duration-300"
        />
      </div>
      <CardContent className="p-6 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-primary mb-1">{partner.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{partner.location}</p>
        
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">{t('card.specialization')}:</p>
          <div className="flex flex-wrap gap-2">
            {partner.specializations.map(spec => <Badge key={spec} variant="secondary">{spec}</Badge>)}
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <p className="text-xs text-muted-foreground">{t('card.partnerSince', { year: partner.partnershipSince })}</p>
          <Button asChild variant="secondary" className="w-full">
            <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer">
              {t('card.learnMore')} <ArrowRight />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UniversityCard;
