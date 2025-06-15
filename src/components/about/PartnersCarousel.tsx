
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const partners = [
    { name: "FU Academy of Languages", logoUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=200", countryFlag: "🇩🇪", description: "معهد متخصص في تعليم اللغة الألمانية للطلاب الأجانب في هايدلبرغ." },
    { name: "Alpha Aktiv", logoUrl: "https://images.unsplash.com/photo-1486718448742-163732cd1544?w=200", countryFlag: "🇩🇪", description: "أكاديمية لغات خاصة تقدم دورات مكثفة للغة الألمانية." },
    { name: "GoAcademy", logoUrl: "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=200", countryFlag: "🇩🇪", description: "مدرسة لغات معتمدة في دوسلدورف، تقدم دورات لغة واختبارات معتمدة." },
    { name: "Bucharest University", logoUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=200", countryFlag: "🇷🇴", description: "واحدة من أعرق الجامعات في رومانيا، تقدم مجموعة واسعة من التخصصات." },
    { name: "Carol Davila University", logoUrl: "https://images.unsplash.com/photo-1486718448742-163732cd1544?w=200", countryFlag: "🇷🇴", description: "جامعة طبية رائدة في بوخارست، تشتهر ببرامج الطب والصيدلة." },
    { name: "Ovidius University", logoUrl: "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=200", countryFlag: "🇷🇴", description: "جامعة حديثة في كونستانتسا تقدم برامج متنوعة باللغة الإنجليزية." },
    { name: "جامعة اليرموك", logoUrl: "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=200", countryFlag: "🇯🇴", description: "واحدة من أكبر الجامعات الحكومية في الأردن، تقع في مدينة إربد." },
    { name: "UMF Jordan", logoUrl: "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=200", countryFlag: "🇯🇴", description: "فرع لجامعة 'Iuliu Hațieganu' للطب والصيدلة، يوفر تعليمًا طبيًا أوروبيًا في الأردن." },
];

const PartnersCarousel = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-12 text-primary">شركاؤنا المعتمدون</h2>
      <Carousel
        opts={{
          align: "start",
          loop: true,
          direction: "rtl",
        }}
        className="w-full max-w-4xl mx-auto"
      >
        <CarouselContent>
          {partners.map((partner, index) => (
            <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="p-1 cursor-pointer">
                    <Card className="bg-background/70 overflow-hidden">
                      <CardContent className="flex flex-col items-center justify-start p-0 gap-4 h-52">
                        <img src={partner.logoUrl} alt={partner.name} className="h-28 w-full object-cover" loading="lazy"/>
                        <div className="p-2 text-center">
                          <span className="text-md font-semibold">{partner.countryFlag} {partner.name}</span>
                          <p className="text-sm text-muted-foreground">شريك معتمد</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80" dir="rtl">
                    <div className="flex justify-between space-x-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold">{partner.name}</h4>
                          <p className="text-sm">
                            {partner.description}
                          </p>
                        </div>
                    </div>
                </HoverCardContent>
              </HoverCard>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  </section>
);
export default PartnersCarousel;
