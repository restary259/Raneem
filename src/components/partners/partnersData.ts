
import { University, Service, Influencer } from '@/lib/types';

export const universityPartners: University[] = [
  // Romania
  { type: 'university', name: "University of Bucharest", country: "Romania", location: "Bucharest, Romania", logoUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400", partnershipSince: 2022, specializations: ["أعمال", "علوم إنسانية", "علوم"], websiteUrl: "https://unibuc.ro/" },
  { type: 'university', name: "Carol Davila University of Medicine and Pharmacy", country: "Romania", location: "Bucharest, Romania", logoUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400", partnershipSince: 2021, specializations: ["طب بشري", "صيدلة"], websiteUrl: "https://www.umfcd.ro/" },
  { type: 'university', name: "Ovidius University", country: "Romania", location: "Constanța, Romania", logoUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400", partnershipSince: 2023, specializations: ["هندسة", "اقتصاد"], websiteUrl: "https://www.univ-ovidius.ro/" },
  // Jordan
  { type: 'university', name: "جامعة اليرموك", country: "Jordan", location: "Irbid, Jordan", logoUrl: "https://images.unsplash.com/photo-1607237138185-e8945c94b9ac?w=400", partnershipSince: 2020, specializations: ["هندسة", "تكنولوجيا المعلومات", "فنون"], websiteUrl: "https://www.yu.edu.jo/" },
  { type: 'university', name: "UMF Jordan", country: "Jordan", location: "Amman, Jordan", logoUrl: "https://images.unsplash.com/photo-1627916575236-3988588f172a?w=400", partnershipSince: 2022, specializations: ["طب", "صيدلة"], websiteUrl: "https://umf-jordan.com/" },
  // Germany (Language Schools)
  { type: 'school', name: "FU Academy of Languages – Heidelberg", country: "Germany", location: "Heidelberg, Germany", logoUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=400", partnershipSince: 2023, specializations: ["لغة ألمانية"], websiteUrl: "https://www.fuu-heidelberg-languages.com/" },
  { type: 'school', name: "Alpha Aktiv – Heidelberg", country: "Germany", location: "Heidelberg, Germany", logoUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400", partnershipSince: 2022, specializations: ["لغة ألمانية", "تأهيل جامعي"], websiteUrl: "https://www.alpha-aktiv.de/" },
  { type: 'school', name: "GoAcademy – Düsseldorf", country: "Germany", location: "Düsseldorf, Germany", logoUrl: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=400", partnershipSince: 2023, specializations: ["لغة ألمانية", "لغة إنجليزية"], websiteUrl: "https://www.goacademy.de/" },
];

export const servicePartners: Service[] = [
  { type: 'service', name: "Wise", logoUrl: "https://images.unsplash.com/photo-1614294149010-ab3f7422aab4?w=400", description: "تحويلات مالية دولية برسوم منخفضة وسعر صرف حقيقي.", supported_countries: ["عالمي"], languages: ["العربية", "الإنجليزية", "الألمانية"], darb_benefit: "تحويل أول مجاني حتى 500£" },
  { type: 'service', name: "Techniker Krankenkasse", logoUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400", description: "أحد أكبر شركات التأمين الصحي الحكومي في ألمانيا، ويوفر تغطية شاملة للطلاب.", supported_countries: ["ألمانيا"], languages: ["الألمانية", "الإنجليزية"], darb_benefit: "دعم ومساعدة بالعربية" },
  { type: 'service', name: "Deutsche Bahn", logoUrl: "https://images.unsplash.com/photo-1591253994323-3a5e664a8569?w=400", description: "شركة السكك الحديدية الوطنية في ألمانيا، توفر خيارات سفر متنوعة وبطاقات خصم للطلاب.", supported_countries: ["ألمانيا"], languages: ["الألمانية", "الإنجليزية"] },
  { type: 'service', name: "ImmoScout24", logoUrl: "https://images.unsplash.com/photo-1560518883-ce09059ee41f?w=400", description: "منصة رائدة للبحث عن سكن وشقق للإيجار في جميع أنحاء ألمانيا.", supported_countries: ["ألمانيا"], languages: ["الألمانية"], darb_benefit: "دليل استخدام المنصة" },
];

export const influencerPartners: Influencer[] = [
  { type: 'influencer', name: "سارة ترافلز", username: "sara.travels", avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400", country: "الإمارات", followers: "210ألف", quote: "مع دارب، كانت تجربتي في الحصول على قبول جامعي أسهل بكثير.", specialization: "السفر والدراسة بالخارج", socials: { instagram: "sara.travels" } },
  { type: 'influencer', name: "علي يدرس", username: "ali.studies", avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400", country: "ألمانيا", followers: "150ألف", quote: "أشارك كل ما يخص الحياة الجامعية في ألمانيا من الألف إلى الياء.", specialization: "الحياة الطلابية في ألمانيا", socials: { tiktok: "ali.studies" } },
  { type: 'influencer', name: "مها حول العالم", username: "maha.world", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", country: "الأردن", followers: "300ألف", quote: "خبيرة في الحصول على منح دراسية مجانية، وتجربتي مع دارب كانت ممتازة.", specialization: "المنح الدراسية", socials: { instagram: "maha.world", tiktok: "maha.world" } },
];
