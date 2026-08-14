/**
 * Shared dashboard shell primitives.
 *
 * Every dashboard page composes these instead of hand-rolling headers, KPI
 * cards, toolbars and empty/loading/error states. Presentational only — no
 * data access, no business logic.
 */
export { default as PageHeader } from "./PageHeader";
export { default as KpiRow } from "./KpiRow";
export type { KpiItem } from "./KpiRow";
export { default as SectionCard } from "./SectionCard";
export { default as DataToolbar } from "./DataToolbar";
export type { FilterPill } from "./DataToolbar";
export { default as SegmentedTabs } from "./SegmentedTabs";
export type { SegmentItem } from "./SegmentedTabs";
export { EmptyState, LoadingState, ErrorState } from "./States";
export { default as TablePagination } from "@/components/common/TablePagination";
export { usePagination } from "@/hooks/usePagination";
export type { PaginationState } from "@/hooks/usePagination";
export { useDebouncedValue } from "@/hooks/useDebouncedValue";

