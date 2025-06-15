
import { MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const locations = [
  {
    country: "ألمانيا",
    cities: "هايدلبرغ، نورمبرغ، برلين",
    services: "القبول الجامعي، التأشيرة، مدارس اللغة، تصاريح الإقامة.",
  },
  {
    country: "الأردن",
    cities: "مكتب عمان",
    services: "استشارات للطلاب، جمع المستندات، الترجمة، التنسيق مع السفارات.",
  },
  {
    country: "رومانيا",
    cities: "مؤسسات شريكة في بوخارست",
    services: "طلبات الالتحاق بالجامعات الطبية والتقنية، التحضير للتأشيرة.",
  },
  {
    country: "إيطاليا",
    cities: "فلورنسا (قريباً)",
    services: "خدمات جديدة ستتوفر قريباً.",
  },
];

const Locations = () => {
  return (
    <section id="locations" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">أماكن عملنا</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card key={location.country} className="text-right">
              <CardHeader>
                <CardTitle className="flex items-center justify-end gap-2">
                  {location.country}
                  <MapPin className="h-6 w-6 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{location.cities}</p>
                <p className="mt-2 text-muted-foreground">{location.services}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Locations;
