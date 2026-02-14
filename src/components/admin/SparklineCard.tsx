import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sparkData?: { v: number }[];
  subtext?: string;
}

const SparklineCard: React.FC<SparklineCardProps> = ({ icon: Icon, label, value, color, sparkData, subtext }) => {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtext && <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            {sparkData && sparkData.length > 1 && (
              <div className="w-16 h-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SparklineCard;
