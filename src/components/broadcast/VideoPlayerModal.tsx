
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface VideoPlayerModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  videoUrl: string | null;
}

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ isOpen, onOpenChange, videoUrl }) => {
  if (!videoUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 border-0 bg-transparent shadow-none">
        <video src={videoUrl} controls autoPlay className="w-full h-auto rounded-lg aspect-video" />
      </DialogContent>
    </Dialog>
  );
};

export default VideoPlayerModal;
