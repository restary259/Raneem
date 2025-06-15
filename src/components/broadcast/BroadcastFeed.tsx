
import React, { useState } from 'react';
import { broadcastData } from './data';
import BroadcastCard from './BroadcastCard';
import BroadcastVideoCard from './BroadcastVideoCard';
import VideoPlayerModal from './VideoPlayerModal';

const BroadcastFeed = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const sortedPosts = [...broadcastData].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const handlePlayVideo = (videoUrl: string) => {
    setSelectedVideo(videoUrl);
  };

  return (
    <>
      <div className="masonry-grid">
        {sortedPosts.map((post) => (
            post.type === 'video' ? (
              <BroadcastVideoCard key={post.id} post={post} onPlay={handlePlayVideo} />
            ) : (
              <div key={post.id} className="masonry-grid-item">
                <BroadcastCard post={post} />
              </div>
            )
        ))}
      </div>
      <VideoPlayerModal 
        isOpen={!!selectedVideo} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedVideo(null);
          }
        }}
        videoUrl={selectedVideo}
      />
    </>
  );
};

export default BroadcastFeed;
