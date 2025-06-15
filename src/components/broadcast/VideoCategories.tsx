
import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from '@/components/ui/button';
import { GraduationCap, Globe, ShieldCheck, Lightbulb } from 'lucide-react';
import { BroadcastCategory } from './data';

const categoryDetails: Record<BroadcastCategory, { icon: React.ElementType }> = {
    'نصائح الدراسة': { icon: GraduationCap },
    'تجارب الطلبة': { icon: Globe },
    'إجراءات التأشيرة': { icon: ShieldCheck },
    'ورش عمل وتوجيه': { icon: Lightbulb },
};

interface VideoCategoriesProps {
  selectedCategory: BroadcastCategory | 'all';
  onSelectCategory: (category: BroadcastCategory | 'all') => void;
}

const VideoCategories: React.FC<VideoCategoriesProps> = ({ selectedCategory, onSelectCategory }) => {
  return (
    <div className="w-full px-4 md:px-0">
      <Carousel
        opts={{
          align: "start",
          dragFree: true,
          direction: 'rtl',
        }}
        className="w-full"
      >
        <CarouselContent>
            <CarouselItem className="basis-auto pr-2">
                <Button
                    variant={selectedCategory === 'all' ? 'default' : 'outline'}
                    onClick={() => onSelectCategory('all')}
                >
                    الكل
                </Button>
            </CarouselItem>
          {Object.entries(categoryDetails).map(([name, { icon: Icon }]) => (
            <CarouselItem key={name} className="basis-auto pr-2">
              <Button
                variant={selectedCategory === name ? 'default' : 'outline'}
                onClick={() => onSelectCategory(name as BroadcastCategory)}
              >
                <Icon className="ml-2 h-4 w-4" />
                {name}
              </Button>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default VideoCategories;
