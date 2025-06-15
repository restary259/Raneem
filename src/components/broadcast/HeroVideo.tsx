
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { BroadcastPost } from './data';

interface HeroVideoProps {
  post: BroadcastPost;
}

const HeroVideo: React.FC<HeroVideoProps> = ({ post }) => {
  return (
    <div className="relative w-full h-[60vh] md:h-[70vh] text-white overflow-hidden">
      <video
        poster={post.posterUrl}
        src={post.videoUrl}
        className="absolute top-0 left-0 w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-12 text-right">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-2 text-shadow-lg animate-fade-in">
          {post.title}
        </h1>
        <p className="max-w-xl text-lg mb-6 text-shadow animate-fade-in animation-delay-300">
          {post.description}
        </p>
        <div className="animate-fade-in animation-delay-500">
          <Button size="lg" asChild className="bg-green-600 hover:bg-green-700 text-white">
            <a 
              href={post.youtubeId ? `https://www.youtube.com/watch?v=${post.youtubeId}` : post.videoUrl} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Play className="ml-2 h-5 w-5" />
              مشاهدة على يوتيوب
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HeroVideo;
