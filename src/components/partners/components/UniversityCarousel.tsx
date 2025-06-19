
import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, MapPin, ExternalLink } from 'lucide-react';
import { University } from '../types';
import InteractiveCard from './InteractiveCard';

interface UniversityCarouselProps {
  universities: University[];
  activeCountry: string;
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
}

const UniversityCarousel: React.FC<UniversityCarouselProps> = ({
  universities,
  activeCountry,
  expandedCard,
  setExpandedCard
}) => {
  if (universities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">قريباً: جامعات هذا البلد</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <GraduationCap className="h-6 w-6" />
        الجامعات
      </h3>
      <div className="relative">
        <Carousel 
          className="w-full"
          opts={{
            align: "start",
            loop: true,
          }}
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {universities.map((university, index) => (
              <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <div className="h-full">
                  <InteractiveCard 
                    id={`uni-${activeCountry}-${index}`}
                    isExpanded={expandedCard === `uni-${activeCountry}-${index}`}
                    onToggle={setExpandedCard}
                  >
                    <CardContent className="p-4 md:p-6 h-full flex flex-col">
                      <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                        <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                          <img 
                            src={university.logoUrl} 
                            alt={`${university.name} logo`}
                            className="h-12 md:h-16 w-auto object-contain"
                            loading="lazy"
                          />
                        </div>
                        
                        <div className="space-y-2 flex-grow">
                          <h4 className="text-base md:text-lg font-bold text-primary line-clamp-2">{university.name}</h4>
                          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 justify-center">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{university.location}</span>
                          </p>
                        </div>

                        {expandedCard === `uni-${activeCountry}-${index}` && (
                          <div className="space-y-4 animate-fade-in w-full">
                            <p className="text-xs md:text-sm text-gray-600">{university.description}</p>
                            
                            <div className="space-y-2">
                              <h5 className="font-semibold text-primary text-sm">حقائق رئيسية:</h5>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {university.keyFacts.map((fact, factIndex) => (
                                  <Badge key={factIndex} variant="outline" className="text-xs">
                                    {fact}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <Button asChild className="w-full" size="sm">
                              <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer">
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
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12" />
          <CarouselNext className="hidden md:flex -right-12" />
        </Carousel>
      </div>
    </div>
  );
};

export default UniversityCarousel;
