
import { FileText, BookOpen, Book, MapPin, Check, Users, Youtube } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  { icon: FileText, title: "Visa & Residence Permit Guidance" },
  { icon: BookOpen, title: "University Admission Support (Bachelor’s & Master’s)" },
  { icon: Book, title: "Language Course Registration" },
  { icon: MapPin, title: "Accommodation Assistance" },
  { icon: Check, title: "Pre-Departure Preparation" },
  { icon: Users, title: "Ongoing Student Support After Arrival" },
  { icon: Youtube, title: "Marketing & Influencer Collaboration (B2B Service)" },
];

const Services = () => {
  return (
    <section id="services" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Our Services</h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <service.icon className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>{service.title}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
