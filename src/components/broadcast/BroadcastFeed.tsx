
import React from 'react';
import { broadcastData } from './data';
import BroadcastCard from './BroadcastCard';

const BroadcastFeed = () => {
  const sortedPosts = [...broadcastData].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="space-y-6">
      {sortedPosts.map((post) => (
        <BroadcastCard key={post.id} post={post} />
      ))}
    </div>
  );
};

export default BroadcastFeed;
