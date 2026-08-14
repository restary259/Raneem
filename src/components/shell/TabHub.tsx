import React, { Suspense, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import SegmentedTabs, { type SegmentItem } from "./SegmentedTabs";
import { LoadingState } from "./States";

export interface HubTab extends SegmentItem {
  /** Panel content. Rendered lazily — only the active tab mounts. */
  render: () => React.ReactNode;
}

interface TabHubProps {
  tabs: HubTab[];
  /** Query-string key used to deep-link a tab. */
  param?: string;
  className?: string;
}

/**
 * Consolidates sibling pages into one destination with URL-addressable tabs.
 *
 * Purely presentational: each panel mounts the existing page component
 * unchanged, so data hooks, services and permissions behave exactly as before.
 * Only the active panel mounts, so consolidation never adds extra fetches.
 */
export default function TabHub({ tabs, param = "tab", className }: TabHubProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(param);
  const active = tabs.some((t) => t.value === requested) ? (requested as string) : tabs[0]?.value;

  const onChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === tabs[0]?.value) next.delete(param);
      else next.set(param, value);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, param, tabs],
  );

  if (!tabs.length) return null;

  return (
    <Tabs value={active} onValueChange={onChange} className={className}>
      <SegmentedTabs items={tabs.map(({ render, ...rest }) => rest)} />
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-3 focus-visible:outline-none">
          {active === tab.value && (
            <Suspense fallback={<LoadingState rows={4} />}>{tab.render()}</Suspense>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
