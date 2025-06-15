
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
    title: 'رحلة رنا إلى ألمانيا: يوم الوصول الأول',
    description: 'انضموا إلى رنا في يومها الأول المثير في ألمانيا، من الوصول إلى المطار وحتى استكشاف سكنها الجامعي الجديد.',
    date: '2025-06-15T10:00:00Z',
    duration: '12:34',
    posterUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_30MB.mp4',
    youtubeId: 'dQw4w9WgXcQ',
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
    category: 'إجراءات التأشيرة',
    title: 'خطوات تعبئة طلب فيزا الدراسة لبريطانيا',
    description: 'شرح تفصيلي خطوة بخطوة لكيفية تعبئة نموذج طلب التأشيرة الدراسية للمملكة المتحدة بدون أخطاء.',
    date: '2025-06-12T09:00:00Z',
    duration: '22:40',
    posterUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    country: 'المملكة المتحدة',
    countryFlag: '🇬🇧',
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
];
