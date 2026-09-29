import {
  FilePlus2,
  ArrowRightLeft,
  Upload,
  CalendarPlus,
  CalendarCheck,
  CalendarClock,
  Banknote,
  GraduationCap,
  Send,
  StickyNote,
  UserPlus,
  UserCog,
  Archive,
  ArchiveRestore,
  Activity,
  Globe,
  Plane,
  Paperclip,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type CaseEventCategory =
  "status" | "documents" | "money" | "appointments" | "notes" | "other";

export interface CaseEventMeta {
  icon: LucideIcon;
  /** Tailwind classes for the icon bubble — semantic tokens only. */
  tone: string;
  category: CaseEventCategory;
}

const DEFAULT_META: CaseEventMeta = {
  icon: Activity,
  tone: "bg-muted text-muted-foreground",
  category: "other",
};

export const CASE_EVENT_META: Record<string, CaseEventMeta> = {
  case_created: {
    icon: FilePlus2,
    tone: "bg-primary/10 text-primary",
    category: "status",
  },
  status_changed: {
    icon: ArrowRightLeft,
    tone: "bg-primary/10 text-primary",
    category: "status",
  },
  case_submitted: {
    icon: Send,
    tone: "bg-primary/10 text-primary",
    category: "status",
  },
  case_assigned: {
    icon: UserCog,
    tone: "bg-muted text-foreground",
    category: "status",
  },
  case_archived: {
    icon: Archive,
    tone: "bg-muted text-muted-foreground",
    category: "status",
  },
  case_unarchived: {
    icon: ArchiveRestore,
    tone: "bg-muted text-muted-foreground",
    category: "status",
  },
  student_account_created: {
    icon: UserPlus,
    tone: "bg-secondary/40 text-foreground",
    category: "other",
  },
  document_uploaded: {
    icon: Upload,
    tone: "bg-secondary/40 text-foreground",
    category: "documents",
  },
  appointment_scheduled: {
    icon: CalendarPlus,
    tone: "bg-accent/40 text-foreground",
    category: "appointments",
  },
  appointment_rescheduled: {
    icon: CalendarClock,
    tone: "bg-accent/40 text-foreground",
    category: "appointments",
  },
  appointment_outcome: {
    icon: CalendarCheck,
    tone: "bg-accent/40 text-foreground",
    category: "appointments",
  },
  payment_received: {
    icon: Banknote,
    tone: "bg-[hsl(var(--status-payment)/0.14)] text-[hsl(var(--status-payment))]",
    category: "money",
  },
  enrollment_paid: {
    icon: GraduationCap,
    tone: "bg-[hsl(var(--status-paid)/0.14)] text-[hsl(var(--status-paid))]",
    category: "money",
  },
  note_added: {
    icon: StickyNote,
    tone: "bg-muted text-foreground",
    category: "notes",
  },

  // Post-arrival Visa workflow (post-enrollment operations on enrolled cases).
  student_arrived_in_germany: {
    icon: Plane,
    tone: "bg-[hsl(var(--status-paid)/0.14)] text-[hsl(var(--status-paid))]",
    category: "status",
  },
  visa_file_started: {
    icon: Globe,
    tone: "bg-primary/10 text-primary",
    category: "status",
  },
  visa_status_changed: {
    icon: ArrowRightLeft,
    tone: "bg-primary/10 text-primary",
    category: "status",
  },
  visa_application_submitted: {
    icon: Send,
    tone: "bg-[hsl(var(--status-submitted)/0.14)] text-[hsl(var(--status-submitted))]",
    category: "status",
  },
  visa_approved: {
    icon: CalendarCheck,
    tone: "bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]",
    category: "status",
  },
  visa_rejected: {
    icon: XCircle,
    tone: "bg-[hsl(var(--status-danger)/0.14)] text-[hsl(var(--status-danger))]",
    category: "status",
  },
  visa_received: {
    icon: GraduationCap,
    tone: "bg-[hsl(var(--status-paid)/0.14)] text-[hsl(var(--status-paid))]",
    category: "status",
  },
  visa_document_attached: {
    icon: Paperclip,
    tone: "bg-secondary/40 text-foreground",
    category: "documents",
  },
  visa_document_removed: {
    icon: XCircle,
    tone: "bg-muted text-muted-foreground",
    category: "documents",
  },
};

export const eventMeta = (type: string): CaseEventMeta =>
  CASE_EVENT_META[type] ?? DEFAULT_META;

export const CASE_EVENT_CATEGORIES: CaseEventCategory[] = [
  "status",
  "documents",
  "money",
  "appointments",
  "notes",
];

/** Fields worth rendering as a detail row, in display order. */
export const PAYLOAD_FIELD_ORDER = [
  "from",
  "to",
  "full_name",
  "reference",
  "source",
  "file_name",
  "category",
  "scheduled_at",
  "duration_minutes",
  "outcome",
  "amount",
  "service_fee",
  "currency",
  "text",
];
