
import { Influencer } from '@/lib/types';
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Instagram } from 'lucide-react';
import TikTokIcon from '../icons/TikTokIcon';

interface InfluencerCardProps {
  partner: Influencer;
}

const InfluencerCard = ({ partner }: InfluencerCardProps) => {
  const { t } = useTranslation('partners');

  return (
    <Card className="flex flex-col items-center justify-center text-center bg-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer h-full overflow-hidden rounded-lg p-6">
      <Avatar className="w-24 h-24 mb-4 border-2 border-primary/10">
        <AvatarImage src={partner.avatarUrl} alt={`${partner.name} avatar`} className="object-cover" />
        <AvatarFallback>{partner.name.substring(0, 2)}</AvatarFallback>
      </Avatar>
      <h3 className="text-lg font-bold text-primary">{partner.name}</h3>
      <p className="text-sm text-muted-foreground">@{partner.username}</p>
      <Badge variant="outline" className="my-3">{partner.followers} {t('card.followers')}</Badge>
      <blockquote className="text-sm text-muted-foreground italic border-s-2 border-accent ps-3 text-right">
        "{partner.quote}"
      </blockquote>
      <div className="flex items-center gap-4 mt-4">
        {partner.socials.instagram && (
          <a href={`https://instagram.com/${partner.socials.instagram}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
            <Instagram className="h-5 w-5" />
          </a>
        )}
        {partner.socials.tiktok && (
          <a href={`https://tiktok.com/@${partner.socials.tiktok}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
            <TikTokIcon className="h-5 w-5 fill-current" />
          </a>
        )}
      </div>
    </Card>
  );
};

export default InfluencerCard;
