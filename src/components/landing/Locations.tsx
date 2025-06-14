
import { MapPin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const locations = [
  {
    country: "Germany",
    cities: "Heidelberg, Nuremberg, Berlin",
    services: "University admission, visa, language schools, residence permits.",
  },
  {
    country: "Jordan",
    cities: "Amman office",
    services: "Student counseling, document collection, translation, embassy coordination.",
  },
  {
    country: "Romania",
    cities: "Bucharest partner institutions",
    services: "Medical and technical university applications, visa prep.",
  },
];

const Locations = () => {
  return (
    <section id="locations" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Where We Work</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Card key={location.country}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  {location.country}
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
