import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Image, FileText, Video } from 'lucide-react';

const mediaAssets = [
  { title: 'شعار الوكالة', type: 'image', icon: Image, description: 'شعار درب بصيغ مختلفة للاستخدام في المنشورات' },
  { title: 'قالب منشور إنستغرام', type: 'template', icon: Image, description: 'قوالب جاهزة للنشر على إنستغرام وتيك توك' },
  { title: 'بروشور البرامج', type: 'pdf', icon: FileText, description: 'كتيب شامل عن برامج الدراسة في ألمانيا' },
  { title: 'فيديو ترويجي', type: 'video', icon: Video, description: 'مقطع قصير للمشاركة مع المتابعين' },
];

const tips = [
  'استخدم القصص (Stories) لمشاركة تجربتك الحقيقية مع الوكالة',
  'أضف رابط الإحالة الخاص بك في البايو (Bio)',
  'شارك نتائج الطلاب الذين ساعدتهم (بإذنهم)',
  'استخدم الهاشتاقات ذات الصلة مثل #الدراسة_في_ألمانيا',
];

const MediaHub: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">📦 المحتوى الترويجي</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {mediaAssets.map((asset, idx) => {
              const Icon = asset.icon;
              return (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{asset.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground mt-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💡 نصائح للتسويق</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-primary font-bold mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaHub;
