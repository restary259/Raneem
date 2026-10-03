import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart2,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardEdit,
  ClipboardList,
  DollarSign,
  FileText,
  GitBranch,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Hotel,
  Image,
  Plug,
  Inbox,
  LayoutDashboard,
  Link2,
  MapPinned,
  Megaphone,
  MessageSquare,
  Receipt,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { AppRole } from "@/contexts/AuthContext";
import { filterApplyNavItem } from "@/lib/partnerNav";

export interface DashboardNavItem {
  key: string;
  icon: LucideIcon;
  href: string;
  group?: string;
  children?: DashboardNavItem[];
  mobileLabelKey?: string;
  activePrefixes?: string[];
  /**
   * Marks the Google Business nav entry. It is hidden for team members until
   * they are assigned as an office Google operator (see
   * `filterOfficeGatedNavItems`).
   */
  googleBusinessNavKey?: boolean;
  /**
   * Marks the Offices nav entry. Like the Google Business entry, it is hidden
   * for team members until an admin assigns them to an office — an unassigned
   * member has no office workspace to open (see `filterOfficeGatedNavItems`).
   */
  officeAssignmentNavKey?: boolean;
}

export interface DashboardQuickAction extends DashboardNavItem {}

export interface DashboardRoleConfig {
  desktop: DashboardNavItem[];
  mobilePrimary: DashboardNavItem[];
  quickActions?: DashboardQuickAction[];
  accountItems: DashboardNavItem[];
  homeTitleKey: string;
  messagesHref?: string;
}

