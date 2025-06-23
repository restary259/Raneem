
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useForumPosts, useCreateForumPost, useForumTopics } from '@/hooks/useCommunity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageSquare, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const ForumTopicPage = () => {
  const { topicId } = useParams<{ topicId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replyContent, setReplyContent] = useState('');

  const { data: posts = [], isLoading: postsLoading } = useForumPosts(topicId!);
  const { data: topics = [], isLoading: topicsLoading } = useForumTopics();
  const createPostMutation = useCreateForumPost();

  const isLoading = postsLoading || topicsLoading;
  const currentTopic = topics.find(topic => topic.id === topicId);
  const mainPost = posts[0]; // First post is the main topic
  const replies = posts.slice(1); // Rest are replies

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !topicId) return;

    await createPostMutation.mutateAsync({
      topic_id: topicId,
      content: replyContent
    });

    setReplyContent('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!currentTopic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>الموضوع غير موجود</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/community')}>
              العودة إلى المنتدى
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/community')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 ml-2" />
            العودة إلى المنتدى
          </Button>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main Topic Post */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">{currentTopic.title}</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={currentTopic.author?.avatar_url} />
                        <AvatarFallback>
                          {currentTopic.author?.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{currentTopic.author?.full_name}</span>
                    </div>
                    <span>{format(new Date(currentTopic.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}</span>
                  </div>
                </div>
                {currentTopic.is_pinned && (
                  <Badge className="bg-green-100 text-green-800">
                    مثبت
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none mb-4">
                <p className="text-gray-700 whitespace-pre-wrap">{currentTopic.content}</p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t">
                <Button variant="ghost" size="sm">
                  <Heart className="h-4 w-4 ml-1" />
                  0
                </Button>
                <Button variant="ghost" size="sm">
                  <MessageSquare className="h-4 w-4 ml-1" />
                  {replies.length} رد
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Replies */}
          {replies.map((reply) => (
            <Card key={reply.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reply.author?.avatar_url} />
                      <AvatarFallback>
                        {reply.author?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{reply.author?.full_name}</span>
                      <div className="text-xs text-gray-500">
                        {format(new Date(reply.created_at), 'dd MMM yyyy - HH:mm', { locale: ar })}
                      </div>
                    </div>
                  </div>
                  {reply.is_accepted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 ml-1" />
                      إجابة مقبولة
                    </Badge>
                  )}
                </div>
                <div className="prose prose-sm max-w-none mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{reply.content}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm">
                    <Heart className="h-4 w-4 ml-1" />
                    {reply.likes_count}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reply Form */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">إضافة رد</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="اكتب ردك هنا..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSubmitReply}
                    disabled={!replyContent.trim() || createPostMutation.isPending}
                  >
                    {createPostMutation.isPending ? 'جاري النشر...' : 'نشر الرد'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForumTopicPage;
