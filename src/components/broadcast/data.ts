
export type BroadcastCategory = 'أخبار القبول' | 'تحديثات التأشيرات' | 'إنجازات الطلاب' | 'تنبيهات عاجلة';

export interface BroadcastPost {
  id: number;
  type: 'post' | 'video';
  pinned?: boolean;
  category: BroadcastCategory;
  emoji: string;
  title: string;
  date: string;
  country: string;
  countryFlag: string;
  content: string;
  pdfUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
}

export const broadcastData: BroadcastPost[] = [
  {
    id: 1,
    type: 'post',
    pinned: true,
    category: 'تنبيهات عاجلة',
    emoji: '🚨',
    title: 'تنبيه هام بخصوص مواعيد السفارة الألمانية',
    date: '2025-06-15T10:00:00Z',
    country: 'ألمانيا',
    countryFlag: '🇩🇪',
    content: 'تم تحديث مواعيد التقديم للتأشيرة الدراسية. يرجى مراجعة المواعيد الجديدة والتأكد من حجز الموعد المناسب.',
    pdfUrl: '#',
  },
  {
    id: 6,
    type: 'video',
    pinned: true,
    category: 'تحديثات التأشيرات',
    emoji: '🎥',
    title: 'شرح متطلبات الفيزا الجديدة',
    date: '2025-06-15T18:00:00Z',
    country: 'رومانيا',
    countryFlag: '🇷🇴',
    content: 'فيديو توضيحي من فريقنا حول آخر تحديثات متطلبات التأشيرة الرومانية.',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  },
  {
    id: 2,
    type: 'post',
    category: 'إنجازات الطلاب',
    emoji: '🎉',
    title: 'قبول جديد في جامعة ميونخ التقنية!',
    date: '2025-06-14T15:30:00Z',
    country: 'ألمانيا',
    countryFlag: '🇩🇪',
    content: 'نهنئ الطالب أحمد لحصوله على قبول لدراسة الهندسة الميكانيكية. نتمنى له كل التوفيق في رحلته الدراسية!',
  },
  {
    id: 5,
    type: 'video',
    category: 'إنجازات الطلاب',
    emoji: '🎬',
    title: 'طالبنا وصل ألمانيا!',
    date: '2025-06-16T12:00:00Z',
    country: 'ألمانيا',
    countryFlag: '🇩🇪',
    content: 'شاهدوا فرحة وصول أحد طلابنا إلى ألمانيا لبدء رحلته الدراسية.',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbb563?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  },
  {
    id: 3,
    type: 'post',
    category: 'تحديثات التأشيرات',
    emoji: '🔵',
    title: 'تحديثات متطلبات فيزا رومانيا',
    date: '2025-06-12T09:00:00Z',
    country: 'رومانيا',
    countryFlag: '🇷🇴',
    content: 'تم إضافة متطلب جديد للحصول على التأشيرة الرومانية يتعلق بإثبات المقدرة المالية. التفاصيل في الملف المرفق.',
    pdfUrl: '#',
  },
  {
    id: 4,
    type: 'post',
    category: 'أخبار القبول',
    emoji: '🟠',
    title: 'فتح باب القبول في الجامعات الأردنية',
    date: '2025-06-10T11:00:00Z',
    country: 'الأردن',
    countryFlag: '🇯🇴',
    content: 'أعلنت الجامعات الأردنية عن فتح باب القبول للطلاب الدوليين للفصل الدراسي القادم. الفرصة متاحة الآن للتقديم.',
  },
    {
    id: 7,
    type: 'video',
    category: 'إنجازات الطلاب',
    emoji: '🥳',
    title: 'مقابلة مع طالب في الأردن',
    date: '2025-06-09T14:00:00Z',
    country: 'الأردن',
    countryFlag: '🇯🇴',
    content: 'أجرينا مقابلة سريعة مع أحد طلابنا الذي يدرس حالياً في الأردن. تعرف على تجربته!',
    videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1576487248805-cf4d8e404398?q=80&w=1953&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'
  }
];
