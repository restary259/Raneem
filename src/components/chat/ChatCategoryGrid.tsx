import React from 'react';

export interface ChatCategory {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind background + text classes for the tile. */
  color: string;
}

/** Read-only topic tiles shown on the empty state of the full-page AI chats. */
const ChatCategoryGrid: React.FC<{ categories: ChatCategory[] }> = ({ categories }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-lg">
    {categories.map(({ label, icon: Icon, color }) => (
      <div key={label} className={`flex flex-col items-center gap-2 p-3 rounded-xl ${color} cursor-default`}>
        <Icon className="h-5 w-5" />
        <span className="text-xs font-medium text-center">{label}</span>
      </div>
    ))}
  </div>
);

export default ChatCategoryGrid;
