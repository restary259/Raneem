
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ExternalLink, MapPin, GraduationCap, Building2, Heart } from 'lucide-react';

interface University {
  name: string;
  logoUrl: string;
  location: string;
  description: string;
  websiteUrl: string;
  keyFacts: string[];
}

interface LanguageSchool {
  name: string;
  logoUrl: string;
  location: string;
  description: string;
  websiteUrl: string;
  programs: string[];
}

interface LocalService {
  name: string;
  logoUrl: string;
  type: 'insurance' | 'transport' | 'telecom' | 'housing';
  description: string;
  websiteUrl: string;
  highlights: string[];
}

// Complete TU9 Universities + Additional Partners
const germanyUniversities: University[] = [
  {
    name: "RWTH Aachen",
    logoUrl: "/lovable-uploads/rwth-aachen.png",
    location: "آخن، ألمانيا",
    description: "واحدة من أفضل الجامعات التقنية في أوروبا، متخصصة في الهندسة والتكنولوجيا.",
    websiteUrl: "https://www.rwth-aachen.de/",
    keyFacts: ["تأسست عام 1870", "45,000+ طالب", "قوية في الهندسة الميكانيكية"]
  },
  {
    name: "TU Berlin",
    logoUrl: "/lovable-uploads/tu-berlin.png",
    location: "برلين، ألمانيا",
    description: "جامعة تقنية رائدة في قلب العاصمة الألمانية.",
    websiteUrl: "https://www.tu-berlin.de/",
    keyFacts: ["تأسست عام 1879", "35,000+ طالب", "مركز للابتكار التقني"]
  },
  {
    name: "TU Munich",
    logoUrl: "/lovable-uploads/tu-munich.png",
    location: "ميونخ، ألمانيا",
    description: "جامعة تقنية عالمية المستوى مع تركيز قوي على البحث والابتكار.",
    websiteUrl: "https://www.tum.de/",
    keyFacts: ["تأسست عام 1868", "50,000+ طالب", "متقدمة في الذكاء الاصطناعي"]
  },
  {
    name: "TU Dresden",
    logoUrl: "/lovable-uploads/tu-dresden.png",
    location: "درسدن، ألمانيا",
    description: "جامعة تقنية مرموقة مع تركيز على الهندسة والعلوم التطبيقية.",
    websiteUrl: "https://tu-dresden.de/",
    keyFacts: ["تأسست عام 1828", "32,000+ طالب", "قوية في الهندسة الكهربائية"]
  },
  {
    name: "TU Dortmund",
    logoUrl: "/lovable-uploads/tu-dortmund.png",
    location: "دورتموند، ألمانيا",
    description: "جامعة حديثة متخصصة في التكنولوجيا وعلوم الحاسوب.",
    websiteUrl: "https://www.tu-dortmund.de/",
    keyFacts: ["تأسست عام 1968", "34,000+ طالب", "رائدة في علوم الحاسوب"]
  },
  {
    name: "TU Darmstadt",
    logoUrl: "/lovable-uploads/tu-darmstadt.png", 
    location: "دارمشتات، ألمانيا",
    description: "جامعة تقنية متميزة في الهندسة والعلوم الطبيعية.",
    websiteUrl: "https://www.tu-darmstadt.de/",
    keyFacts: ["تأسست عام 1877", "25,000+ طالب", "متقدمة في الهندسة المدنية"]
  },
  {
    name: "TU Braunschweig",
    logoUrl: "/lovable-uploads/tu-braunschweig.png",
    location: "براونشفايغ، ألمانيا", 
    description: "أقدم جامعة تقنية في ألمانيا، متخصصة في الطيران والهندسة.",
    websiteUrl: "https://www.tu-braunschweig.de/",
    keyFacts: ["تأسست عام 1745", "20,000+ طالب", "رائدة في هندسة الطيران"]
  },
  {
    name: "Karlsruhe Institute of Technology",
    logoUrl: "/lovable-uploads/kit-karlsruhe.png",
    location: "كارلسروه، ألمانيا",
    description: "معهد تقني عالمي المستوى يجمع بين التعليم والبحث العلمي.",
    websiteUrl: "https://www.kit.edu/",
    keyFacts: ["تأسست عام 2009", "25,000+ طالب", "قوية في الفيزياء والهندسة"]
  },
  {
    name: "University of Stuttgart", 
    logoUrl: "/lovable-uploads/uni-stuttgart.png",
    location: "شتوتغارت، ألمانيا",
    description: "جامعة تقنية مرموقة متخصصة في الهندسة والعلوم التطبيقية.",
    websiteUrl: "https://www.uni-stuttgart.de/",
    keyFacts: ["تأسست عام 1829", "27,000+ طالب", "متميزة في هندسة السيارات"]
  }
];

