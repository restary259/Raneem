import React from 'react';
import { cn } from '@/lib/utils';
import { useDirection } from '@/hooks/useDirection';

interface Props {
  questions: string[];
  onSelect: (question: string) => void;
  size?: 'sm' | 'md';
}

/** Tappable starter questions, aligned to the active writing direction. */
const ChatQuickQuestions: React.FC<Props> = ({ questions, onSelect, size = 'md' }) => {
  const { dir } = useDirection();

  return (
    <>
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className={cn(
            'w-full text-sm border hover:bg-secondary hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
            size === 'sm' ? 'p-2 rounded-lg' : 'p-3 rounded-xl',
          )}
          style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
        >
          {q}
        </button>
      ))}
    </>
  );
};

export default ChatQuickQuestions;
