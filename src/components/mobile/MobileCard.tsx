
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, ExternalLink, MapPin, Calendar } from 'lucide-react';

interface MobileCardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  badges?: Array<{
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
  location?: string;
  date?: string;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onViewDetails?: () => void;
  ctaText?: string;
  ctaVariant?: 'default' | 'outline' | 'secondary';
  className?: string;
}

const MobileCard: React.FC<MobileCardProps> = ({
  title,
  description,
  imageUrl,
  badges = [],
  location,
  date,
  isFavorite = false,
  onFavoriteToggle,
  onViewDetails,
  ctaText = 'عرض التفاصيل',
  ctaVariant = 'default',
  className = ''
}) => {
  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      {/* Image Section */}
      {imageUrl && (
        <div className="relative aspect-video w-full overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {onFavoriteToggle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onFavoriteToggle}
              className={`absolute top-2 left-2 h-8 w-8 p-0 bg-white/90 hover:bg-white ${
                isFavorite ? 'text-red-500' : 'text-gray-600'
              }`}
              aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
          )}
        </div>
      )}

      <CardHeader className="pb-3">
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {badges.map((badge, index) => (
              <Badge key={index} variant={badge.variant || 'secondary'} className="text-xs">
                {badge.text}
              </Badge>
            ))}
          </div>
        )}

        <CardTitle className="text-lg line-clamp-2 text-right">
          {title}
        </CardTitle>

        {/* Location and Date */}
        {(location || date) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{location}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{date}</span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3 text-right">
            {description}
          </p>
        )}

        {onViewDetails && (
          <Button
            variant={ctaVariant}
            size="sm"
            onClick={onViewDetails}
            className="w-full"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            {ctaText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MobileCard;
