import React from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneClasses } from '@/lib/statusTokens';

interface Props {
  message: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Amber "you are offline" strip shown above the AI chat surfaces. */
const ChatOfflineBanner: React.FC<Props> = ({ message, size = 'md', className }) => (
  <div
    className={cn(
      'flex items-center gap-2 border-b',
      toneClasses('payment').tint,
      toneClasses('payment').text,
      'border-[hsl(var(--status-payment)/0.28)]',
      size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
      className,
    )}
  >
    <WifiOff className={cn('shrink-0', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
    <span>{message}</span>
  </div>
);

export default ChatOfflineBanner;
