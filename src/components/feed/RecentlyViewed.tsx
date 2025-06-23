
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, ExternalLink } from 'lucide-react';
import { RecentView } from '@/types/feed';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RecentlyViewedProps {
  views: RecentView[];
}

const RecentlyViewed: React.FC<RecentlyViewedProps> = ({ views }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5" />
          شوهدت مؤخراً
        </h2>
        <Button variant="ghost" size="sm">
          مسح السجل
        </Button>
      </div>
      
      {views.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>لم تقم بزيارة أي عناصر بعد</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {views.slice(0, 8).map((view) => (
            <Card key={view.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                {view.item_data?.image_url && (
                  <div className="aspect-video w-full overflow-hidden rounded-lg mb-3">
                    <img
                      src={view.item_data.image_url}
                      alt={view.item_data.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <h3 className="font-medium text-sm mb-2 line-clamp-2">
                  {view.item_data?.title || `${view.item_type} ${view.item_id}`}
                </h3>
                
                <p className="text-xs text-muted-foreground mb-2">
                  {formatDistanceToNow(new Date(view.viewed_at), {
                    addSuffix: true,
                    locale: ar
                  })}
                </p>
                
                <Button variant="outline" size="sm" className="w-full">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  إعادة الزيارة
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentlyViewed;
