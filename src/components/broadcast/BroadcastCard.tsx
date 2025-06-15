
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Pin } from 'lucide-react';
import type { BroadcastPost, BroadcastCategory } from './data';

const categoryStyles: Record<BroadcastCategory, string> = {
  'أخبار القبول': 'bg-orange-500 border-orange-500 hover:bg-orange-600',
  'تحديثات التأشيرات': 'bg-blue-500 border-blue-500 hover:bg-blue-600',
  'إنجازات الطلاب': 'bg-green-600 border-green-600 hover:bg-green-700',
  'تنبيهات عاجلة': 'bg-red-600 border-red-600 hover:bg-red-700',
};

interface BroadcastCardProps {
  post: BroadcastPost;
}

const BroadcastCard: React.FC<BroadcastCardProps> = ({ post }) => {
  const timeAgo = formatDistanceToNow(new Date(post.date), {
    addSuffix: true,
    locale: ar,
  });

  return (
    <Card className="w-full animate-scale-in transition-all hover:shadow-lg relative">
      {post.pinned && (
        <div className="absolute top-3 left-3 bg-accent p-2 rounded-full text-accent-foreground z-10">
          <Pin className="h-4 w-4" />
        </div>
      )}
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
        <p className="text-muted-foreground">{post.content}</p>
      </CardContent>
      {post.pdfUrl && (
        <CardFooter>
          <Button variant="outline" asChild>
            <a href={post.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Download className="ml-2 h-4 w-4" />
              تحميل PDF
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default BroadcastCard;
