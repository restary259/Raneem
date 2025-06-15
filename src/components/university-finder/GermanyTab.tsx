
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { ExternalLink, University } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const GermanyTab = () => {
  const { t } = useTranslation();
  const daadEmbedUrl = "https://www2.daad.de/deutschland/studienangebote/international-programs/en/?p=l&q=&degree%5B%5D=2&degree%5B%5D=3&fos=0&lang%5B%5D=en&fee=0&sortBy=1&page=1&display=list";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('universityFinder.germany')}</CardTitle>
        <CardDescription>{t('universityFinder.germanyTab.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <iframe
            src={daadEmbedUrl}
            className="w-full h-[70vh]"
            title="DAAD International Programmes"
            style={{ border: 0 }}
            allowFullScreen
          ></iframe>
        </div>
        <Alert className="mt-6">
          <University className="h-4 w-4" />
          <AlertTitle className="font-semibold">{t('universityFinder.germanyTab.iframeError')}</AlertTitle>
          <AlertDescription>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
              <span>{t('universityFinder.germanyTab.iframeErrorDetail')}</span>
              <Button asChild size="sm" className="shrink-0">
                  <a href={daadEmbedUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                      {t('universityFinder.germanyTab.openInNewTab')}
                  </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default GermanyTab;