const PARTNER_BASE_NAV: DashboardNavItem[] = [
  { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
  { key: "nav.messages", icon: MessageSquare, href: "/partner/messages" },
  { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
  { key: "nav.earnings", icon: TrendingUp, href: "/partner/earnings" },
  { key: "nav.account", icon: User, href: "/partner/profile" },
];

const PARTNER_APPLY_NAV_ITEM: DashboardNavItem = {
  key: "nav.apply",
  icon: ClipboardEdit,
  href: "/partner/apply",
  group: "nav.group.work",
};

const STUDENT_DESKTOP_NAV: DashboardNavItem[] = [
  { key: "nav.home", icon: Home, href: "/student" },
  { key: "nav.cityGuide", icon: MapPinned, href: "/student/city-guide" },
  {
    key: "nav.group.studyFile",
    icon: BookOpen,
    href: "",
    children: [
      { key: "nav.checklist", icon: ClipboardList, href: "/student/checklist" },
      { key: "nav.documents", icon: FileText, href: "/student/documents" },
      { key: "nav.visa", icon: Globe, href: "/student/visa" },
      { key: "nav.fees", icon: Receipt, href: "/student/fees" },
    ],
  },
  {
    key: "nav.group.communication",
    icon: MessageSquare,
    href: "",
    children: [
      { key: "nav.messages", icon: MessageSquare, href: "/student/messages" },
      { key: "nav.contacts", icon: Users, href: "/student/contacts" },
    ],
  },
  {
    key: "nav.group.tools",
    icon: Wrench,
    href: "",
    children: [
      { key: "nav.bagrut", icon: Calculator, href: "/student/tools/bagrut" },
      { key: "nav.cvBuilder", icon: FileText, href: "/student/tools/cv" },
    ],
  },
  { key: "nav.refer", icon: Heart, href: "/student/refer" },
];

const STUDENT_QUICK_ACTIONS: DashboardQuickAction[] = [
  { key: "nav.checklist", icon: ClipboardList, href: "/student/checklist" },
  { key: "nav.documents", icon: FileText, href: "/student/documents" },
  { key: "nav.messages", icon: MessageSquare, href: "/student/messages" },
  { key: "nav.cityGuide", icon: MapPinned, href: "/student/city-guide" },
  { key: "nav.fees", icon: Receipt, href: "/student/fees" },
  { key: "nav.refer", icon: Heart, href: "/student/refer" },
];

// The team member's Google Business surface is hidden until they are assigned
// as an office operator. The parent group carries the `googleBusinessNavKey`
// flag so both the sidebar and the header title resolver can hide it.
const TEAM_DESKTOP_NAV: DashboardNavItem[] = [
  {
    key: "nav.staffInbox",
    icon: MessageSquare,
    href: "/team/messages",
    group: "nav.group.comms",
  },
  {
    key: "nav.myWork",
    icon: LayoutDashboard,
    href: "/team",
    group: "nav.group.work",
  },
  {
    key: "nav.cases",
    icon: ClipboardList,
    href: "/team/cases",
    group: "nav.group.work",
  },
  {
    key: "nav.appointments",
    icon: CalendarDays,
    href: "/team/appointments",
    group: "nav.group.work",
  },
  {
    key: "nav.offices",
    icon: Building2,
    href: "/team/offices",
    group: "nav.group.work",
    officeAssignmentNavKey: true,
  },
  {
    key: "nav.catalog",
    icon: Hotel,
    href: "/team/catalog",
    group: "nav.group.work",
  },
  {
    key: "nav.partnerSchools",
    icon: School,
    href: "/team/partner-schools",
    group: "nav.group.work",
  },
  {
    key: "nav.majorIntel",
    icon: GraduationCap,
    href: "/team/majors",
    group: "nav.group.work",
  },
  {
    key: "nav.reports",
    icon: BarChart2,
    href: "/team/analytics",
    group: "nav.group.setup",
  },
  {
    key: "nav.googleBusiness",
    icon: Link2,
    href: "",
    group: "nav.group.setup",
    googleBusinessNavKey: true,
    children: [
      {
        key: "nav.googleBusinessOverview",
        icon: Link2,
        href: "/team/google",
      },
      {
        key: "nav.googleReviews",
        icon: Star,
        href: "/team/google/reviews",
      },
      {
        key: "nav.googleProfile",
        icon: Store,
        href: "/team/google/profile",
      },
      {
        key: "nav.googlePosts",
        icon: Megaphone,
        href: "/team/google/posts",
      },
      {
        key: "nav.googlePhotos",
        icon: Image,
        href: "/team/google/photos",
      },
      {
        key: "nav.googleInsights",
        icon: BarChart3,
        href: "/team/google/insights",
      },
    ],
  },
  {
    key: "nav.group.tools",
    icon: Wrench,
    href: "",
    children: [
      { key: "nav.bagrut", icon: Calculator, href: "/team/bagrut" },
      { key: "nav.cvBuilder", icon: FileText, href: "/team/tools/cv" },
      { key: "nav.currency", icon: DollarSign, href: "/team/tools/currency" },
    ],
  },
];

export const DASHBOARD_NAV_CONFIG: Record<AppRole, DashboardRoleConfig> = {
  admin: {
    desktop: [
      {
        key: "nav.messages",
        icon: MessageSquare,
        href: "/admin/messages",
        group: "nav.group.comms",
      },
      {
        key: "nav.whatsappCampaigns",
        icon: Megaphone,
        href: "/admin/whatsapp-campaigns",
        group: "nav.group.comms",
      },
      {
        key: "nav.overview",
        icon: LayoutDashboard,
        href: "/admin",
        group: "nav.group.work",
      },
      {
        key: "nav.pipeline",
        icon: GitBranch,
        href: "/admin/pipeline",
        group: "nav.group.work",
      },
      {
        key: "nav.inbox",
        icon: Inbox,
        href: "/admin/inbox",
        group: "nav.group.work",
      },
      {
        key: "nav.financials",
        icon: DollarSign,
        href: "/admin/financials",
        group: "nav.group.money",
      },
      {
        key: "nav.commission",
        icon: DollarSign,
        href: "/admin/commission",
        group: "nav.group.money",
      },
      {
        key: "nav.team",
        icon: Users,
        href: "/admin/members",
        group: "nav.group.people",
      },
      {
        key: "nav.students",
        icon: GraduationCap,
        href: "/admin/students",
        group: "nav.group.people",
      },
      {
        key: "nav.group.setup",
        icon: Settings,
        href: "",
        children: [
          { key: "nav.programs", icon: BookOpen, href: "/admin/programs" },
          { key: "nav.offices", icon: Building2, href: "/admin/offices" },
          { key: "nav.googleIntegration", icon: Plug, href: "/admin/google" },
          { key: "nav.activity", icon: Activity, href: "/admin/activity" },
          { key: "nav.settings", icon: Settings, href: "/admin/settings" },
        ],
      },
    ],
    mobilePrimary: [
      { key: "nav.overview", icon: LayoutDashboard, href: "/admin" },
      { key: "nav.pipeline", icon: GitBranch, href: "/admin/pipeline" },
      { key: "nav.messages", icon: MessageSquare, href: "/admin/messages" },
      { key: "nav.students", icon: GraduationCap, href: "/admin/students" },
      {
        key: "nav.financials",
        icon: DollarSign,
        href: "/admin/financials",
        mobileLabelKey: "nav.mobile.finance",
      },
    ],
    accountItems: [
      { key: "nav.settings", icon: Settings, href: "/admin/settings" },
    ],
    homeTitleKey: "nav.overview",
    messagesHref: "/admin/messages",
  },
  team_member: {
    desktop: TEAM_DESKTOP_NAV,
    mobilePrimary: [
      { key: "nav.myWork", icon: LayoutDashboard, href: "/team" },
      { key: "nav.cases", icon: ClipboardList, href: "/team/cases" },
      {
        key: "nav.staffInbox",
        icon: MessageSquare,
        href: "/team/messages",
        mobileLabelKey: "nav.mobile.inbox",
      },
      {
        key: "nav.appointments",
        icon: CalendarDays,
        href: "/team/appointments",
        mobileLabelKey: "nav.mobile.appointments",
      },
      { key: "nav.students", icon: GraduationCap, href: "/team/students" },
    ],
    accountItems: [],
    homeTitleKey: "nav.myWork",
    messagesHref: "/team/messages",
  },

  social_media_partner: {
    desktop: [...PARTNER_BASE_NAV, PARTNER_APPLY_NAV_ITEM],
    mobilePrimary: [
      { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
      { key: "nav.messages", icon: MessageSquare, href: "/partner/messages" },
      { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
      {
        key: "nav.earnings",
        icon: TrendingUp,
        href: "/partner/earnings",
        mobileLabelKey: "nav.mobile.earnings",
      },
      {
        key: "nav.apply",
        icon: ClipboardEdit,
        href: "/partner/apply",
        mobileLabelKey: "nav.mobile.apply",
      },
    ],
    accountItems: [
      { key: "nav.account", icon: User, href: "/partner/profile" },
    ],
    homeTitleKey: "nav.overview",
    messagesHref: "/partner/messages",
  },

  ambassador: {
    desktop: [...PARTNER_BASE_NAV, PARTNER_APPLY_NAV_ITEM],
    mobilePrimary: [
      { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
      { key: "nav.messages", icon: MessageSquare, href: "/partner/messages" },
      { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
      {
        key: "nav.earnings",
        icon: TrendingUp,
        href: "/partner/earnings",
        mobileLabelKey: "nav.mobile.earnings",
      },
      {
        key: "nav.apply",
        icon: ClipboardEdit,
        href: "/partner/apply",
        mobileLabelKey: "nav.mobile.apply",
      },
    ],
    accountItems: [
      { key: "nav.account", icon: User, href: "/partner/profile" },
    ],
    homeTitleKey: "nav.overview",
    messagesHref: "/partner/messages",
  },

  agent: {
    desktop: [
      {
        key: "nav.overview",
        icon: LayoutDashboard,
        href: "/agent",
        group: "nav.group.work",
      },
      {
        key: "nav.network",
        icon: Users,
        href: "/agent/network",
        group: "nav.group.work",
      },
      {
        key: "nav.students",
        icon: GraduationCap,
        href: "/agent/students",
        group: "nav.group.work",
      },
      {
        key: "nav.apply",
        icon: ClipboardEdit,
        href: "/agent/apply",
        group: "nav.group.work",
      },
      {
        key: "nav.earnings",
        icon: TrendingUp,
        href: "/agent/earnings",
        group: "nav.group.money",
      },
      {
        key: "nav.messages",
        icon: MessageSquare,
        href: "/agent/messages",
        group: "nav.group.comms",
      },
      {
        key: "nav.account",
        icon: User,
        href: "/agent/profile",
        group: "nav.group.account",
      },
    ],
    mobilePrimary: [
      { key: "nav.overview", icon: LayoutDashboard, href: "/agent" },
      {
        key: "nav.network",
        icon: Users,
        href: "/agent/network",
        mobileLabelKey: "nav.mobile.network",
      },
      { key: "nav.students", icon: GraduationCap, href: "/agent/students" },
      { key: "nav.messages", icon: MessageSquare, href: "/agent/messages" },
      {
        key: "nav.earnings",
        icon: TrendingUp,
        href: "/agent/earnings",
        mobileLabelKey: "nav.mobile.earnings",
      },
    ],
    accountItems: [{ key: "nav.account", icon: User, href: "/agent/profile" }],
    homeTitleKey: "nav.overview",
    messagesHref: "/agent/messages",
  },

  student: {
    desktop: STUDENT_DESKTOP_NAV,
    mobilePrimary: [
      { key: "nav.home", icon: Home, href: "/student" },
      {
        key: "nav.cityGuide",
        icon: MapPinned,
        href: "/student/city-guide",
        mobileLabelKey: "nav.cityGuideMobile",
      },
      { key: "nav.messages", icon: MessageSquare, href: "/student/messages" },
      {
        key: "nav.account",
        icon: User,
        href: "/student/profile",
        activePrefixes: ["/student/profile", "/student/my-data"],
      },
      { key: "nav.darb", icon: Sparkles, href: "/" },
    ],
    quickActions: STUDENT_QUICK_ACTIONS,
    accountItems: [
      { key: "nav.profile", icon: User, href: "/student/profile" },
      { key: "nav.myData", icon: ShieldCheck, href: "/student/my-data" },
    ],
    homeTitleKey: "nav.home",
  },
};

const EXACT_DASHBOARD_HOME_PATHS = new Set([
  "/admin",
  "/team",
  "/partner",
  "/agent",
  "/student",
]);

export function getDashboardNav(role: AppRole): DashboardRoleConfig {
  return DASHBOARD_NAV_CONFIG[role];
}

/**
 * Removes the office-gated nav entries (Google Business and Offices) unless the
 * caller is allowed to see them. Only the team member role is gated; every
 * other role keeps its nav untouched. Pure so the sidebar, the header title
 * resolver and tests share one predicate.
 *
 * Both entries hinge on the same server fact — the member is assigned to an
 * office — so `hasOfficeAccess` is `has_google_business_access()`: an active
 * team member with an office assignment. An unresolved read (`null`) is treated
 * as no access, so the entry never flashes before the server answers.
 */
export function filterOfficeGatedNavItems(
  role: AppRole,
  items: DashboardNavItem[],
  hasOfficeAccess: boolean | null,
): DashboardNavItem[] {
  if (role !== "team_member" || hasOfficeAccess) return items;
  return items.filter(
    (item) => !item.googleBusinessNavKey && !item.officeAssignmentNavKey,
  );
}

export interface DashboardNavFilters {
  applyFormEnabled?: boolean;
  /**
   * Whether the team member is assigned to an office (the server's
   * `has_google_business_access()`). Gates both the Google Business and the
   * Offices nav entries.
   */
  officeAccess?: boolean | null;
}

const APPLY_GATED_ROLES: ReadonlySet<AppRole> = new Set([
  "social_media_partner",
  "ambassador",
  "agent",
]);

/**
 * The one place a role's desktop nav is composed from its config and the live
 * per-user flags. Keeping it pure means the sidebar, the header title resolver
 * and tests all apply the same gates in the same order.
 */
export function resolveDashboardNavItems(
  role: AppRole,
  items: DashboardNavItem[],
  filters: DashboardNavFilters = {},
): DashboardNavItem[] {
  const applyFormEnabled = filters.applyFormEnabled ?? true;
  const officeAccess = filters.officeAccess ?? true;

  return filterOfficeGatedNavItems(
    role,
    filterApplyNavItem(items, APPLY_GATED_ROLES.has(role), applyFormEnabled),
    officeAccess,
  );
}

export function matchesDashboardNavPath(
  pathname: string,
  item: DashboardNavItem,
): boolean {
  if (
    item.activePrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    )
  ) {
    return true;
  }

  if (item.href === "/" || EXACT_DASHBOARD_HOME_PATHS.has(item.href)) {
    return pathname === item.href;
  }

  if (!item.href) return false;

  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function findDashboardNavItem(
  role: AppRole,
  pathname: string,
): DashboardNavItem | undefined {
  const config = getDashboardNav(role);

  const walk = (items: DashboardNavItem[]): DashboardNavItem | undefined => {
    for (const item of items) {
      if (item.children?.length) {
        const nested = walk(item.children);
        if (nested) return nested;
      } else if (matchesDashboardNavPath(pathname, item)) {
        return item;
      }
    }
    return undefined;
  };

  return walk([
    ...config.mobilePrimary,
    ...config.desktop,
    ...config.accountItems,
    ...(config.quickActions ?? []),
  ]);
}
