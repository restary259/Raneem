
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

const partnersByCountry = [
  {
    country: "ألمانيا",
    countryFlag: "🇩🇪",
    partners: [
      { name: "FU Academy of Languages – Heidelberg", logoUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=300", description: "معهد متخصص في تعليم اللغة الألمانية للطلاب الأجانب في مدينة هايدلبرغ العريقة." },
      { name: "Alpha Aktiv – Heidelberg", logoUrl: "https://images.unsplash.com/photo-1486718448742-163732cd1544?w=300", description: "أكاديمية لغات خاصة تقدم دورات مكثفة للغة الألمانية وتأهيلاً جامعياً." },
      { name: "GoAcademy – Düsseldorf", logoUrl: "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=300", description: "مدرسة لغات معتمدة في دوسلدورف، تقدم دورات لغة واختبارات دولية معتمدة." },
    ],
  },
  {
    country: "رومانيا",
    countryFlag: "🇷🇴",
    partners: [
      { name: "Bucharest University", logoUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=300", description: "واحدة من أعرق الجامعات في رومانيا، وتقدم مجموعة واسعة من التخصصات الأكاديمية." },
      { name: "Carol Davila University of Medicine and Pharmacy", logoUrl: "https://images.unsplash.com/photo-1486718448742-163732cd1544?w=300", description: "جامعة طبية رائدة في بوخارست، تشتهر ببرامج الطب البشري والصيدلة." },
      { name: "Ovidius University", logoUrl: "https://images.unsplash.com/photo-1551038247-3d9af20df552?w=300", description: "جامعة حديثة في مدينة كونستانتسا الساحلية، تقدم برامج متنوعة باللغة الإنجليزية." },
    ],
  },
  {
    country: "الأردن",
    countryFlag: "🇯🇴",
    partners: [
      { name: "جامعة اليرموك", logoUrl: "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=300", description: "واحدة من أكبر الجامعات الحكومية في الأردن، وتقع في مدينة إربد." },
      { name: "UMF Jordan", logoUrl: "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=300", description: "فرع لجامعة 'Iuliu Hațieganu' للطب والصيدلة، يوفر تعليماً طبياً أوروبياً في الأردن." },
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
                      <Card className="flex flex-col items-center justify-start text-center bg-background/70 hover:shadow-lg transition-shadow cursor-pointer h-full">
                        <CardHeader className="p-0 w-full">
                          <img src={partner.logoUrl} alt={`${partner.name} logo`} className="h-40 w-full object-cover rounded-t-md" loading="lazy" />
                        </CardHeader>
                        <CardContent className="p-4 flex-grow flex items-center">
                          <CardTitle className="text-lg font-semibold text-primary">{partner.name}</CardTitle>
                        </CardContent>
                      </Card>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80" dir="rtl">
                      <div className="flex justify-between space-x-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold">{partner.name}</h4>
                          <p className="text-sm">
                            {partner.description}
                          </p>
                        </div>
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
