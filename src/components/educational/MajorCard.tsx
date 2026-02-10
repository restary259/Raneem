
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { SubMajor } from '@/data/majorsData';

interface MajorCardProps {
  major: SubMajor & { categoryTitle: string };
  onMajorClick: (major: SubMajor) => void;
  searchQuery?: string;
}

const MajorCard = ({ major, onMajorClick, searchQuery }: MajorCardProps) => {
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-orange-200 text-orange-800 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <Card 
      className="hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:border-accent/30 group"
      onClick={() => onMajorClick(major)}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 text-right">
            <div className="flex items-center gap-2 justify-end mb-3">
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-orange-600 transition-colors">
                {searchQuery ? highlightText(major.nameAR, searchQuery) : major.nameAR}
              </h3>
              <BookOpen className="h-5 w-5 text-orange-500" />
            </div>
            
            <Badge variant="outline" className="mb-3 text-xs">
              {major.categoryTitle}
            </Badge>
            
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {searchQuery ? highlightText(major.description, searchQuery) : major.description}
            </p>
            
            <div className="flex items-center gap-2 justify-end text-orange-500 group-hover:text-orange-600 transition-colors">
              <span className="text-sm font-medium">اقرأ المزيد</span>
              <ArrowLeft className="h-4 w-4" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MajorCard;
