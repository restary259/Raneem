
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, MessageSquare, Video, ArrowRight } from 'lucide-react';
import { CommunityHighlight } from '@/types/feed';

interface CommunitySpotlightProps {
  highlights: CommunityHighlight[];
}

const CommunitySpotlight: React.FC<CommunitySpotlightProps> = ({ highlights }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'forum': return <MessageSquare className="h-4 w-4" />;
      case 'webinar': return <Video className="h-4 w-4" />;
      case 'event': return <Calendar className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'forum': return 'منتدى';
      case 'webinar': return 'ندوة';
      case 'event': return 'فعالية';
      default: return 'مجتمع';
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          أضواء المجتمع
        </h2>
        <Button variant="ghost" size="sm">
          عرض المزيد
        </Button>
      </div>
      
      {highlights.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد فعاليات مجتمعية حالياً</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {highlights.map((highlight) => (
            <Card key={highlight.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getTypeIcon(highlight.type)}
                    {getTypeLabel(highlight.type)}
                  </Badge>
                  {highlight.participant_count && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {highlight.participant_count}
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg line-clamp-2">
                  {highlight.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {highlight.description}
                </p>
                
                {highlight.date && (
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(highlight.date).toLocaleDateString('ar-SA')}
                  </p>
                )}
                
                <Button variant="outline" size="sm" className="w-full">
                  عرض التفاصيل
                  <ArrowRight className="h-3 w-3 mr-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommunitySpotlight;
