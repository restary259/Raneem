import React from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  isLoading: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  /** Accent classes for the send button, which differs per surface. */
  sendClassName?: string;
  className?: string;
}

/** Send button + text input, shared by every AI chat surface. */
const ChatComposer: React.FC<Props> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  isLoading,
  inputRef,
  sendClassName = 'bg-orange-500 hover:bg-orange-600',
  className,
}) => {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn('flex gap-2', className)}
    >
      <Button
        type="submit"
        size="icon"
        aria-label={t('chat.send', 'Send')}
        disabled={!value.trim() || isLoading}
        className={cn('shrink-0', sendClassName)}
      >
        <Send className="h-4 w-4" />
      </Button>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
        disabled={isLoading}
      />
    </form>
  );
};

export default ChatComposer;
