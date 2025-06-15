
import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ResourceCardProps {
  title: string;
  description: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ title, description, fileUrl, fileType = 'PDF', fileSize }) => {
  const { t } = useTranslation('resources');
  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-lg">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        {/* Intentionally empty to push footer to bottom */}
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/50 p-4">
        <div className="text-sm text-muted-foreground">
          <span>{fileType === 'PDF' ? t('resourcesPage.fileTypePDF') : fileType}</span>
          {fileSize && <span className="mx-2">&middot;</span>}
          {fileSize && <span>{fileSize}</span>}
        </div>
        <Button asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download>
            {t('resourcesPage.download')}
            <Download className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ResourceCard;
