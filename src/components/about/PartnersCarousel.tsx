
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const partners = [
  { name: "FU Academy of Languages", logoUrl: "/placeholder.svg", countryFlag: "🇩🇪" },
  { name: "Alpha Aktiv", logoUrl: "/placeholder.svg", countryFlag: "🇩🇪" },
  { name: "GoAcademy", logoUrl: "/placeholder.svg", countryFlag: "🇩🇪" },
  { name: "Bucharest University", logoUrl: "/placeholder.svg", countryFlag: "🇷🇴" },
  { name: "Carol Davila University", logoUrl: "/placeholder.svg", countryFlag: "🇷🇴" },
  { name: "Ovidius University", logoUrl: "/placeholder.svg", countryFlag: "🇷🇴" },
  { name: "جامعة اليرموك", logoUrl: "/placeholder.svg", countryFlag: "🇯🇴" },
  { name: "UMF Jordan", logoUrl: "/placeholder.svg", countryFlag: "🇯🇴" },
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
              <div className="p-1">
                <Card className="bg-background/70">
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-4 h-52">
                    <img src={partner.logoUrl} alt={partner.name} className="h-16 w-auto opacity-60 invert-0 dark:invert" loading="lazy"/>
                    <span className="text-lg font-semibold">{partner.countryFlag} {partner.name}</span>
                    <p className="text-sm text-muted-foreground">شريك معتمد</p>
                  </CardContent>
                </Card>
              </div>
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
