
import React, { useState } from 'react';
import { BroadcastPost } from './data';
import BroadcastVideoCard from './BroadcastVideoCard';
import VideoPlayerModal from './VideoPlayerModal';

interface VideoGalleryProps {
    posts: BroadcastPost[];
}

const VideoGallery: React.FC<VideoGalleryProps> = ({ posts }) => {
    const [selectedVideo, setSelectedVideo] = useState<BroadcastPost | null>(null);

    const handlePlayVideo = (post: BroadcastPost) => {
        setSelectedVideo(post);
    };

    return (
        <>
            <div className="masonry-grid-videos">
                {posts.map((post) => (
                    <div key={post.id} className="masonry-grid-item">
                        <BroadcastVideoCard post={post} onPlay={handlePlayVideo} />
                    </div>
                ))}
            </div>
            <VideoPlayerModal 
                isOpen={!!selectedVideo} 
                onOpenChange={(isOpen) => !isOpen && setSelectedVideo(null)}
                videoUrl={selectedVideo?.videoUrl}
                youtubeId={selectedVideo?.youtubeId}
            />
        </>
    );
};

export default VideoGallery;
