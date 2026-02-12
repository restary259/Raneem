import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Users, Gift, TrendingUp } from 'lucide-react';

interface WelcomeCardProps {
  fullName: string;
  userId: string;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ fullName, userId }) => {
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [activeReferrals, setActiveReferrals] = useState(0);
  const [totalRewards, setTotalRewards] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: referrals } = await (supabase as any)
        .from('referrals')
        .select('status')
        .eq('referrer_id', userId);
      
      if (referrals) {
        setTotalReferrals(referrals.length);
        setActiveReferrals(referrals.filter((r: any) => r.status === 'enrolled' || r.status === 'paid').length);
      }

      const { data: rewards } = await (supabase as any)
        .from('rewards')
        .select('amount')
        .eq('user_id', userId);
      
      if (rewards) {
        setTotalRewards(rewards.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0));
      }
    };
    fetchStats();
  }, [userId]);

  // Next milestone
  const milestones = [1, 5, 10];
  const nextMilestone = milestones.find(m => m > activeReferrals) || 10;
  const progress = Math.min((activeReferrals / nextMilestone) * 100, 100);

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">مرحباً، {fullName}! 👋</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-3 bg-background/80 rounded-lg p-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الإحالات</p>
              <p className="text-lg font-bold">{totalReferrals}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-background/80 rounded-lg p-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">إحالات ناجحة</p>
              <p className="text-lg font-bold">{activeReferrals}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-background/80 rounded-lg p-3">
            <Gift className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">المكافآت</p>
              <p className="text-lg font-bold">{totalRewards.toLocaleString()} ₪</p>
            </div>
          </div>
        </div>

        {/* Progress to next milestone */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">التقدم نحو الإنجاز التالي ({nextMilestone} إحالات)</span>
            <span className="font-medium">{activeReferrals}/{nextMilestone}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
};

export default WelcomeCard;
