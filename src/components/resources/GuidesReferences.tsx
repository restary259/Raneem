
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Download, 
  ExternalLink,
  Clock,
  Star,
  Eye
} from 'lucide-react';

interface Guide {
  id: string;
  title: string;
  description: string;
  type: 'pdf' | 'video' | 'article' | 'checklist';
  country: 'germany' | 'general';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  downloadUrl?: string;
  externalUrl?: string;
  views: number;
  rating: number;
  tags: string[];
}

const guides: Guide[] = [
  {
    id: '1',
    title: 'دليل الطالب الشامل للدراسة في ألمانيا',
    description: 'دليل كامل يغطي جميع جوانب الدراسة في ألمانيا من التقديم حتى التخرج',
    type: 'pdf',
    country: 'germany',
    difficulty: 'beginner',
    duration: '45 دقيقة قراءة',
    downloadUrl: '/guides/germany-complete-guide.pdf',
    views: 1250,
    rating: 4.8,
    tags: ['تقديم', 'فيزا', 'سكن', 'جامعات']
  },
  {
    id: '2',
    title: 'كيفية الحصول على فيزا الطالب الألمانية',
    description: 'خطوات مفصلة للحصول على فيزا الدراسة في ألمانيا مع قائمة المستندات المطلوبة',
    type: 'video',
    country: 'germany',
    difficulty: 'intermediate',
    duration: '25 دقيقة',
    externalUrl: 'https://youtube.com/watch?v=example',
    views: 890,
    rating: 4.7,
    tags: ['فيزا', 'مستندات', 'سفارة']
  },
  {
    id: '3',
    title: 'قائمة مراجعة ما قبل السفر',
    description: 'قائمة شاملة بكل ما تحتاج إلى تجهيزه قبل السفر للدراسة في ألمانيا',
    type: 'checklist',
    country: 'general',
    difficulty: 'beginner',
    duration: '10 دقائق',
    downloadUrl: '/guides/pre-travel-checklist.pdf',
    views: 2100,
    rating: 4.9,
    tags: ['تحضير', 'سفر', 'مستندات']
  }
];

const GuidesReferences = () => {
  const [selectedType, setSelectedType] = useState<string>('all');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return FileText;
      case 'video': return Video;
      case 'article': return BookOpen;
      case 'checklist': return FileText;
      default: return BookOpen;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pdf': return 'ملف PDF';
      case 'video': return 'فيديو';
      case 'article': return 'مقال';
      case 'checklist': return 'قائمة مراجعة';
      default: return 'محتوى';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'مبتدئ';
      case 'intermediate': return 'متوسط';
      case 'advanced': return 'متقدم';
      default: return 'عام';
    }
  };

  const filteredGuides = guides.filter(guide => {
    return selectedType === 'all' || guide.type === selectedType;
  });

  const GuideCard = ({ guide }: { guide: Guide }) => {
    const TypeIcon = getTypeIcon(guide.type);
    
    return (
      <Card className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-primary" />
              <Badge variant="outline" className="text-xs">
                {getTypeLabel(guide.type)}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Eye className="h-3 w-3" />
              {guide.views}
            </div>
          </div>
          
          <CardTitle className="text-lg leading-tight">{guide.title}</CardTitle>
          
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${getDifficultyColor(guide.difficulty)}`}>
              {getDifficultyLabel(guide.difficulty)}
            </Badge>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs text-gray-600">{guide.rating}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {guide.duration}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 line-clamp-2">{guide.description}</p>
          
          <div className="flex flex-wrap gap-1">
            {guide.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          <div className="flex gap-2">
            {guide.downloadUrl && (
              <Button size="sm" className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                تحميل
              </Button>
            )}
            {guide.externalUrl && (
              <Button size="sm" variant="outline" className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                {guide.type === 'video' ? 'مشاهدة' : 'قراءة'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-primary">الأدلة والمراجع</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          مجموعة شاملة من الأدلة والموارد لمساعدتك في كل خطوة من رحلة دراستك في ألمانيا
        </p>
      </div>

      <div className="flex gap-2 justify-center mb-6">
        <Button
          variant={selectedType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedType('all')}
        >
          جميع الأنواع
        </Button>
        <Button
          variant={selectedType === 'pdf' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedType('pdf')}
        >
          <FileText className="h-4 w-4 mr-1" />
          PDF
        </Button>
        <Button
          variant={selectedType === 'video' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedType('video')}
        >
          <Video className="h-4 w-4 mr-1" />
          فيديو
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGuides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </div>
  );
};

export default GuidesReferences;
