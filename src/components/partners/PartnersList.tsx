
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const partnersByCountry = [
  {
    country: "ألمانيا",
    countryFlag: "🇩🇪",
    partners: [
      { name: "FU Academy of Languages – Heidelberg", logoUrl: "/placeholder.svg" },
      { name: "Alpha Aktiv – Heidelberg", logoUrl: "/placeholder.svg" },
      { name: "GoAcademy – Düsseldorf", logoUrl: "/placeholder.svg" },
    ],
  },
  {
    country: "رومانيا",
    countryFlag: "🇷🇴",
    partners: [
      { name: "Bucharest University", logoUrl: "/placeholder.svg" },
      { name: "Carol Davila University of Medicine and Pharmacy", logoUrl: "/placeholder.svg" },
      { name: "Ovidius University", logoUrl: "/placeholder.svg" },
    ],
  },
  {
    country: "الأردن",
    countryFlag: "🇯🇴",
    partners: [
      { name: "جامعة اليرموك", logoUrl: "/placeholder.svg" },
      { name: "UMF Jordan", logoUrl: "/placeholder.svg" },
    ],
  },
];

const PartnersList = () => {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="space-y-12">
          {partnersByCountry.map((group) => (
            <div key={group.country}>
              <h2 className="text-3xl font-bold mb-8 text-center text-primary">
                {group.countryFlag} {group.country}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {group.partners.map((partner) => (
                  <Card key={partner.name} className="flex flex-col items-center justify-center text-center bg-background/70 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <img src={partner.logoUrl} alt={`${partner.name} logo`} className="h-20 w-auto opacity-70 dark:invert" loading="lazy" />
                    </CardHeader>
                    <CardContent className="p-4">
                      <CardTitle className="text-lg font-semibold text-primary">{partner.name}</CardTitle>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnersList;
