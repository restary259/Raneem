
import { Pin } from 'lucide-react';

export type BroadcastCategory = 'أخبار القبول' | 'تحديثات التأشيرات' | 'إنجازات الطلاب' | 'تنبيهات عاجلة';

export interface BroadcastPost {
  id: number;
  pinned?: boolean;
  category: BroadcastCategory;
  emoji: string;
  title: string;
  date: string;
  country: string;
  countryFlag: string;
  content: string;
  pdfUrl?: string;
}

export const broadcastData: BroadcastPost[] = [
  {
    id: 1,
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
    id: 2,
    category: 'إنجازات الطلاب',
    emoji: '🎉',
    title: 'قبول جديد في جامعة ميونخ التقنية!',
    date: '2025-06-14T15:30:00Z',
    country: 'ألمانيا',
    countryFlag: '🇩🇪',
    content: 'نهنئ الطالب أحمد لحصوله على قبول لدراسة الهندسة الميكانيكية. نتمنى له كل التوفيق في رحلته الدراسية!',
  },
  {
    id: 3,
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
    category: 'أخبار القبول',
    emoji: '🟠',
    title: 'فتح باب القبول في الجامعات الأردنية',
    date: '2025-06-10T11:00:00Z',
    country: 'الأردن',
    countryFlag: '🇯🇴',
    content: 'أعلنت الجامعات الأردنية عن فتح باب القبول للطلاب الدوليين للفصل الدراسي القادم. الفرصة متاحة الآن للتقديم.',
  },
];
