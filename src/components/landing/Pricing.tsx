
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Check } from "lucide-react";

const packages = [
  {
    name: "Basic Package",
    price: "€199",
    description: "Consultation + university application",
    features: ["One-on-one consultation", "University application assistance"],
  },
  {
    name: "Full Package",
    price: "€499",
    description: "Application + visa + housing",
    features: [
      "All Basic features",
      "Visa application guidance",
      "Accommodation search support",
    ],
    popular: true,
  },
  {
    name: "Premium Package",
    price: "€799",
    description: "All of the above + in-country support",
    features: [
      "All Full Package features",
      "Pre-departure briefing",
      "On-arrival support",
    ],
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Packages & Pricing</h2>
          <p className="mt-4 text-lg text-muted-foreground">Affordable & transparent pricing to get you started.</p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <Card key={pkg.name} className={pkg.popular ? "border-primary ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-4xl font-bold">{pkg.price}</div>
                <ul className="space-y-2">
                  {pkg.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={pkg.popular ? "default" : "outline"} asChild>
                  <a href="#contact">Choose Plan</a>
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
