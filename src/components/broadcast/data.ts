export type BroadcastCategory = 'نصائح الدراسة' | 'تجارب الطلبة' | 'إجراءات التأشيرة' | 'ورش عمل وتوجيه';

export interface BroadcastPost {
  id: number;
  featured?: boolean;
  category: BroadcastCategory;
  title: string;
  description: string;
  date: string;
  duration: string;
  posterUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  country?: string;
  countryFlag?: string;
}

export const broadcastData: BroadcastPost[] = [
  {
    id: 1,
    featured: true,
    category: 'تجارب الطلبة',
    title: 'استكشاف جامعة ميونخ التقنية',
    description: 'انغمس في عالم جامعة ميونخ التقنية، واحدة من أفضل الجامعات في أوروبا. اكتشف حرمها الجامعي الحديث، وبرامجها المبتكرة، والحياة الطلابية النابضة بالحياة.',
    date: '2025-06-15T10:00:00Z',
    duration: '03:19',
    posterUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop',
    youtubeId: 'ktWQU0mg0Xk',
    country: 'ألمانيا',
    countryFlag: '🇩🇪',
  },
  {
    id: 2,
    category: 'نصائح الدراسة',
    title: '5 نصائح لاختيار التخصص الجامعي المناسب',
    description: 'مرشدنا الأكاديمي يشارككم أهم النصائح التي ستساعدكم في اتخاذ قرار التخصص بثقة ووضوح.',
    date: '2025-06-14T15:30:00Z',
    duration: '08:15',
    posterUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop',
    youtubeId: '6vYnas6q3Sg',
  },
  {
    id: 3,
    category: 'تجارب الطلبة',
    title: 'جولة في جامعة بوخارست، رومانيا',
    description: 'اكتشف حرم جامعة بوخارست، واحدة من أبرز الجامعات في رومانيا. تعرف على برامجها الأكاديمية، مرافقها، والحياة الطلابية.',
    date: '2025-06-12T09:00:00Z',
    duration: '01:26',
    posterUrl: 'https://img.youtube.com/vi/Uq6ENQtNq7A/maxresdefault.jpg',
    youtubeId: 'Uq6ENQtNq7A',
    country: 'رومانيا',
    countryFlag: '🇷🇴',
  },
  {
    id: 4,
    category: 'تجارب الطلبة',
    title: 'جولة في الحرم الجامعي لجامعة تورنتو',
    description: 'طالبنا عمر يأخذنا في جولة شيقة داخل واحدة من أفضل الجامعات الكندية. تعرفوا على المرافق والحياة الطلابية.',
    date: '2025-06-10T11:00:00Z',
    duration: '15:05',
    posterUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop',
    youtubeId: 'L_LUpnjgPso',
    country: 'كندا',
    countryFlag: '🇨🇦',
  },
    {
    id: 5,
    category: 'ورش عمل وتوجيه',
    title: 'ورشة عمل: كيف تكتب سيرة ذاتية احترافية؟',
    description: 'تسجيل كامل لورشة العمل التي أقيمت عبر الإنترنت حول كتابة السيرة الذاتية التي تجذب انتباه مسؤولي القبول.',
    date: '2025-06-08T18:00:00Z',
    duration: '45:12',
    posterUrl: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2070&auto=format&fit=crop',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  },
  {
    id: 6,
    category: 'نصائح الدراسة',
    title: 'استراتيجيات المذاكرة الفعالة قبل الامتحانات',
    description: 'تعلم تقنيات مجربة لزيادة تركيزك وتحسين استيعابك للمواد الدراسية في فترة المراجعة النهائية.',
    date: '2025-06-05T14:00:00Z',
    duration: '11:55',
    posterUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1973&auto=format&fit=crop',
    youtubeId: 'Yb6825eG6e4',
  },
  {
    id: 7,
    category: 'تجارب الطلبة',
    title: 'يوم في حياة طالب في عمان',
    description: 'جولة من منظور شخصي تظهر الحياة في الحرم الجامعي، شوارع عمان، المواصلات، واللحظات الثقافية.',
    date: '2025-06-15T12:00:00Z',
    duration: '11:04',
    posterUrl: 'https://images.unsplash.com/photo-1582845339999-a823c5820a1c?q=80&w=2070&auto=format&fit=crop',
    youtubeId: 'GzHprfxx8sI',
    country: 'الأردن',
    countryFlag: '🇯🇴',
  },
];
