
export type BroadcastCategory = 'نصائح الدراسة' | 'تجارب الطلبة' | 'إجراءات التأشيرة' | 'ورش عمل وتوجيه';

export interface BroadcastPost {
  id: number;
  featured?: boolean;
  category: BroadcastCategory;
  title: string;
  title_en?: string;
  description: string;
  description_en?: string;
  date: string;
  duration: string;
  posterUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  country?: string;
  country_en?: string;
  countryFlag?: string;
}

export const broadcastData: BroadcastPost[] = [
  {
    id: 1,
    featured: true,
    category: 'تجارب الطلبة',
    title: 'استكشاف جامعة ميونخ التقنية',
    title_en: 'Exploring the Technical University of Munich',
    description: 'انغمس في عالم جامعة ميونخ التقنية، واحدة من أفضل الجامعات في أوروبا. اكتشف حرمها الجامعي الحديث، وبرامجها المبتكرة، والحياة الطلابية النابضة بالحياة.',
    description_en: 'Dive into the world of the Technical University of Munich, one of Europe\'s top universities. Discover its modern campus, innovative programs, and vibrant student life.',
    date: '2025-06-15T10:00:00Z',
    duration: '03:19',
    posterUrl: 'https://img.youtube.com/vi/ktWQU0mg0Xk/maxresdefault.jpg',
    youtubeId: 'ktWQU0mg0Xk',
    country: 'ألمانيا',
    country_en: 'Germany',
    countryFlag: '🇩🇪',
  },
  {
    id: 3,
    category: 'تجارب الطلبة',
    title: 'جولة في جامعة بوخارست، رومانيا',
    title_en: 'Tour of the University of Bucharest, Romania',
    description: 'اكتشف حرم جامعة بوخارست، واحدة من أبرز الجامعات في رومانيا. تعرف على برامجها الأكاديمية، مرافقها، والحياة الطلابية.',
    description_en: 'Explore the University of Bucharest campus, one of Romania\'s leading universities. Learn about its academic programs, facilities, and student life.',
    date: '2025-06-12T09:00:00Z',
    duration: '01:26',
    posterUrl: 'https://img.youtube.com/vi/Uq6ENQtNq7A/maxresdefault.jpg',
    youtubeId: 'Uq6ENQtNq7A',
    country: 'رومانيا',
    country_en: 'Romania',
    countryFlag: '🇷🇴',
  },
  {
    id: 4,
    category: 'تجارب الطلبة',
    title: 'بداية جديدة: رحلة إلى جامعة كارول دافيلا للطب والصيدلة',
    title_en: 'A New Beginning: Journey to Carol Davila University of Medicine and Pharmacy',
    description: 'انضموا إلى رحلة طالب جديد في جامعة كارول دافيلا، واستكشفوا الحياة الأكاديمية والطلابية في واحدة من أعرق الجامعات الطبية في رومانيا.',
    description_en: 'Join a new student\'s journey at Carol Davila University, and explore academic and student life at one of Romania\'s most prestigious medical universities.',
    date: '2025-06-10T11:00:00Z',
    duration: '02:13',
    posterUrl: 'https://img.youtube.com/vi/nzCyN8zp61Q/maxresdefault.jpg',
    youtubeId: 'nzCyN8zp61Q',
    country: 'رومانيا',
    country_en: 'Romania',
    countryFlag: '🇷🇴',
  },
  {
    id: 5,
    category: 'ورش عمل وتوجيه',
    title: 'طلب التحاق بكالوريوس: انشاء حساب وتقديم طلب',
    title_en: 'Bachelor Application: Creating an Account and Submitting an Application',
    description: 'شرح تفصيلي خطوة بخطوة لكيفية إنشاء حساب على بوابة القبول وتقديم طلب التحاق لبرامج البكالوريوس بنجاح.',
    description_en: 'A detailed step-by-step guide on how to create an account on the admission portal and successfully submit a bachelor\'s program application.',
    date: '2025-06-08T18:00:00Z',
    duration: '05:58',
    posterUrl: 'https://img.youtube.com/vi/Yewg3n7MM9o/maxresdefault.jpg',
    youtubeId: 'Yewg3n7MM9o',
  },
  {
    id: 7,
    category: 'تجارب الطلبة',
    title: 'يوم في حياة طالب في عمان',
    title_en: 'A Day in the Life of a Student in Amman',
    description: 'جولة من منظور شخصي تظهر الحياة في الحرم الجامعي، شوارع عمان، المواصلات، واللحظات الثقافية.',
    description_en: 'A personal perspective tour showing campus life, the streets of Amman, transportation, and cultural moments.',
    date: '2025-06-15T12:00:00Z',
    duration: '11:04',
    posterUrl: 'https://img.youtube.com/vi/GzHprfxx8sI/maxresdefault.jpg',
    youtubeId: 'GzHprfxx8sI',
    country: 'الأردن',
    country_en: 'Jordan',
    countryFlag: '🇯🇴',
  },
  {
    id: 8,
    category: 'ورش عمل وتوجيه',
    title: 'طلب التحاق بكالوريوس: استكمال إجراءات القبول',
    title_en: 'Bachelor Application: Completing Admission Procedures',
    description: 'الجزء الثاني من سلسلة تقديم طلبات البكالوريوس، يغطي هذا الفيديو الخطوات التالية لاستكمال إجراءات القبول بنجاح.',
    description_en: 'Part two of the bachelor application series, this video covers the next steps to successfully complete admission procedures.',
    date: '2025-06-09T18:00:00Z',
    duration: '03:32',
    posterUrl: 'https://img.youtube.com/vi/O1Pk5VU5j34/maxresdefault.jpg',
    youtubeId: 'O1Pk5VU5j34',
  },
  {
    id: 9,
    category: 'تجارب الطلبة',
    title: 'جولة في حرم جامعة هايدلبرغ',
    title_en: 'Tour of Heidelberg University Campus',
    description: 'جولة في حرم جامعة هايدلبرغ، إحدى أعرق الجامعات في ألمانيا. استكشفوا المباني التاريخية والمرافق الحديثة والحياة الطلابية النابضة بالحياة.',
    description_en: 'A tour of Heidelberg University campus, one of Germany\'s most prestigious universities. Explore historic buildings, modern facilities, and vibrant student life.',
    date: '2025-06-13T10:00:00Z',
    duration: '02:45',
    posterUrl: 'https://img.youtube.com/vi/wJ3eqaoz7k4/maxresdefault.jpg',
    youtubeId: 'wJ3eqaoz7k4',
    country: 'ألمانيا',
    country_en: 'Germany',
    countryFlag: '🇩🇪',
  },
  {
    id: 10,
    category: 'نصائح الدراسة',
    title: 'كيف تذاكر بفعالية (TED-Ed)',
    title_en: 'How to Study Effectively (TED-Ed)',
    description: 'اكتشف أفضل الاستراتيجيات العلمية للمذاكرة والتعلم بكفاءة عالية، مقدمة من TED-Ed.',
    description_en: 'Discover the best scientific strategies for studying and learning efficiently, presented by TED-Ed.',
    date: '2025-06-16T10:00:00Z',
    duration: '04:54',
    posterUrl: 'https://img.youtube.com/vi/TjPFZaMe2yw/maxresdefault.jpg',
    youtubeId: 'TjPFZaMe2yw',
  },
  {
    id: 11,
    category: 'نصائح الدراسة',
    title: 'استمع لخبير عصبية من ستانفورد: كيف تدرس بذكاء وليس بجهد فقط',
    title_en: 'Listen to a Stanford Neuroscientist: How to Study Smart, Not Just Hard',
    description: 'تعلم من خبير الأعصاب بجامعة ستانفورد أساليب الدراسة الذكية التي تعزز الفهم والاحتفاظ بالمعلومات بأقل جهد.',
    description_en: 'Learn from a Stanford neuroscientist about smart study techniques that enhance understanding and retention with minimal effort.',
    date: '2025-06-17T10:00:00Z',
    duration: '1:49:50',
    posterUrl: 'https://img.youtube.com/vi/jMhhaAQK1NQ/maxresdefault.jpg',
    youtubeId: 'jMhhaAQK1NQ',
  },
];
