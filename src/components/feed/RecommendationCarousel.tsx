
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Heart, MapPin, Calendar } from 'lucide-react';
import { Recommendation } from '@/types/feed';

interface RecommendationCarouselProps {
  recommendations: Recommendation[];
  onSave: (id: string) => void;
}

const RecommendationCarousel: React.FC<RecommendationCarouselProps> = ({
  recommendations,
  onSave
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">موصى لك</h2>
        <Button variant="ghost" size="sm">
          عرض الكل
        </Button>
      </div>
      
      <Carousel className="w-full">
        <CarouselContent>
          {recommendations.map((rec) => (
            <CarouselItem key={rec.id} className="md:basis-1/2 lg:basis-1/3">
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  {rec.image_url && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                      <img
                        src={rec.image_url}
                        alt={rec.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  <CardTitle className="text-lg mb-2 line-clamp-2">
                    {rec.title}
                  </CardTitle>
                  
                  {rec.partner_name && (
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {rec.partner_name}
                    </p>
                  )}
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {rec.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {rec.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm">
                      التفاصيل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSave(rec.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};

export default RecommendationCarousel;
