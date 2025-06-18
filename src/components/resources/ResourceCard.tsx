
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, LucideIcon } from 'lucide-react';

interface ResourceCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  link: string;
  category: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  icon: Icon,
  link,
  category
}) => {
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <Badge variant="secondary" className="text-xs">
            {category}
          </Badge>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {description}
        </CardDescription>
        <a 
          href={link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium group-hover:underline"
        >
          <span>زيارة الموقع</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </CardContent>
    </Card>
  );
};

export default ResourceCard;
