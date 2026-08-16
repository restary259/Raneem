import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Clock } from 'lucide-react';

export interface FunnelDatum { name: string; count: number; fill: string }
export interface SourceDatum { name: string; count: number }
export interface StageDatum { name: string; avg: number; hours: number }

interface Props {
  funnelData: FunnelDatum[];
  sourceData: SourceDatum[];
  avgDays: StageDatum[];
  colors: string[];
  isRtl: boolean;
}

/**
 * Recharts lives here so the vendor-charts chunk is loaded lazily, after the
 * analytics KPI row has painted. Rendering and data are unchanged.
 */
const AnalyticsCharts = ({ funnelData, sourceData, avgDays, colors, isRtl }: Props) => {
  const { t } = useTranslation('dashboard');
  const allZero = avgDays.every((d) => d.avg === 0);
  const yAxisWidth = isRtl ? 130 : 110;

  return (
    <div className="grid md:grid-cols-2 gap-6" dir="ltr">
      {/* Funnel */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.analytics.conversionFunnel')}</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500} style={{ overflow: 'visible' }}>
            <BarChart
              data={funnelData}
              layout="vertical"
              barCategoryGap="40%"
              barSize={20}
              margin={{ top: 4, bottom: 4, left: 0, right: 4 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={yAxisWidth}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                tickMargin={6}
              />
              <Tooltip
                formatter={(v) => [v, t('admin.analytics.tooltipCases')]}
                contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="count" radius={4} minPointSize={4}>
                {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source breakdown */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.analytics.sourceBreakdown')}</CardTitle></CardHeader>
        <CardContent>
          {sourceData.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">{t('admin.analytics.noData')}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={false}
                  >
                    {sourceData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [v, name]}
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                {sourceData.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
                    {s.name}: <span className="font-medium text-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Avg days in current stage */}
      <Card className="md:col-span-2">
        <CardHeader><CardTitle className="text-base">{t('admin.analytics.avgDaysPerStage')}</CardTitle></CardHeader>
        <CardContent>
          {allZero ? (
            <div className="h-[260px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-sm">{t('admin.analytics.noStageData', 'Not enough time has passed to calculate stage durations')}</p>
              <p className="text-xs opacity-70">{t('admin.analytics.noStageDataSub', 'This chart populates as cases progress through the pipeline over days')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={avgDays} margin={{ top: 4, bottom: 50, left: 0, right: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: isRtl ? 9 : 10, fill: 'currentColor' }}
                  angle={-35}
                  textAnchor="middle"
                  height={80}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} />
                <Tooltip
                  formatter={(v: number, _: unknown, props: { payload?: StageDatum }) => {
                    const hours = props?.payload?.hours;
                    if (v < 1 && hours) return [`${hours}h`, ''];
                    return [`${v} ${t('admin.analytics.tooltipDays')}`, ''];
                  }}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={4} minPointSize={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsCharts;
