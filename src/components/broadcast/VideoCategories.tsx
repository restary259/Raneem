
import React from 'react';
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Button } from '@/components/ui/button';
import { GraduationCap, Globe, ShieldCheck, Lightbulb } from 'lucide-react';
import { BroadcastCategory } from './data';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const categoryDetails: Record<BroadcastCategory, { icon: React.ElementType; key: string }> = {
  'نصائح الدراسة': { icon: GraduationCap, key: 'cat_studyTips' },
  'تجارب الطلبة': { icon: Globe, key: 'cat_studentExperiences' },
  'إجراءات التأشيرة': { icon: ShieldCheck, key: 'cat_visaProcedures' },
  'ورش عمل وتوجيه': { icon: Lightbulb, key: 'cat_workshops' },
};

interface VideoCategoriesProps {
  selectedCategory: BroadcastCategory | 'all';
  onSelectCategory: (category: BroadcastCategory | 'all') => void;
}

const VideoCategories: React.FC<VideoCategoriesProps> = ({ selectedCategory, onSelectCategory }) => {
  const { t } = useTranslation('broadcast');
  const { isRtl } = useDirection();

  return (
    <div className="w-full px-4 md:px-0">
      <Carousel opts={{ align: "start", dragFree: true, direction: isRtl ? 'rtl' : 'ltr' }} className="w-full">
        <CarouselContent>
          <CarouselItem className="basis-auto pr-2">
            <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} onClick={() => onSelectCategory('all')}>
              {t('allCategories')}
            </Button>
          </CarouselItem>
          {Object.entries(categoryDetails).map(([name, { icon: Icon, key }]) => (
            <CarouselItem key={name} className="basis-auto pr-2">
              <Button variant={selectedCategory === name ? 'default' : 'outline'} onClick={() => onSelectCategory(name as BroadcastCategory)}>
                <Icon className="ml-2 h-4 w-4" />
                {t(key)}
              </Button>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default VideoCategories;