const romaniaUniversities: University[] = [
  {
    name: "Carol Davila University of Medicine and Pharmacy",
    logoUrl: "/lovable-uploads/dfca3402-c6b9-4560-88d7-6e8c19f26ab4.png",
    location: "بوخارست، رومانيا",
    description: "جامعة طبية عريقة ومرموقة في أوروبا الشرقية.",
    websiteUrl: "https://www.umfcd.ro/",
    keyFacts: ["تأسست عام 1857", "8,000+ طالب", "معترف بها دولياً"]
  },
  {
    name: "Ovidius University",
    logoUrl: "/lovable-uploads/03767a14-eafc-4beb-8e8f-12a2491e4ee5.png",
    location: "كونستانتا، رومانيا", 
    description: "جامعة شاملة تقدم برامج متنوعة في الهندسة والاقتصاد.",
    websiteUrl: "https://www.univ-ovidius.ro/",
    keyFacts: ["تأسست عام 1961", "15,000+ طالب", "قوية في الهندسة البحرية"]
  }
];

const jordanUniversities: University[] = [
  {
    name: "جامعة اليرموك",
    logoUrl: "/lovable-uploads/125fa6e2-60ae-4bd0-91bb-a2b2dc342ebd.png",
    location: "إربد، الأردن",
    description: "جامعة أردنية رائدة في التعليم العالي والبحث العلمي.",
    websiteUrl: "https://www.yu.edu.jo/",
    keyFacts: ["تأسست عام 1976", "40,000+ طالب", "متميزة في الهندسة وتكنولوجيا المعلومات"]
  }
];

const germanyLanguageSchools: LanguageSchool[] = [
  {
    name: "F+U Academy of Languages",
    logoUrl: "/lovable-uploads/e7298181-bfde-4ee6-b5cb-a310ab735b61.png",
    location: "هايدلبرغ، ألمانيا",
    description: "أكاديمية لغات متخصصة في تعليم الألمانية للطلاب الدوليين.",
    websiteUrl: "https://www.fuu-heidelberg-languages.com/",
    programs: ["دورات مكثفة", "إعداد للجامعة", "دورات مسائية"]
  },
  {
    name: "Alpha Aktiv",
    logoUrl: "/lovable-uploads/171c7fae-8d36-4d06-a429-e3726c4417b8.png",
    location: "هايدلبرغ، ألمانيا",
    description: "معهد متخصص في تعليم اللغة الألمانية والتأهيل الجامعي.",
    websiteUrl: "https://www.alpha-heidelberg.de/",
    programs: ["دورات عامة", "تحضير للامتحانات", "برامج مهنية"]
  }
];

const germanyLocalServices: LocalService[] = [
  {
    name: "Techniker Krankenkasse",
    logoUrl: "/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png",
    type: "insurance",
    description: "واحدة من كبرى شركات التأمين الصحي في ألمانيا.",
    websiteUrl: "https://www.tk.de/",
    highlights: ["تغطية شاملة", "خدمة عملاء متميزة", "مناسب للطلاب"]
  },
  {
    name: "Deutsche Bahn",
    logoUrl: "/lovable-uploads/c4ad72df-424f-4051-b509-d3e1253f49f2.png",
    type: "transport",
    description: "شبكة السكك الحديدية الوطنية في ألمانيا.",
    websiteUrl: "https://www.bahn.de/",
    highlights: ["خصومات للطلاب", "شبكة واسعة", "مواصلات موثوقة"]
  }
];

