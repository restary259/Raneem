
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, Bookmark, Pin } from 'lucide-react';
import { Post } from '@/hooks/useFeed';

interface PostCardProps {
  post: Post;
  onSave?: (postId: string) => void;
  onShare?: (post: Post) => void;
  onComment?: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onSave,
  onShare,
  onComment,
}) => {
  const getPostTypeColor = (type: Post['post_type']) => {
    switch (type) {
      case 'scholarship':
        return 'bg-green-500';
      case 'announcement':
        return 'bg-blue-500';
      case 'program':
        return 'bg-purple-500';
      case 'event':
        return 'bg-orange-500';
      case 'deadline':
        return 'bg-red-500';
      case 'success_story':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPostTypeText = (type: Post['post_type']) => {
    switch (type) {
      case 'scholarship':
        return 'منحة دراسية';
      case 'announcement':
        return 'إعلان';
      case 'program':
        return 'برنامج';
      case 'event':
        return 'فعالية';
      case 'deadline':
        return 'موعد نهائي';
      case 'success_story':
        return 'قصة نجاح';
      default:
        return type;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200" dir="rtl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.profiles?.avatar_url} />
              <AvatarFallback>
                {post.profiles?.full_name?.slice(0, 2) || 'مج'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm">{post.profiles?.full_name || 'مستخدم'}</h3>
              <p className="text-xs text-gray-500">
                {new Date(post.created_at).toLocaleDateString('ar-SA')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {post.is_pinned && (
              <Pin className="h-4 w-4 text-orange-500" fill="currentColor" />
            )}
            <Badge className={`${getPostTypeColor(post.post_type)} text-white text-xs`}>
              {getPostTypeText(post.post_type)}
            </Badge>
            {post.is_verified && (
              <Badge variant="secondary" className="text-xs">
                موثق
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h2 className="font-bold text-lg mb-2">{post.title}</h2>
          <p className="text-gray-700 leading-relaxed">{post.content}</p>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              <span className="text-sm">إعجاب</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onComment?.(post)}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">تعليق</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave?.(post.id)}
              className="flex items-center gap-2"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare?.(post)}
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCard;
