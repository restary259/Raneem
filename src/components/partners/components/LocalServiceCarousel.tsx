
import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, Building2, ExternalLink } from 'lucide-react';
import { LocalService } from '../types';
import InteractiveCard from './InteractiveCard';

interface LocalServiceCarouselProps {
  services: LocalService[];
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
}

const LocalServiceCarousel: React.FC<LocalServiceCarouselProps> = ({
  services,
  expandedCard,
  setExpandedCard
}) => {
  const getIconForServiceType = (type: string) => {
    switch (type) {
      case 'insurance': return Heart;
      case 'transport': return MapPin;
      case 'telecom': return Building2;
      case 'housing': return Building2;
      default: return Building2;
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <Heart className="h-6 w-6" />
        الخدمات المحلية
      </h3>
      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {services.map((service, index) => {
              const IconComponent = getIconForServiceType(service.type);
              return (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                  <div className="h-full">
                    <InteractiveCard 
                      id={`service-${index}`}
                      isExpanded={expandedCard === `service-${index}`}
                      onToggle={setExpandedCard}
                    >
                      <CardContent className="p-4 md:p-6 h-full flex flex-col">
                        <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                            <img 
                              src={service.logoUrl} 
                              alt={`${service.name} logo`}
                              className="h-10 md:h-12 w-auto object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          
                          <div className="space-y-2 flex-grow">
                            <h4 className="text-base md:text-lg font-bold text-primary line-clamp-2">{service.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              <IconComponent className="h-3 w-3 mr-1" />
                              {service.type === 'insurance' ? 'تأمين' : 
                               service.type === 'transport' ? 'مواصلات' : 'خدمات'}
                            </Badge>
                          </div>

                          {expandedCard === `service-${index}` && (
                            <div className="space-y-4 animate-fade-in w-full">
                              <p className="text-xs md:text-sm text-gray-600">{service.description}</p>
                              
                              <div className="space-y-2">
                                <h5 className="font-semibold text-primary text-sm">المميزات:</h5>
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {service.highlights.map((highlight, highlightIndex) => (
                                    <Badge key={highlightIndex} variant="outline" className="text-xs">
                                      {highlight}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              
                              <Button asChild className="w-full" size="sm">
                                <a href={service.websiteUrl} target="_blank" rel="noopener noreferrer">
                                  زيارة الموقع <ExternalLink className="h-3 w-3 mr-2" />
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </InteractiveCard>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12" />
          <CarouselNext className="hidden md:flex -right-12" />
        </Carousel>
      </div>
    </div>
  );
};

export default LocalServiceCarousel;
