
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  videoUrl?: string | null;
  youtubeId?: string | null;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onOpenChange, videoUrl, youtubeId }) => {
  if (!videoUrl && !youtubeId) return null;

  const handleOpenChange = (open: boolean) => {
    if(!open) {
      // Stop video playback when closing
      const iframe = document.querySelector('iframe');
      if (iframe) {
        const src = iframe.src;
        iframe.src = src; // This reloads the iframe, stopping the video
      }
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 border-0 bg-transparent shadow-none">
        {youtubeId ? (
          <div className="aspect-video">
            <iframe
              className="w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <video src={videoUrl!} controls autoPlay className="w-full h-auto rounded-lg aspect-video" />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VideoPlayerModal;
