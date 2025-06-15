
import React from 'react';
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { BroadcastPost } from './data';
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';


interface BroadcastVideoCardProps {
  post: BroadcastPost;
  onPlay: (post: BroadcastPost) => void;
}

const BroadcastVideoCard: React.FC<BroadcastVideoCardProps> = ({ post, onPlay }) => {
  const { toast } = useToast();
  const timeAgo = formatDistanceToNow(new Date(post.date), {
    addSuffix: true,
    locale: ar,
  });

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = post.youtubeId ? `https://youtu.be/${post.youtubeId}` : post.videoUrl;
    if (navigator.share && url) {
      navigator.share({
        title: post.title,
        url: url,
      }).catch(console.error);
    } else if (url) {
      navigator.clipboard.writeText(url).then(() => {
        toast({
            title: "تم نسخ الرابط!",
            description: "يمكنك الآن مشاركة الفيديو.",
        })
      });
    }
  };

  return (
    <Card 
      className="w-full animate-scale-in transition-all hover:shadow-xl overflow-hidden group cursor-pointer bg-card flex flex-col border hover:border-accent"
      onClick={() => onPlay(post)}
    >
      <div className="relative">
        <img 
          src={post.posterUrl} 
          alt={post.title} 
          className="w-full h-auto object-cover aspect-video transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <PlayCircle className="h-16 w-16 text-white/80 transition-transform group-hover:scale-110" />
        </div>
        <Badge variant="secondary" className="absolute bottom-2 right-2">{post.duration}</Badge>
      </div>
      <CardHeader className="flex-grow pb-4">
        <CardTitle className="text-base font-bold line-clamp-2" title={post.title}>
          {post.title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground mt-2 line-clamp-3">
          {post.description}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-between items-center pt-0">
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="ml-2 h-4 w-4" />
              مشاركة
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>📎 انسخ الرابط لمشاركته</p>
          </TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  );
};

export default BroadcastVideoCard;
