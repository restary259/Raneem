import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const packages = [
  {
    name: "الباقة الأساسية",
    price: "€199",
    description: "استشارة + طلب جامعي",
    features: ["استشارة فردية", "المساعدة في طلب الجامعة"],
  },
  {
    name: "الباقة الكاملة",
    price: "€499",
    description: "طلب + تأشيرة + سكن",
    features: [
      "جميع مزايا الباقة الأساسية",
      "إرشادات طلب التأشيرة",
      "دعم البحث عن سكن",
    ],
    popular: true,
  },
  {
    name: "الباقة المميزة",
    price: "€799",
    description: "كل ما سبق + دعم داخل البلد",
    features: [
      "جميع مزايا الباقة الكاملة",
      "إحاطة قبل المغادرة",
      "دعم عند الوصول",
    ],
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">الباقات والأسعار</h2>
          <p className="mt-4 text-lg text-muted-foreground">أسعار معقولة وشفافة لتبدأ رحلتك.</p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.name} className={pkg.popular ? "border-primary ring-2 ring-primary text-right" : "text-right"}>
              <CardHeader>
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold text-left">{pkg.price}</div>
                <ul className="space-y-2">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 flex-row-reverse">
                      <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <span className="flex-1">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={pkg.popular ? "accent" : "outline"} asChild>
                  <Link to="/contact">اختر الباقة</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
