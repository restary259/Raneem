import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Award, Users, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface University {
  name: string;
  location: string;
  logoUrl?: string;
  description: string;
  majors: string[];
  ranking: string;
  students: string;
  officialUrl?: string;
}
interface UniversityCardProps {
  university: University;
}

const UniversityCard: React.FC<UniversityCardProps> = ({ university }) => {
  const { t } = useTranslation('common');
  return (
    <Card className="hover:shadow-xl transition-all duration-300 group overflow-hidden flex flex-col">
      <CardContent className="p-6 flex flex-col flex-1">
        <h3 className="text-xl font-bold mb-2 text-foreground">{university.name}</h3>
        <p className="text-muted-foreground flex items-center gap-2 mb-3 text-sm">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          {university.location}
        </p>
        <p className="text-sm text-muted-foreground mb-4">{university.description}</p>
        <div className="space-y-3 mt-auto">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Award className="h-4 w-4 text-brand shrink-0" aria-hidden="true" />
            <span>{university.ranking}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{university.students}</span>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-foreground">{t('educational.availableMajorsLabel')}</h4>
            <div className="flex flex-wrap gap-1">
              {university.majors.map((major, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{major}</Badge>
              ))}
            </div>
          </div>
          {university.officialUrl ? (
            <a
              href={university.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4 hover:text-brand"
            >
              {t('educational.officialSite', { defaultValue: 'الموقع الرسمي' })}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{university.name}</span>
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
export default UniversityCard;
