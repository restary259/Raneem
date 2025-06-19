
import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, ExternalLink } from 'lucide-react';
import { LanguageSchool } from '../types';
import InteractiveCard from './InteractiveCard';

interface LanguageSchoolCarouselProps {
  schools: LanguageSchool[];
  expandedCard: string | null;
  setExpandedCard: (id: string | null) => void;
}

const LanguageSchoolCarousel: React.FC<LanguageSchoolCarouselProps> = ({
  schools,
  expandedCard,
  setExpandedCard
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        معاهد اللغة
      </h3>
      <div className="relative">
        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4">
            {schools.map((school, index) => (
              <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                <div className="h-full">
                  <InteractiveCard 
                    id={`school-${index}`}
                    isExpanded={expandedCard === `school-${index}`}
                    onToggle={setExpandedCard}
                  >
                    <CardContent className="p-4 md:p-6 h-full flex flex-col">
                      <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                        <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                          <img 
                            src={school.logoUrl} 
                            alt={`${school.name} logo`}
                            className="h-10 md:h-12 w-auto object-contain"
                            loading="lazy"
                          />
                        </div>
                        
                        <div className="space-y-2 flex-grow">
                          <h4 className="text-base md:text-lg font-bold text-primary line-clamp-2">{school.name}</h4>
                          <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1 justify-center">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{school.location}</span>
                          </p>
                        </div>

                        {expandedCard === `school-${index}` && (
                          <div className="space-y-4 animate-fade-in w-full">
                            <p className="text-xs md:text-sm text-gray-600">{school.description}</p>
                            
                            <div className="space-y-2">
                              <h5 className="font-semibold text-primary text-sm">البرامج المتاحة:</h5>
                              <div className="flex flex-wrap gap-1 justify-center">
                                {school.programs.map((program, programIndex) => (
                                  <Badge key={programIndex} variant="secondary" className="text-xs">
                                    {program}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <Button asChild className="w-full" size="sm">
                              <a href={school.websiteUrl} target="_blank" rel="noopener noreferrer">
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

export default LanguageSchoolCarousel;
