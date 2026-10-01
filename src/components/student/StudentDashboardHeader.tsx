import DashboardHeader from "@/components/layout/DashboardHeader";

interface UserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

interface StudentDashboardHeaderProps {
  user: UserLike | null;
  onSignOut: () => Promise<void>;
}

/**
 * Backward-compatible student entry point.
 * The shared DashboardHeader now owns the responsive shell for every role.
 */
export default function StudentDashboardHeader({
  user,
  onSignOut,
}: StudentDashboardHeaderProps) {
  return <DashboardHeader role="student" user={user} onSignOut={onSignOut} />;
}
