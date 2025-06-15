
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

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
      </CardContent>
    </Card>
  );
};

export default GermanyTab;
