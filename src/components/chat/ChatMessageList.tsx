import React from 'react';
import { Bot, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/utils/chatCache';

export type ChatSize = 'sm' | 'md';

const SIZES: Record<ChatSize, { row: string; avatar: string; bubble: string }> = {
  sm: { row: 'gap-2', avatar: 'w-7 h-7', bubble: 'p-3 rounded-xl' },
  md: { row: 'gap-3', avatar: 'w-8 h-8', bubble: 'p-4 rounded-2xl' },
};

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  size?: ChatSize;
  /** Accent classes for the user side, which differs per surface (brand vs. orange). */
  userAvatarClassName?: string;
  userIconClassName?: string;
  userBubbleClassName?: string;
  animate?: boolean;
}

const Avatar: React.FC<{ size: ChatSize; className: string; children: React.ReactNode }> = ({
  size,
  className,
  children,
}) => (
  <div
    className={cn(
      SIZES[size].avatar,
      'rounded-full flex items-center justify-center shrink-0 mt-1',
      className,
    )}
  >
    {children}
  </div>
);

/** The message bubbles plus the assistant typing indicator, shared by every AI chat surface. */
const ChatMessageList: React.FC<Props> = ({
  messages,
  isLoading,
  size = 'md',
  userAvatarClassName = 'bg-orange-100',
  userIconClassName = 'text-orange-600',
  userBubbleClassName = 'bg-orange-50',
  animate = false,
}) => {
  const s = SIZES[size];

  return (
    <>
      {messages.map((msg, i) => (
        <div key={i} className={cn('flex', s.row, msg.role === 'user' ? 'justify-start' : 'justify-end')}>
          {msg.role === 'user' && (
            <Avatar size={size} className={userAvatarClassName}>
              <User className={cn('h-4 w-4', userIconClassName)} />
            </Avatar>
          )}
          <div
            className={cn(
              'max-w-[80%] text-sm whitespace-pre-wrap leading-relaxed text-foreground',
              s.bubble,
              animate && 'animate-fade-in',
              msg.role === 'user' ? `${userBubbleClassName} rounded-tr-sm` : 'bg-secondary rounded-tl-sm',
            )}
          >
            {msg.content}
          </div>
          {msg.role === 'assistant' && (
            <Avatar size={size} className="bg-blue-100">
              <Bot className="h-4 w-4 text-blue-600" />
            </Avatar>
          )}
        </div>
      ))}

      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
        <div className={cn('flex justify-end', s.row)}>
          <div className={cn(s.bubble, 'bg-secondary')}>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <Avatar size={size} className="bg-blue-100">
            <Bot className="h-4 w-4 text-blue-600" />
          </Avatar>
        </div>
      )}
    </>
  );
};

export default ChatMessageList;
