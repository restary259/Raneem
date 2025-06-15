
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

const partnersByCountry = [
  {
    country: "ألمانيا",
    countryFlag: "🇩🇪",
    partners: [
      { name: "FU Academy of Languages – Heidelberg", location: "Heidelberg", logoUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=400", description: "مدرسة لغات عريقة في هايدلبرغ تقدم برامج ألمانية مكثفة ومعترف بها رسميًا.", partnershipSince: 2023, websiteUrl: "https://www.fuu-heidelberg-languages.com/" },
      { name: "Alpha Aktiv – Heidelberg", location: "Heidelberg", logoUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400", description: "أكاديمية لغات خاصة تقدم دورات مكثفة للغة الألمانية وتأهيلاً جامعياً.", partnershipSince: 2022, websiteUrl: "https://www.alpha-aktiv.de/" },
      { name: "GoAcademy – Düsseldorf", location: "Düsseldorf", logoUrl: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=400", description: "مدرسة لغات معتمدة في دوسلدورف، تقدم دورات لغة واختبارات دولية معتمدة.", partnershipSince: 2023, websiteUrl: "https://www.goacademy.de/" },
    ],
  },
  {
    country: "رومانيا",
    countryFlag: "🇷🇴",
    partners: [
      { name: "University of Bucharest", location: "Bucharest", logoUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400", description: "واحدة من أعرق الجامعات في رومانيا، وتقدم مجموعة واسعة من التخصصات الأكاديمية.", partnershipSince: 2022, websiteUrl: "https://unibuc.ro/" },
      { name: "Carol Davila University of Medicine and Pharmacy", location: "Bucharest", logoUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400", description: "جامعة طبية رائدة في بوخارست، تشتهر ببرامج الطب البشري والصيدلة.", partnershipSince: 2021, websiteUrl: "https://www.umfcd.ro/" },
      { name: "Ovidius University", location: "Constanța", logoUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400", description: "جامعة حديثة في مدينة كونستانتسا الساحلية، تقدم برامج متنوعة باللغة الإنجليزية.", partnershipSince: 2023, websiteUrl: "https://www.univ-ovidius.ro/" },
    ],
  },
  {
    country: "الأردن",
    countryFlag: "🇯🇴",
    partners: [
      { name: "جامعة اليرموك", location: "Irbid", logoUrl: "https://images.unsplash.com/photo-1607237138185-e8945c94b9ac?w=400", description: "واحدة من أكبر الجامعات الحكومية في الأردن، وتقع في مدينة إربد.", partnershipSince: 2020, websiteUrl: "https://www.yu.edu.jo/" },
      { name: "UMF Jordan", location: "Amman", logoUrl: "https://images.unsplash.com/photo-1627916575236-3988588f172a?w=400", description: "فرع لجامعة 'Iuliu Hațieganu' للطب والصيدلة، يوفر تعليماً طبياً أوروبياً في الأردن.", partnershipSince: 2022, websiteUrl: "https://umf-jordan.com/" },
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
                  <HoverCard key={partner.name}>
                    <HoverCardTrigger asChild>
                      <Card className="flex flex-col items-center justify-start text-center bg-card hover:shadow-lg transition-shadow cursor-pointer h-full overflow-hidden">
                        <CardHeader className="p-0 w-full">
                          <img src={partner.logoUrl} alt={`${partner.name} logo`} className="h-40 w-full object-cover" loading="lazy" />
                        </CardHeader>
                        <CardContent className="p-4 flex-grow flex flex-col items-center justify-center w-full">
                          <CardTitle className="text-lg font-semibold text-primary">{partner.name}</CardTitle>
                          <CardDescription className="text-sm text-muted-foreground mt-1">{partner.location}</CardDescription>
                        </CardContent>
                      </Card>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" dir="rtl">
                      <div className="flex flex-col gap-4">
                        <div className="space-y-1 text-right">
                          <h4 className="text-base font-bold text-primary">{partner.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {partner.description}
                          </p>
                        </div>
                        <div className="space-y-2 text-sm text-right">
                          <p><span className="font-semibold">شريكنا منذ:</span> {partner.partnershipSince}</p>
                          <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline hover:text-accent transition-colors">
                            الموقع الرسمي 
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                        <Button asChild className="w-full" variant="accent">
                          <Link to="/contact">استفسر الآن</Link>
                        </Button>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
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
