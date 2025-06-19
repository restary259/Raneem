
import { University, Service, Influencer } from '@/lib/types';

export const universityPartners: University[] = [
  // Romania
  { type: 'university', name: "Carol Davila University of Medicine and Pharmacy", country: "Romania", location: "Bucharest, Romania", logoUrl: "/lovable-uploads/dfca3402-c6b9-4560-88d7-6e8c19f26ab4.png", partnershipSince: 2021, specializations: ["طب بشري", "صيدلة"], websiteUrl: "https://www.umfcd.ro/" },
  { type: 'university', name: "Ovidius University", country: "Romania", location: "Constanța, Romania", logoUrl: "/lovable-uploads/03767a14-eafc-4beb-8e8f-12a2491e4ee5.png", partnershipSince: 2023, specializations: ["هندسة", "اقتصاد"], websiteUrl: "https://www.univ-ovidius.ro/" },
  { type: 'university', name: "University of Bucharest", country: "Romania", location: "Bucharest, Romania", logoUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=400", partnershipSince: 2022, specializations: ["أعمال", "علوم إنسانية", "علوم"], websiteUrl: "https://unibuc.ro/" },
  // Jordan
  { type: 'university', name: "جامعة اليرموك", country: "Jordan", location: "Irbid, Jordan", logoUrl: "/lovable-uploads/125fa6e2-60ae-4bd0-91bb-a2b2dc342ebd.png", partnershipSince: 2020, specializations: ["هندسة", "تكنولوجيا المعلومات", "فنون"], websiteUrl: "https://www.yu.edu.jo/" },
  { type: 'university', name: "UMF Jordan", country: "Jordan", location: "Amman, Jordan", logoUrl: "https://images.unsplash.com/photo-1627916575236-3988588f172a?w=400", partnershipSince: 2022, specializations: ["طب", "صيدلة"], websiteUrl: "https://umf-jordan.com/" },
  // Germany (Language Schools)
  { type: 'school', name: "F+U Academy of Languages – Heidelberg", country: "Germany", location: "Heidelberg, Germany", logoUrl: "/lovable-uploads/e7298181-bfde-4ee6-b5cb-a310ab735b61.png", partnershipSince: 2023, specializations: ["لغة ألمانية"], websiteUrl: "https://www.fuu-heidelberg-languages.com/" },
  { type: 'school', name: "Alpha Aktiv – Heidelberg", country: "Germany", location: "Heidelberg, Germany", logoUrl: "/lovable-uploads/171c7fae-8d36-4d06-a429-e3726c4417b8.png", partnershipSince: 2022, specializations: ["لغة ألمانية", "تأهيل جامعي"], websiteUrl: "https://www.alpha-heidelberg.de/" },
  { type: 'school', name: "GoAcademy – Düsseldorf", country: "Germany", location: "Düsseldorf, Germany", logoUrl: "/lovable-uploads/f66f6ad1-4686-44a0-8341-178c0bacebaf.png", partnershipSince: 2023, specializations: ["لغة ألمانية", "لغة إنجليزية"], websiteUrl: "https://www.goacademy.de/" },
];

export const servicePartners: Service[] = [
  // Germany Services
  { type: 'service', name: "Wise", country: "Germany", logoUrl: "/lovable-uploads/ddc7317f-5901-468f-8ff2-9397edfb41d0.png", description: "تحويلات مالية دولية برسوم منخفضة وسعر صرف حقيقي.", supported_countries: ["عالمي"], languages: ["العربية", "الإنجليزية", "الألمانية"], darb_benefit: "تحويل أول مجاني حتى 500£" },
  { type: 'service', name: "Techniker Krankenkasse", country: "Germany", logoUrl: "/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png", description: "أحد أكبر شركات التأمين الصحي الحكومي في ألمانيا، ويوفر تغطية شاملة للطلاب.", supported_countries: ["ألمانيا"], languages: ["الألمانية", "الإنجليزية"], darb_benefit: "دعم ومساعدة بالعربية" },
  { type: 'service', name: "Deutsche Bahn", country: "Germany", logoUrl: "/lovable-uploads/c4ad72df-424f-4051-b509-d3e1253f49f2.png", description: "شركة السكك الحديدية الوطنية في ألمانيا، توفر خيارات سفر متنوعة وبطاقات خصم للطلاب.", supported_countries: ["ألمانيا"], languages: ["الألمانية", "الإنجليزية"] },
  { type: 'service', name: "ImmoScout24", country: "Germany", logoUrl: "/lovable-uploads/ddc7317f-5901-468f-8ff2-9397edfb41d0.png", description: "منصة رائدة للبحث عن سكن وشقق للإيجار في جميع أنحاء ألمانيا.", supported_countries: ["ألمانيا"], languages: ["الألمانية"], darb_benefit: "دليل استخدام المنصة" },
];

export const influencerPartners: Influencer[] = [
  // Temporarily empty - will be re-added later
];
