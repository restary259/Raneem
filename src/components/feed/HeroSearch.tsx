
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Heart, FileText, MessageCircle, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSearch: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl p-6 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">
          ابدأ رحلتك الأكاديمية اليوم
        </h1>
        
        <div className="relative mb-6">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="ابحث عن الجامعات والبرامج والمنح الدراسية..."
            className="pl-12 py-3 text-lg bg-white text-gray-900"
          />
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={() => navigate('/favorites')}
            className="flex items-center gap-2"
          >
            <Heart className="h-4 w-4" />
            المفضلات
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/applications')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            طلباتي
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/communications')}
            className="flex items-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            الرسائل
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/notifications')}
            className="flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            الإشعارات
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HeroSearch;
