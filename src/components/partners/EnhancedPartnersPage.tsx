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
const allUniversities: University[] = [
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
  },
  // International Universities
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
  },
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
            ? 'scale-107 shadow-2xl border-2 border-orange-400' 
            : 'hover:scale-103 hover:shadow-xl hover:border-orange-200'
          }
          ${className}
        `}
        onClick={() => setExpandedCard(isExpanded ? null : id)}
      >
        {children}
      </Card>
    );
  };

  const renderUniversitiesCarousel = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <GraduationCap className="h-6 w-6" />
        الجامعات
      </h3>
      <div className="relative px-12">
        <Carousel className="w-full">
          <CarouselContent className="-ml-4">
            {allUniversities.map((university, index) => (
              <CarouselItem key={index} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                <InteractiveCard id={`uni-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="bg-white p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center">
                        <img 
                          src={university.logoUrl} 
                          alt={`${university.name} logo`}
                          className="h-16 w-auto object-contain"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-lg font-bold text-primary">{university.name}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {university.location}
                        </p>
                      </div>

                      {expandedCard === `uni-${index}` && (
                        <div className="space-y-4 animate-fade-in">
                          <p className="text-sm text-gray-600">{university.description}</p>
                          
                          <div className="space-y-2">
                            <h5 className="font-semibold text-primary">حقائق رئيسية:</h5>
                            <ul className="space-y-1">
                              {university.keyFacts.map((fact, factIndex) => (
                                <li key={factIndex} className="text-xs text-gray-600 flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{fact}</Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          <Button asChild className="w-full" size="sm">
                            <a href={university.websiteUrl} target="_blank" rel="noopener noreferrer">
                              زيارة الموقع <ExternalLink className="h-4 w-4 mr-2" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </InteractiveCard>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </div>
  );

  const renderLanguageSchools = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        معاهد اللغة
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {germanyLanguageSchools.map((school, index) => (
          <InteractiveCard key={index} id={`school-${index}`}>
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center">
                  <img 
                    src={school.logoUrl} 
                    alt={`${school.name} logo`}
                    className="h-12 w-auto object-contain"
                  />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-primary">{school.name}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {school.location}
                  </p>
                </div>

                {expandedCard === `school-${index}` && (
                  <div className="space-y-4 animate-fade-in">
                    <p className="text-sm text-gray-600">{school.description}</p>
                    
                    <div className="space-y-2">
                      <h5 className="font-semibold text-primary">البرامج المتاحة:</h5>
                      <div className="flex flex-wrap gap-2">
                        {school.programs.map((program, programIndex) => (
                          <Badge key={programIndex} variant="secondary" className="text-xs">
                            {program}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Button asChild className="w-full" size="sm">
                      <a href={school.websiteUrl} target="_blank" rel="noopener noreferrer">
                        زيارة الموقع <ExternalLink className="h-4 w-4 mr-2" />
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </InteractiveCard>
        ))}
      </div>
    </div>
  );

  const renderLocalServices = () => (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
        <Heart className="h-6 w-6" />
        الخدمات المحلية
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {germanyLocalServices.map((service, index) => {
          const IconComponent = getIconForServiceType(service.type);
          return (
            <InteractiveCard key={index} id={`service-${index}`}>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm w-full aspect-video flex items-center justify-center">
                    <img 
                      src={service.logoUrl} 
                      alt={`${service.name} logo`}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold text-primary">{service.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      <IconComponent className="h-3 w-3 mr-1" />
                      {service.type === 'insurance' ? 'تأمين' : 
                       service.type === 'transport' ? 'مواصلات' : 'خدمات'}
                    </Badge>
                  </div>

                  {expandedCard === `service-${index}` && (
                    <div className="space-y-4 animate-fade-in">
                      <p className="text-sm text-gray-600">{service.description}</p>
                      
                      <div className="space-y-2">
                        <h5 className="font-semibold text-primary">المميزات:</h5>
                        <div className="space-y-1">
                          {service.highlights.map((highlight, highlightIndex) => (
                            <div key={highlightIndex} className="text-xs text-gray-600 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{highlight}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <Button asChild className="w-full" size="sm">
                        <a href={service.websiteUrl} target="_blank" rel="noopener noreferrer">
                          زيارة الموقع <ExternalLink className="h-4 w-4 mr-2" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </InteractiveCard>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Country Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {countries.map((country) => (
          <Button
            key={country.code}
            variant={activeCountry === country.code ? "default" : "outline"}
            className={`
              px-6 py-3 rounded-full transition-all duration-200
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
      <div className="space-y-12">
        {activeCountry === 'germany' && (
          <>
            {renderUniversitiesCarousel()}
            {renderLanguageSchools()}
            {renderLocalServices()}
          </>
        )}
        
        {activeCountry === 'romania' && (
          <div className="text-center py-12">
            <p className="text-gray-500">قريباً: محتوى شركاء رومانيا</p>
          </div>
        )}
        
        {activeCountry === 'jordan' && (
          <div className="text-center py-12">
            <p className="text-gray-500">قريباً: محتوى شركاء الأردن</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedPartnersPage;
