
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Pin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { BroadcastPost, BroadcastCategory } from './data';

const categoryStyles: Record<BroadcastCategory, string> = {
  'أخبار القبول': 'bg-orange-500 border-orange-500 hover:bg-orange-600',
  'تحديثات التأشيرات': 'bg-blue-500 border-blue-500 hover:bg-blue-600',
  'إنجازات الطلاب': 'bg-green-600 border-green-600 hover:bg-green-700',
  'تنبيهات عاجلة': 'bg-red-600 border-red-600 hover:bg-red-700',
};

interface BroadcastVideoCardProps {
  post: BroadcastPost;
  onPlay: (videoUrl: string) => void;
}

const BroadcastVideoCard: React.FC<BroadcastVideoCardProps> = ({ post, onPlay }) => {
    const timeAgo = formatDistanceToNow(new Date(post.date), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <div className="relative masonry-grid-item">
      {post.pinned && (
        <div className="absolute top-3 left-3 bg-accent p-2 rounded-full text-accent-foreground z-20">
          <Pin className="h-4 w-4" />
        </div>
      )}
      <Card 
        className="w-full animate-scale-in transition-all hover:shadow-lg overflow-hidden cursor-pointer"
        onClick={() => post.videoUrl && onPlay(post.videoUrl)}
      >
        <div className="relative">
          <img src={post.posterUrl} alt={post.title} className="w-full h-auto object-cover aspect-video" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group">
            <PlayCircle className="h-16 w-16 text-white/80 transition-transform group-hover:scale-110" />
          </div>
        </div>
        <CardHeader>
          <div className="flex justify-between items-start">
              <div>
                  <Badge className={`${categoryStyles[post.category]} text-white mb-2`}>
                      {post.category}
                  </Badge>
                  <CardTitle className="flex items-center gap-2 text-xl">
                      <span className="text-2xl">{post.emoji}</span>
                      <span className="flex-1">{post.title}</span>
                  </CardTitle>
              </div>
              <div className="text-3xl" title={post.country}>{post.countryFlag}</div>
          </div>
            <CardDescription className="pt-2">{timeAgo}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{post.content}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BroadcastVideoCard;
