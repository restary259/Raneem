import React, { useState } from 'react';
import { Skeleton } from './skeleton';
import { cn } from '@/lib/utils';

interface ImageWithSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  skeletonClassName?: string;
}

const ImageWithSkeleton: React.FC<ImageWithSkeletonProps> = ({
  className,
  skeletonClassName,
  onLoad,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative">
      {!loaded && (
        <Skeleton className={cn("absolute inset-0", skeletonClassName)} />
      )}
      <img
        {...props}
        className={cn(className, !loaded && 'opacity-0')}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
    </div>
  );
};

export default ImageWithSkeleton;