const countries = [
  { code: 'germany', name: 'ألمانيا', flag: '🇩🇪' },
  { code: 'romania', name: 'رومانيا', flag: '🇷🇴' },
  { code: 'jordan', name: 'الأردن', flag: '🇯🇴' }
];

const EnhancedPartnersPage = () => {
  const { t } = useTranslation('partners');
  const [activeCountry, setActiveCountry] = useState('germany');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const getIconForServiceType = (type: string) => {
    switch (type) {
      case 'insurance': return Heart;
      case 'transport': return MapPin;
      case 'telecom': return Building2;
      case 'housing': return Building2;
      default: return Building2;
    }
  };

  const getUniversitiesForCountry = (country: string): University[] => {
    switch (country) {
      case 'germany': return germanyUniversities;
      case 'romania': return romaniaUniversities;
      case 'jordan': return jordanUniversities;
      default: return [];
    }
  };

  const InteractiveCard = ({ 
    children, 
    id, 
    className = "" 
  }: { 
    children: React.ReactNode; 
    id: string; 
    className?: string;
  }) => {
    const isExpanded = expandedCard === id;
    
    return (
      <Card 
        className={`
          transition-all duration-300 cursor-pointer h-full
          ${isExpanded 
            ? 'scale-105 shadow-2xl border-2 border-orange-400 z-10' 
            : 'hover:scale-102 hover:shadow-xl hover:border-orange-200'
          }
          ${className}
        `}
        onClick={() => setExpandedCard(isExpanded ? null : id)}
      >
        {children}
      </Card>
    );
  };

  const renderUniversitiesCarousel = () => {
    const universities = getUniversitiesForCountry(activeCountry);
    
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
                    <InteractiveCard id={`uni-${activeCountry}-${index}`}>
                      <CardContent className="p-4 md:p-6 h-full flex flex-col">
                        <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                            <img 
                              src={university.logoUrl} 
                              alt={`${university.name} logo`}
                              className="h-12 md:h-16 w-auto object-contain"
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

  const renderLanguageSchools = () => {
    if (activeCountry !== 'germany') return null;
    
    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          معاهد اللغة
        </h3>
        <div className="relative">
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {germanyLanguageSchools.map((school, index) => (
                <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                  <div className="h-full">
                    <InteractiveCard id={`school-${index}`}>
                      <CardContent className="p-4 md:p-6 h-full flex flex-col">
                        <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                          <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                            <img 
                              src={school.logoUrl} 
                              alt={`${school.name} logo`}
                              className="h-10 md:h-12 w-auto object-contain"
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

  const renderLocalServices = () => {
    if (activeCountry !== 'germany') return null;
    
    return (
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Heart className="h-6 w-6" />
          الخدمات المحلية
        </h3>
        <div className="relative">
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {germanyLocalServices.map((service, index) => {
                const IconComponent = getIconForServiceType(service.type);
                return (
                  <CarouselItem key={index} className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                    <div className="h-full">
                      <InteractiveCard id={`service-${index}`}>
                        <CardContent className="p-4 md:p-6 h-full flex flex-col">
                          <div className="flex flex-col items-center text-center space-y-4 flex-grow">
                            <div className="bg-white p-3 md:p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center border">
                              <img 
                                src={service.logoUrl} 
                                alt={`${service.name} logo`}
                                className="h-10 md:h-12 w-auto object-contain"
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
                ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-12" />
            <CarouselNext className="hidden md:flex -right-12" />
          </Carousel>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Country Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {countries.map((country) => (
          <Button
            key={country.code}
            variant={activeCountry === country.code ? "default" : "outline"}
            className={`
              px-4 md:px-6 py-2 md:py-3 rounded-full transition-all duration-200 text-sm md:text-base
              ${activeCountry === country.code 
                ? 'bg-primary text-white shadow-lg border-b-4 border-orange-400' 
                : 'hover:bg-primary/10'
              }
            `}
            onClick={() => setActiveCountry(country.code)}
          >
            <span className="text-lg mr-2">{country.flag}</span>
            {country.name}
          </Button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-8 md:space-y-12">
        {renderUniversitiesCarousel()}
        {renderLanguageSchools()}
        {renderLocalServices()}
      </div>
    </div>
  );
};

export default EnhancedPartnersPage;
