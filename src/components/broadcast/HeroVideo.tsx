import React from 'react';
import { Play, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BroadcastPost } from './data';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

interface HeroVideoProps {
  post: BroadcastPost;
}

const HeroVideo: React.FC<HeroVideoProps> = ({ post }) => {
  const { t, i18n } = useTranslation('broadcast');
  const { dir } = useDirection();
  const isEn = i18n.language.startsWith('en');
  const title = isEn && post.title_en ? post.title_en : post.title;
  const description = isEn && post.description_en ? post.description_en : post.description;
  const watchUrl = post.youtubeId
    ? 'https://www.youtube.com/watch?v=' + post.youtubeId
    : post.videoUrl;

  return (
    <section className="bg-background py-10 sm:py-14 md:py-16" dir={dir}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl overflow-hidden border border-border bg-card shadow-surface">
          <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
            <div className="group relative aspect-video overflow-hidden bg-primary">
              <img
                src={post.posterUrl}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                loading="eager"
                fetchPriority="high"
              />
              <div className="absolute inset-0 bg-primary/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('watchOnYoutube')}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  <Play className="ml-1 h-7 w-7 fill-current" />
                </a>
              </div>
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                <Youtube className="h-4 w-4" />
                {t('watchOnYoutube')}
              </span>
              <span className="absolute bottom-3 right-3 bg-background/95 px-2.5 py-1 text-xs font-semibold text-foreground">
                {post.duration}
              </span>
            </div>

            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-strong">
                {t('featuredLabel', 'Featured')}
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-primary sm:text-3xl">
                {title}
              </h2>
              <p className="mt-4 line-clamp-5 text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="rounded-md">
                  <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                    <Play className="h-4 w-4 fill-current" />
                    {post.youtubeId ? t('watchOnYoutube') : t('watchVideo')}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroVideo;
