
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';

const RomaniaTab = () => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('universityFinder.romania')}</CardTitle>
        <CardDescription>{t('universityFinder.romaniaTab.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center items-center p-8">
        <Button asChild size="lg">
          <a href="https://studyinromania.gov.ro/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('universityFinder.romaniaTab.visitPortal')}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
};

export default RomaniaTab;
