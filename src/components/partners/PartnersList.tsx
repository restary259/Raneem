
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink, Instagram } from "lucide-react";
import TikTokIcon from "../icons/TikTokIcon";

const partnerCategories = [
  {
    title: "الجامعات والكليات",
    partners: [
      { type: 'university', name: "University of Bucharest", location: "Bucharest, Romania", logoUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400", description: "واحدة من أعرق الجامعات في رومانيا، وتقدم مجموعة واسعة من التخصصات الأكاديمية.", partnershipSince: 2022, websiteUrl: "https://unibuc.ro/" },
      { type: 'university', name: "Carol Davila University of Medicine and Pharmacy", location: "Bucharest, Romania", logoUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400", description: "جامعة طبية رائدة في بوخارست، تشتهر ببرامج الطب البشري والصيدلة.", partnershipSince: 2021, websiteUrl: "https://www.umfcd.ro/" },
      { type: 'university', name: "Ovidius University", location: "Constanța, Romania", logoUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400", description: "جامعة حديثة في مدينة كونستانتسا الساحلية، تقدم برامج متنوعة باللغة الإنجليزية.", partnershipSince: 2023, websiteUrl: "https://www.univ-ovidius.ro/" },
      { type: 'university', name: "جامعة اليرموك", location: "Irbid, Jordan", logoUrl: "https://images.unsplash.com/photo-1607237138185-e8945c94b9ac?w=400", description: "واحدة من أكبر الجامعات الحكومية في الأردن، وتقع في مدينة إربد.", partnershipSince: 2020, websiteUrl: "https://www.yu.edu.jo/" },
      { type: 'university', name: "UMF Jordan", location: "Amman, Jordan", logoUrl: "https://images.unsplash.com/photo-1627916575236-3988588f172a?w=400", description: "فرع لجامعة 'Iuliu Hațieganu' للطب والصيدلة، يوفر تعليماً طبياً أوروبياً في الأردن.", partnershipSince: 2022, websiteUrl: "https://umf-jordan.com/" },
    ],
  },
  {
    title: "معاهد اللغة",
    partners: [
      { type: 'school', name: "FU Academy of Languages – Heidelberg", location: "Heidelberg, Germany", logoUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=400", description: "مدرسة لغات عريقة في هايدلبرغ تقدم برامج ألمانية مكثفة ومعترف بها رسميًا.", partnershipSince: 2023, websiteUrl: "https://www.fuu-heidelberg-languages.com/" },
      { type: 'school', name: "Alpha Aktiv – Heidelberg", location: "Heidelberg, Germany", logoUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400", description: "أكاديمية لغات خاصة تقدم دورات مكثفة للغة الألمانية وتأهيلاً جامعياً.", partnershipSince: 2022, websiteUrl: "https://www.alpha-aktiv.de/" },
      { type: 'school', name: "GoAcademy – Düsseldorf", location: "Düsseldorf, Germany", logoUrl: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=400", description: "مدرسة لغات معتمدة في دوسلدورف، تقدم دورات لغة واختبارات دولية معتمدة.", partnershipSince: 2023, websiteUrl: "https://www.goacademy.de/" },
    ],
  },
  {
    title: "المؤثرون وصناع المحتوى",
    partners: [
      { type: 'influencer', name: "سارة ترافلز", location: "صانعة محتوى", logoUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80", description: "أشارك تجربتي في الدراسة بالخارج لإلهام الطلاب.", socials: { instagram: "sara.travels" } },
      { type: 'influencer', name: "علي يدرس", location: "صانع محتوى", logoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80", description: "كل ما يخص الحياة الجامعية في ألمانيا من الألف إلى الياء.", socials: { tiktok: "ali.studies" } },
      { type: 'influencer', name: "مها حول العالم", location: "صانعة محتوى", logoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80", description: "خبيرة في الحصول على منح دراسية مجانية.", socials: { instagram: "maha.world", tiktok: "maha.world" } },
    ]
  }
];

const PartnersList = () => {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="space-y-16">
          {partnerCategories.map((category) => (
            <div key={category.title} className="animate-fade-in">
              <h2 className="text-3xl font-bold mb-8 text-center text-primary">
                {category.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {category.partners.map((partner: any) => (
                  <HoverCard key={partner.name}>
                    <HoverCardTrigger asChild>
                      <Card className="flex flex-col items-center justify-start text-center bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer h-full overflow-hidden rounded-lg">
                        <CardHeader className="p-0 w-full relative">
                          <img src={partner.logoUrl} alt={`${partner.name} logo`} className="h-48 w-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-0 p-4 text-right w-full">
                            <CardTitle className="text-lg font-bold text-white">{partner.name}</CardTitle>
                            <CardDescription className="text-sm text-white/90 mt-1">{partner.location}</CardDescription>
                          </div>
                        </CardHeader>
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
                        
                        {partner.type !== 'influencer' ? (
                          <div className="space-y-2 text-sm text-right">
                            <p><span className="font-semibold">شريكنا منذ:</span> {partner.partnershipSince}</p>
                            <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline hover:text-accent transition-colors">
                              الموقع الرسمي 
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm text-right">
                            <p className="font-semibold">تابعنا على:</p>
                            <div className="flex items-center justify-end gap-4">
                              {partner.socials?.instagram && (
                                <a href={`https://instagram.com/${partner.socials.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline hover:text-accent transition-colors">
                                  <Instagram className="h-5 w-5" />
                                  <span>Instagram</span>
                                </a>
                              )}
                              {partner.socials?.tiktok && (
                                <a href={`https://tiktok.com/@${partner.socials.tiktok}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline hover:text-accent transition-colors">
                                  <TikTokIcon className="h-5 w-5 fill-current" />
                                  <span>TikTok</span>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
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
