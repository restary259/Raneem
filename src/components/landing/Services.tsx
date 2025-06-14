
import { FileText, BookOpen, Book, MapPin, Check, Users, Youtube } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const services = [
  { icon: FileText, title: "إرشادات التأشيرة وتصريح الإقامة" },
  { icon: BookOpen, title: "دعم القبول الجامعي (بكالوريوس وماجستير)" },
  { icon: Book, title: "التسجيل في دورات اللغة" },
  { icon: MapPin, title: "المساعدة في إيجاد سكن" },
  { icon: Check, title: "التحضير قبل المغادرة" },
  { icon: Users, title: "دعم مستمر للطلاب بعد الوصول" },
  { icon: Youtube, title: "التسويق والتعاون مع المؤثرين (خدمة للشركات)" },
];

const Services = () => {
  return (
    <section id="services" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">خدماتنا</h2>
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
