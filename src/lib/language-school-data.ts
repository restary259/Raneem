export interface AccommodationOption {
  id: string;
  nameAr: string;
  nameEn: string;
  weeklyRateShort: number; // 1-24 weeks
  weeklyRateLong: number;  // 25+ weeks
}

export interface LanguageSchool {
  id: string;
  nameEn: string;
  nameAr: string;
  cityEn: string;
  cityAr: string;
  registrationFee: number;
  coursePricing: {
    shortTermWeekly: number;   // 1-6 or 1-24 weeks
    longTermWeekly: number;    // 7+ or 25+ weeks
    shortTermThreshold: number; // weeks threshold
  };
  lessonsPerWeek: number;
  accommodations: AccommodationOption[];
  accommodationDeposit: number;
  accommodationAdminFee: number;
}

export const languageSchools: LanguageSchool[] = [
  {
    id: 'alphaaktiv',
    nameEn: 'AlphaAktiv',
    nameAr: 'ألفا أكتيف',
    cityEn: 'Heidelberg',
    cityAr: 'هايدلبرغ',
    registrationFee: 50,
    coursePricing: {
      shortTermWeekly: 190,
      longTermWeekly: 150,
      shortTermThreshold: 25,
    },
    lessonsPerWeek: 20,
    accommodations: [
      { id: 'single-central', nameAr: 'غرفة فردية مركزية', nameEn: 'Single Room (Central)', weeklyRateShort: 220, weeklyRateLong: 190 },
      { id: 'double-central', nameAr: 'غرفة مزدوجة مركزية', nameEn: 'Double Room (Central)', weeklyRateShort: 185, weeklyRateLong: 160 },
      { id: 'double-noncentral', nameAr: 'غرفة مزدوجة غير مركزية', nameEn: 'Double Room (Non-Central)', weeklyRateShort: 155, weeklyRateLong: 130 },
      { id: 'host-family', nameAr: 'سكن عائلي (نصف إقامة)', nameEn: 'Host Family (Half-Board)', weeklyRateShort: 350, weeklyRateLong: 320 },
    ],
    accommodationDeposit: 200,
    accommodationAdminFee: 0,
  },
  {
    id: 'fu-academy',
    nameEn: 'F+U Academy of Languages',
    nameAr: 'أكاديمية F+U للغات',
    cityEn: 'Heidelberg',
    cityAr: 'هايدلبرغ',
    registrationFee: 130,
    coursePricing: {
      shortTermWeekly: 315,
      longTermWeekly: 270,
      shortTermThreshold: 7,
    },
    lessonsPerWeek: 20,
    accommodations: [
      { id: 'single-central', nameAr: 'غرفة فردية مركزية', nameEn: 'Single Room (Central)', weeklyRateShort: 220, weeklyRateLong: 190 },
      { id: 'double-central', nameAr: 'غرفة مزدوجة مركزية', nameEn: 'Double Room (Central)', weeklyRateShort: 185, weeklyRateLong: 160 },
      { id: 'double-noncentral', nameAr: 'غرفة مزدوجة غير مركزية', nameEn: 'Double Room (Non-Central)', weeklyRateShort: 155, weeklyRateLong: 130 },
      { id: 'host-family', nameAr: 'سكن عائلي (نصف إقامة)', nameEn: 'Host Family (Half-Board)', weeklyRateShort: 350, weeklyRateLong: 320 },
    ],
    accommodationDeposit: 200,
    accommodationAdminFee: 0,
  },
  {
    id: 'kapito',
    nameEn: 'KAPITO',
    nameAr: 'كابيتو',
    cityEn: 'Münster',
    cityAr: 'مونستر',
    registrationFee: 0,
    coursePricing: {
      shortTermWeekly: 210,
      longTermWeekly: 160,
      shortTermThreshold: 23,
    },
    lessonsPerWeek: 20,
    accommodations: [
      { id: 'private-shared', nameAr: 'غرفة خاصة في شقة مشتركة', nameEn: 'Private Room (Shared Flat)', weeklyRateShort: 140, weeklyRateLong: 110 },
      { id: 'host-breakfast', nameAr: 'سكن عائلي (فطور)', nameEn: 'Host Family (Breakfast)', weeklyRateShort: 160, weeklyRateLong: 135 },
      { id: 'host-halfboard', nameAr: 'سكن عائلي (نصف إقامة)', nameEn: 'Host Family (Half-Board)', weeklyRateShort: 220, weeklyRateLong: 195 },
    ],
    accommodationDeposit: 0,
    accommodationAdminFee: 150,
  },
  {
    id: 'go-academy',
    nameEn: 'GO Academy',
    nameAr: 'أكاديمية GO',
    cityEn: 'Düsseldorf',
    cityAr: 'دوسلدورف',
    registrationFee: 60,
    coursePricing: {
      shortTermWeekly: 195,
      longTermWeekly: 155,
      shortTermThreshold: 25,
    },
    lessonsPerWeek: 25,
    accommodations: [
      { id: 'apartment-3m', nameAr: 'شقة طلابية (3 أشهر)', nameEn: 'Student Apartment (3 months)', weeklyRateShort: 180, weeklyRateLong: 180 },
      { id: 'apartment-6m', nameAr: 'شقة طلابية (6 أشهر)', nameEn: 'Student Apartment (6 months)', weeklyRateShort: 165, weeklyRateLong: 165 },
      { id: 'apartment-9m', nameAr: 'شقة طلابية (9 أشهر)', nameEn: 'Student Apartment (9 months)', weeklyRateShort: 150, weeklyRateLong: 150 },
    ],
    accommodationDeposit: 200,
    accommodationAdminFee: 0,
  },
  {
    id: 'victoria',
    nameEn: 'VICTORIA Academy',
    nameAr: 'أكاديمية فيكتوريا',
    cityEn: 'Berlin',
    cityAr: 'برلين',
    registrationFee: 50,
    coursePricing: {
      shortTermWeekly: 230,
      longTermWeekly: 190,
      shortTermThreshold: 25,
    },
    lessonsPerWeek: 30,
    accommodations: [
      { id: 'single', nameAr: 'غرفة فردية (8-12 م²)', nameEn: 'Single Room (8-12 m²)', weeklyRateShort: 220, weeklyRateLong: 210 },
      { id: 'double', nameAr: 'غرفة مزدوجة', nameEn: 'Double Room', weeklyRateShort: 170, weeklyRateLong: 160 },
      { id: 'shared', nameAr: 'غرفة مشتركة (2-3 طلاب)', nameEn: 'Shared Room (2-3 students)', weeklyRateShort: 140, weeklyRateLong: 130 },
    ],
    accommodationDeposit: 200,
    accommodationAdminFee: 80,
  },
];

export const HEALTH_INSURANCE_SHORT = 28;  // EUR/month
export const HEALTH_INSURANCE_LONG = 125;  // EUR/month
export const MOBILE_INTERNET = 29.99;       // EUR/month
export const DEUTSCHLAND_TICKET = 58;       // EUR/month
export const VISA_FEE = 75;                 // EUR one-time
export const FOOD_BUDGET_MIN = 150;         // EUR/month
export const FOOD_BUDGET_MAX = 250;         // EUR/month
export const FOOD_BUDGET_DEFAULT = 200;     // EUR/month
