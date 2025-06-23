
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Conversation } from '@/hooks/useConversations';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect
}) => {
  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;
    
    // For direct messages, use the other person's name
    if (conversation.type === 'direct') {
      const otherMember = conversation.members.find(m => m.user_id !== conversation.created_by);
      return otherMember?.profile.full_name || 'Unknown User';
    }
    
    return `Group (${conversation.members.length} members)`;
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.type === 'direct') {
      const otherMember = conversation.members.find(m => m.user_id !== conversation.created_by);
      return otherMember?.profile.avatar_url;
    }
    return undefined;
  };

  return (
    <div className="space-y-2">
      {conversations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No conversations yet</p>
          <p className="text-sm">Start a new conversation to begin messaging</p>
        </div>
      ) : (
        conversations.map((conversation) => (
          <Card
            key={conversation.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              selectedId === conversation.id ? 'bg-muted border-primary' : ''
            }`}
            onClick={() => onSelect(conversation)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getConversationAvatar(conversation)} />
                  <AvatarFallback>
                    {getConversationTitle(conversation).charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium truncate">
                      {getConversationTitle(conversation)}
                    </h3>
                    {conversation.unread_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conversation.unread_count}
                      </Badge>
                    )}
                  </div>
                  
                  {conversation.last_message && (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-muted-foreground truncate">
                        {conversation.last_message.content}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.last_message.created_at), {
                          addSuffix: true,
                          locale: ar
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default ConversationList;
