
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const partners = [
  { name: "جامعة هايدلبرغ", logoUrl: "/placeholder.svg", countryFlag: "🇩🇪" },
  { name: "جامعة بوخارست", logoUrl: "/placeholder.svg", countryFlag: "🇷🇴" },
  { name: "الجامعة الأردنية", logoUrl: "/placeholder.svg", countryFlag: "🇯🇴" },
  { name: "جامعة ميونخ التقنية", logoUrl: "/placeholder.svg", countryFlag: "🇩🇪" },
  { name: "جامعة كلوج نابوكا", logoUrl: "/placeholder.svg", countryFlag: "🇷🇴" },
];

const PartnersCarousel = () => (
  <section className="py-12 md:py-24 bg-secondary">
    <div className="container mx-auto px-4 text-center">
      <h2 className="font-cairo text-3xl md:text-4xl font-bold mb-12 text-primary">شركاؤنا المعتمدون</h2>
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
                    <span className="text-lg font-semibold font-cairo">{partner.countryFlag} {partner.name}</span>
                    <p className="text-sm text-muted-foreground">شريك معتمد منذ 2020</p>
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
