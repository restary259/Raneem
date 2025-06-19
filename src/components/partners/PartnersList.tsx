
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { universityPartners, servicePartners } from "./partnersData";
import UniversityCard from "./UniversityCard";
import ServiceCard from "./ServiceCard";

const PartnersList = () => {
  const { t } = useTranslation('partners');
  const countries = ['Germany', 'Romania', 'Jordan'] as const;

  // Group services by country
  const servicesByCountry = countries.reduce((acc, country) => {
    acc[country] = servicePartners.filter(service => service.country === country);
    return acc;
  }, {} as Record<string, typeof servicePartners>);

  return (
    <section className="py-12 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="space-y-20">
          
          {/* Universities Section */}
          <div>
            <h2 className="text-3xl font-bold mb-8 text-center text-primary">
              {t('partnersPage.sections.universities')}
            </h2>
            <Tabs defaultValue="Germany" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="Germany">{t('partnersPage.tabs.germany')}</TabsTrigger>
                  <TabsTrigger value="Romania">{t('partnersPage.tabs.romania')}</TabsTrigger>
                  <TabsTrigger value="Jordan">{t('partnersPage.tabs.jordan')}</TabsTrigger>
                </TabsList>
              </div>

              {countries.map(country => (
                <TabsContent key={country} value={country}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in">
                    {universityPartners.filter(p => p.country === country).map((partner) => (
                      <UniversityCard key={partner.name} partner={partner} />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Services Section - Now grouped by country */}
          <div>
            <h2 className="text-3xl font-bold mb-8 text-center text-primary">
              {t('partnersPage.sections.services')}
            </h2>
            <Tabs defaultValue="Germany" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="Germany">{t('partnersPage.tabs.germany')}</TabsTrigger>
                  <TabsTrigger value="Romania">{t('partnersPage.tabs.romania')}</TabsTrigger>
                  <TabsTrigger value="Jordan">{t('partnersPage.tabs.jordan')}</TabsTrigger>
                </TabsList>
              </div>

              {countries.map(country => (
                <TabsContent key={country} value={country}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-fade-in">
                    {servicesByCountry[country]?.map((partner) => (
                      <ServiceCard key={partner.name} partner={partner} />
                    ))}
                    {servicesByCountry[country]?.length === 0 && (
                      <div className="col-span-full text-center text-muted-foreground py-8">
                        لا توجد خدمات متاحة في هذا البلد حالياً
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
          
          {/* Influencers Section - Temporarily hidden
          <div>
            <h2 className="text-3xl font-bold mb-8 text-center text-primary">
              {t('partnersPage.sections.influencers')}
            </h2>
            <Carousel
              plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
              opts={{ align: "start", loop: true }}
              className="w-full max-w-6xl mx-auto"
            >
              <CarouselContent>
                {influencerPartners.map((partner, index) => (
                  <CarouselItem key={index} className="sm:basis-1/2 lg:basis-1/3">
                    <div className="p-1 h-full">
                      <InfluencerCard partner={partner} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          </div>
          */}

        </div>
      </div>
    </section>
  );
};

export default PartnersList;
