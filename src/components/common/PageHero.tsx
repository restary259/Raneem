
import React, { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  variant?: 'gradient' | 'light' | 'image';
  imageUrl?: string;
  badge?: string;
  children?: ReactNode;
  className?: string;
}

const PageHero: React.FC<PageHeroProps> = ({
  title,
  subtitle,
  variant = 'gradient',
  imageUrl,
  badge,
  children,
  className,
}) => {
  const baseSpacing = 'pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-28 md:pb-20';

  if (variant === 'image') {
    return (
      <section className={cn('relative text-center text-white', baseSpacing, className)}>
        <div className="absolute inset-0 z-0">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10 animate-fade-in">
          {badge && (
            <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 text-xs md:text-sm">
              {badge}
            </Badge>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold drop-shadow-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 sm:mt-6 max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-white/90 drop-shadow-md">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-6 sm:mt-8">{children}</div>}
        </div>
      </section>
    );
  }

  if (variant === 'light') {
    return (
      <section className={cn('bg-secondary text-center', baseSpacing, className)}>
        <div className="container mx-auto px-4 sm:px-6 animate-fade-in">
          {badge && (
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary text-xs md:text-sm">
              {badge}
            </Badge>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 sm:mt-6 max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
          {children && <div className="mt-6 sm:mt-8">{children}</div>}
        </div>
      </section>
    );
  }

  // Default: gradient variant
  return (
    <section className={cn('bg-gradient-to-b from-primary to-primary/80 text-center', baseSpacing, className)}>
      <div className="container mx-auto px-4 sm:px-6 animate-fade-in">
        {badge && (
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 text-xs md:text-sm">
            {badge}
          </Badge>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 sm:mt-6 max-w-3xl mx-auto text-base sm:text-lg md:text-xl text-white/90">
            {subtitle}
          </p>
        )}
        {children && <div className="mt-6 sm:mt-8">{children}</div>}
      </div>
    </section>
  );
};

export default PageHero;
