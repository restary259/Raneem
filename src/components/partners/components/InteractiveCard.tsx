
import React from 'react';
import { Card } from '@/components/ui/card';

interface InteractiveCardProps {
  children: React.ReactNode;
  id: string;
  className?: string;
  isExpanded: boolean;
  onToggle: (id: string | null) => void;
}

const InteractiveCard: React.FC<InteractiveCardProps> = ({ 
  children, 
  id, 
  className = "",
  isExpanded,
  onToggle
}) => {
  return (
    <Card 
      className={`
        transition-all duration-300 cursor-pointer h-full
        ${isExpanded 
          ? 'scale-105 shadow-2xl border-2 border-orange-400 z-10' 
          : 'hover:scale-102 hover:shadow-xl hover:border-orange-200'
        }
        ${className}
      `}
      onClick={() => onToggle(isExpanded ? null : id)}
    >
      {children}
    </Card>
  );
};

export default InteractiveCard;
